use crate::{
    error::AppError,
    middleware::auth::require_role,
    models::{
        bilty::{Bilty, BiltyStatus},
        bilty_counter::BiltyCounter,
        number_range::NumberRange,
        user::{Role, UserRecord},
    },
    state::AppState,
    utils::{
        bill_extraction::extract_bill_fields,
        datetime::{indian_midnight_deadline, is_past_deadline},
        number_allocation::{
            allocate_consignment_number, reset_range_to_first_available, AllocationError,
            NO_CONSIGNMENT_NUMBERS_ERROR,
        },
        ocr::extract_text_from_pdf,
        pricing::get_bilty_access_amount,
    },
};
use axum::{
    extract::{Multipart, Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use chrono::Utc;
use futures_util::TryStreamExt;
use mongodb::bson::{doc, oid::ObjectId, DateTime as BsonDateTime, Document};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

fn bad_request(message: impl Into<String>) -> AppError {
    AppError::new(StatusCode::BAD_REQUEST, message)
}

const DEFAULT_BILTY_ACCESS_AMOUNT: f64 = 200.0;

/// backend/src/controllers/biltyController.ts's `BILTY_FORM_FIELDS`,
/// ported verbatim and in the same order.
const BILTY_FORM_FIELDS: &[&str] = &[
    "lorryNo", "invoiceNoDate", "invoiceDate", "deliveryAddress", "phoneNo",
    "insuranceCompany", "insurancePolicyNo", "insuranceDate", "insuranceCertNo", "insuranceAmount",
    "biltyNumber", "gstPaidBy", "basisOfBooking", "consignorAddress", "consignorGstin",
    "consigneeAddress", "consigneeGstin", "consignmentNo", "biltyDate", "from", "to",
    "packages", "methodOfPacking", "description", "actualWt", "chargedWt", "rate", "amount",
    "freight", "labour", "gstCharges", "biltyCharges", "kanta", "grandTotal", "advance",
    "balanceAmt", "declaredValue", "driver", "remarks", "bookingClerk",
];

/// A cap that doesn't exist in the Node version at all (the audit flagged
/// this as unvalidated) — generous enough that no legitimate form value
/// could ever hit it, so it changes behavior only for abuse, not for any
/// real user.
const MAX_FORM_FIELD_LEN: usize = 5000;

/// `pickBiltyFormFields` + per-field type/length validation (the hardening
/// the audit asked for). Returns `Ok(None)` for an absent key — preserving
/// Node's exact "only copy if `field in input`" semantics — not an
/// empty-string default.
fn extract_form_field(form_data: &Value, key: &str) -> Result<Option<String>, AppError> {
    match form_data.get(key) {
        None => Ok(None),
        Some(Value::String(s)) => {
            if s.chars().count() > MAX_FORM_FIELD_LEN {
                Err(bad_request(format!(
                    "Field '{key}' exceeds the maximum allowed length"
                )))
            } else {
                Ok(Some(s.clone()))
            }
        }
        Some(_) => Err(bad_request(format!("Field '{key}' must be a string"))),
    }
}

/// `parseAmount` ported verbatim: strip commas, parse, non-finite/missing -> 0.
fn parse_amount(value: Option<&str>) -> f64 {
    let cleaned: String = value.unwrap_or("").chars().filter(|c| *c != ',').collect();
    cleaned.trim().parse::<f64>().ok().filter(|v| v.is_finite()).unwrap_or(0.0)
}

/// `formatAmount` ported verbatim: whole numbers print bare, fractional
/// values round to 2 decimals and trim trailing zeros (never "500.00").
fn format_amount(value: f64) -> String {
    if value == value.trunc() {
        return format!("{}", value.trunc() as i64);
    }

    let rounded = (value * 100.0).round() / 100.0;
    if rounded == rounded.trunc() {
        return format!("{}", rounded.trunc() as i64);
    }

    format!("{rounded:.2}").trim_end_matches('0').trim_end_matches('.').to_string()
}

/// Plain `String(number)` semantics (no forced rounding) — used for
/// `String(req.user.biltyAccessFreightAmount)`, distinct from
/// `formatAmount`'s rounding-to-2-decimals behavior.
fn format_js_number(value: f64) -> String {
    if value == value.trunc() && value.abs() < 1e15 {
        format!("{}", value.trunc() as i64)
    } else {
        value.to_string()
    }
}

fn to_iso_string(value: Option<BsonDateTime>) -> Option<String> {
    value.map(|dt| dt.to_chrono().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string())
}

fn can_manage_all_bilties(role: Role) -> bool {
    role == Role::Superadmin
}

/// `getBiltyStatus` — the response's `status` is always recomputed from
/// the *current* expiry, never just echoed from the stored field.
fn computed_status(expires_at: Option<BsonDateTime>, stored_status: Option<BiltyStatus>) -> &'static str {
    let expired = expires_at
        .map(|dt| is_past_deadline(Some(dt.to_chrono())))
        .unwrap_or(true);

    if !expired {
        "draft"
    } else {
        match stored_status {
            Some(BiltyStatus::Draft) | None => "draft",
            Some(BiltyStatus::Expired) => "expired",
        }
    }
}

/// `serializeRange`-equivalent for a bilty: the raw document plus the
/// recomputed `status`, with `createdBy` populated the same way
/// `.populate("createdBy", "name phone role")` does.
async fn build_bilty_response(state: &Arc<AppState>, bilty: &Bilty) -> Value {
    let created_by = state
        .db
        .collection::<Document>("users")
        .find_one(doc! { "_id": bilty.created_by })
        .projection(doc! { "name": 1, "phone": 1, "role": 1 })
        .await
        .ok()
        .flatten();

    let created_by_value = created_by.map(|doc| {
        json!({
            "_id": bilty.created_by.to_hex(),
            "name": doc.get_str("name").unwrap_or_default(),
            "phone": doc.get_str("phone").unwrap_or_default(),
            "role": doc.get_str("role").unwrap_or_default(),
        })
    });

    let form_data_value =
        serde_json::to_value(&bilty.form_data).unwrap_or_else(|_| json!({}));

    let mut value = json!({
        "_id": bilty.id.to_hex(),
        "biltyNumber": bilty.bilty_number,
        "formData": form_data_value,
        "status": computed_status(bilty.expires_at, bilty.status),
    });

    if let Some(n) = bilty.consignment_no {
        value["consignmentNo"] = json!(n);
    }
    if let Some(amount) = bilty.payment_amount {
        value["paymentAmount"] = json!(amount);
    }
    if let Some(adjustment) = bilty.freight_adjustment {
        value["freightAdjustment"] = json!(adjustment);
    }
    if let Some(extra) = bilty.extra_paid {
        value["extraPaid"] = json!(extra);
    }
    if let Some(s) = to_iso_string(bilty.payment_paid_at) {
        value["paymentPaidAt"] = json!(s);
    }
    if let Some(s) = to_iso_string(bilty.payment_expires_at) {
        value["paymentExpiresAt"] = json!(s);
    }
    if let Some(s) = to_iso_string(bilty.expires_at) {
        value["expiresAt"] = json!(s);
    }
    if let Some(s) = to_iso_string(bilty.created_at) {
        value["createdAt"] = json!(s);
    }
    if let Some(created_by_value) = created_by_value {
        value["createdBy"] = created_by_value;
    }

    value
}

pub async fn generate_bilty(
    State(state): State<Arc<AppState>>,
    current_user: UserRecord,
) -> Result<impl IntoResponse, AppError> {
    let expires_at_chrono = current_user.bilty_access_expires_at.map(|dt| dt.to_chrono());
    if is_past_deadline(expires_at_chrono) {
        return Err(AppError::new(
            StatusCode::PAYMENT_REQUIRED,
            "Payment required before bilty generation",
        ));
    }

    let consignment_no = match allocate_consignment_number(&state.db, current_user.id).await {
        Ok(number) => number,
        Err(AllocationError::NoNumbersAvailable) => {
            return Err(AppError::new(StatusCode::CONFLICT, NO_CONSIGNMENT_NUMBERS_ERROR))
        }
        Err(AllocationError::Database(err)) => {
            tracing::error!(error = %err, "consignment number allocation failed");
            return Err(AppError::internal("Failed to generate bilty number"));
        }
    };

    let prefix = format!("AHM-{}", Utc::now().format("%Y"));
    let counter_doc = state
        .db
        .collection::<BiltyCounter>("biltycounters")
        .find_one_and_update(
            doc! { "prefix": &prefix },
            doc! { "$inc": { "counter": 1 } },
        )
        .upsert(true)
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|_| AppError::internal("Failed to generate bilty number"))?
        .ok_or_else(|| AppError::internal("Failed to generate bilty number"))?;

    let bilty_number = format!("AHM-{}-{:04}", &prefix[4..], counter_doc.counter);

    // `expiresAt = req.user.biltyAccessExpiresAt ? ... : getIndianMidnightDeadline()`
    // — the fallback branch is unreachable in practice (a missing expiry
    // already 402'd above), ported as a single shared helper rather than
    // two implementations to keep in sync.
    let expires_at = expires_at_chrono.unwrap_or_else(|| indian_midnight_deadline(Utc::now()));

    let payment_amount = current_user.bilty_access_amount.unwrap_or(DEFAULT_BILTY_ACCESS_AMOUNT);
    let payment_paid_at = current_user.bilty_access_paid_at.map(|dt| dt.to_chrono()).unwrap_or_else(Utc::now);

    let bilty = Bilty {
        id: ObjectId::new(),
        bilty_number: bilty_number.clone(),
        consignment_no: Some(consignment_no),
        created_by: current_user.id,
        form_data: Document::new(),
        status: Some(if is_past_deadline(Some(expires_at)) {
            BiltyStatus::Expired
        } else {
            BiltyStatus::Draft
        }),
        payment_amount: Some(payment_amount),
        payment_paid_at: Some(BsonDateTime::from_chrono(payment_paid_at)),
        payment_expires_at: Some(BsonDateTime::from_chrono(expires_at)),
        expires_at: Some(BsonDateTime::from_chrono(expires_at)),
        freight_adjustment: None,
        extra_paid: None,
        created_at: Some(BsonDateTime::now()),
    };

    state
        .db
        .collection::<Bilty>("bilties")
        .insert_one(&bilty)
        .await
        .map_err(|_| AppError::internal("Failed to generate bilty number"))?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "message": "Bilty reserved",
            "biltyId": bilty.id.to_hex(),
            "biltyNumber": bilty_number,
            "consignmentNo": consignment_no,
            "expiresAt": to_iso_string(bilty.expires_at),
            "paymentAmount": payment_amount,
        })),
    ))
}

#[derive(Debug, Deserialize, Default)]
pub struct PurchaseAccessRequest {
    #[serde(rename = "freightAmount")]
    pub freight_amount: Option<Value>,
}

pub async fn purchase_bilty_access(
    State(state): State<Arc<AppState>>,
    current_user: UserRecord,
    Json(body): Json<PurchaseAccessRequest>,
) -> Result<impl IntoResponse, AppError> {
    let freight_amount = body
        .freight_amount
        .as_ref()
        .and_then(Value::as_f64)
        .filter(|v| v.is_finite() && *v > 0.0)
        .ok_or_else(|| bad_request("A valid freight amount greater than zero is required"))?;

    let users = state.db.collection::<Document>("users");
    let user_doc = users
        .find_one(doc! { "_id": current_user.id })
        .await?
        .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "User not found"))?;

    if !user_doc.get_bool("isActive").unwrap_or(true) {
        return Err(AppError::new(
            StatusCode::FORBIDDEN,
            "Your account has been disabled",
        ));
    }

    let now = Utc::now();
    let existing_expiry = user_doc
        .get_datetime("biltyAccessExpiresAt")
        .ok()
        .map(|dt| dt.to_chrono());
    let has_existing_access = existing_expiry.map(|expiry| expiry >= now).unwrap_or(false);

    let expires_at = if has_existing_access {
        existing_expiry.unwrap()
    } else {
        indian_midnight_deadline(now)
    };

    let bilty_access_amount = get_bilty_access_amount(freight_amount);

    let mut update = doc! {
        "biltyAccessExpiresAt": BsonDateTime::from_chrono(expires_at),
        "biltyAccessAmount": bilty_access_amount,
        "biltyAccessFreightAmount": freight_amount,
    };
    if !has_existing_access {
        update.insert("biltyAccessPaidAt", BsonDateTime::from_chrono(now));
    }

    users
        .update_one(doc! { "_id": current_user.id }, doc! { "$set": update })
        .await?;

    let paid_at = if has_existing_access {
        user_doc.get_datetime("biltyAccessPaidAt").ok().copied()
    } else {
        Some(BsonDateTime::from_chrono(now))
    };

    Ok(Json(json!({
        "message": "Bilty access activated",
        "user": {
            "id": current_user.id.to_hex(),
            "name": current_user.name,
            "phone": current_user.phone,
            "role": current_user.role,
            "isActive": current_user.is_active,
            "biltyAccessPaidAt": to_iso_string(paid_at),
            "biltyAccessExpiresAt": to_iso_string(Some(BsonDateTime::from_chrono(expires_at))),
            "biltyAccessAmount": bilty_access_amount,
            "biltyAccessFreightAmount": freight_amount,
        },
    })))
}

#[derive(Debug, Deserialize, Default)]
pub struct UpdateBiltyRequest {
    #[serde(rename = "formData")]
    pub form_data: Option<Value>,
    /// Set by the client after the user accepts the "pay extra" popup when
    /// a freight change moves the bilty into a more expensive tier.
    #[serde(rename = "confirmExtraPayment", default)]
    pub confirm_extra_payment: Option<bool>,
}

pub async fn update_bilty(
    State(state): State<Arc<AppState>>,
    current_user: UserRecord,
    Path(id): Path<String>,
    Json(body): Json<UpdateBiltyRequest>,
) -> Result<Response, AppError> {
    let object_id =
        ObjectId::parse_str(&id).map_err(|_| AppError::internal("Failed to update bilty"))?;

    let collection = state.db.collection::<Bilty>("bilties");
    let mut bilty = collection
        .find_one(doc! { "_id": object_id })
        .await?
        .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "Bilty not found"))?;

    let is_owner_or_manager =
        bilty.created_by == current_user.id || can_manage_all_bilties(current_user.role);
    if !is_owner_or_manager {
        return Err(AppError::new(StatusCode::FORBIDDEN, "Access denied"));
    }

    let is_expired = bilty
        .expires_at
        .map(|dt| is_past_deadline(Some(dt.to_chrono())))
        .unwrap_or(false);

    if is_expired && current_user.role != Role::Superadmin {
        if bilty.status != Some(BiltyStatus::Expired) {
            collection
                .update_one(
                    doc! { "_id": object_id },
                    doc! { "$set": { "status": "expired" } },
                )
                .await?;
        }

        return Err(AppError::new(
            StatusCode::GONE,
            "Bilty expired. Please create a new bilty after paying again.",
        ));
    }

    let is_owner = bilty.created_by == current_user.id;
    let raw_form_data = body.form_data.clone().unwrap_or(Value::Null);
    let source_is_object = raw_form_data.is_object();

    let mut next_form_data = Document::new();
    if source_is_object {
        for &field in BILTY_FORM_FIELDS {
            if let Some(value) = extract_form_field(&raw_form_data, field)? {
                next_form_data.insert(field, value);
            }
        }
    }

    // Lorry number and GSTINs are always stored in capitals.
    for field in ["lorryNo", "consignorGstin", "consigneeGstin"] {
        if let Ok(value) = next_form_data.get_str(field) {
            let upper = value.to_uppercase();
            next_form_data.insert(field, upper);
        }
    }

    next_form_data.insert(
        "consignmentNo",
        bilty.consignment_no.map(|n| n.to_string()).unwrap_or_default(),
    );

    let gst_paid_by = raw_form_data
        .get("gstPaidBy")
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .unwrap_or("Consignor");
    next_form_data.insert("gstPaidBy", gst_paid_by);

    let basis_of_booking = raw_form_data
        .get("basisOfBooking")
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .unwrap_or("To Pay");
    next_form_data.insert("basisOfBooking", basis_of_booking);

    // Freight is editable. If the form left it empty, fall back to the
    // freight the owner paid for at the payment step.
    if is_owner && parse_amount(next_form_data.get_str("freight").ok()) <= 0.0 {
        if let Some(freight_amount) = current_user.bilty_access_freight_amount {
            next_form_data.insert("freight", format_js_number(freight_amount));
        }
    }

    // Tier adjustment: compare the fee for the new freight against the fee
    // originally paid for this bilty.
    let freight_now = parse_amount(next_form_data.get_str("freight").ok());
    let mut new_adjustment = bilty.freight_adjustment;
    let mut new_extra_paid = bilty.extra_paid;
    if freight_now > 0.0 {
        let base_fee = bilty.payment_amount.unwrap_or(DEFAULT_BILTY_ACCESS_AMOUNT);
        let adjustment = get_bilty_access_amount(freight_now) - base_fee;
        let already_paid = bilty.extra_paid.unwrap_or(0.0);

        if adjustment > already_paid {
            let extra_due = adjustment - already_paid;
            if is_owner {
                if body.confirm_extra_payment != Some(true) {
                    return Ok((
                        StatusCode::PAYMENT_REQUIRED,
                        Json(json!({
                            "error": format!("Changing freight to \u{20b9}{} moves this bilty to a higher tier. Pay \u{20b9}{} extra to continue.", format_amount(freight_now), format_amount(extra_due)),
                            "code": "EXTRA_PAYMENT_REQUIRED",
                            "extraDue": extra_due,
                            "newFee": get_bilty_access_amount(freight_now),
                            "paidFee": base_fee,
                        })),
                    )
                        .into_response());
                }
                new_extra_paid = Some(adjustment);
            } else {
                // A superadmin editing someone else's bilty waives the charge.
                new_extra_paid = Some(adjustment);
            }
        }
        new_adjustment = Some(adjustment);
    }
    bilty.freight_adjustment = new_adjustment;
    bilty.extra_paid = new_extra_paid;

    let grand_total = parse_amount(next_form_data.get_str("freight").ok())
        + parse_amount(next_form_data.get_str("labour").ok())
        + parse_amount(next_form_data.get_str("gstCharges").ok())
        + parse_amount(next_form_data.get_str("biltyCharges").ok())
        + parse_amount(next_form_data.get_str("kanta").ok());
    next_form_data.insert("grandTotal", format_amount(grand_total));
    next_form_data.insert(
        "balanceAmt",
        format_amount(grand_total - parse_amount(next_form_data.get_str("advance").ok())),
    );

    bilty.form_data = next_form_data;
    bilty.status = Some(if is_expired {
        BiltyStatus::Expired
    } else {
        BiltyStatus::Draft
    });

    collection
        .replace_one(doc! { "_id": object_id }, &bilty)
        .await?;

    // Best-effort: whatever consignor/consignee was typed gets added to
    // the saving user's contact list if it isn't there already. Never
    // blocks or fails the bilty save itself.
    if let Ok(address) = bilty.form_data.get_str("consignorAddress") {
        let gstin = bilty.form_data.get_str("consignorGstin").ok();
        if let Err(err) = crate::handlers::contacts::auto_save_contact(
            &state.db,
            &current_user,
            crate::models::contact::ContactKind::Consignor,
            address,
            gstin,
        )
        .await
        {
            tracing::warn!(error = %err, "failed to auto-save consignor contact");
        }
    }
    if let Ok(address) = bilty.form_data.get_str("consigneeAddress") {
        let gstin = bilty.form_data.get_str("consigneeGstin").ok();
        if let Err(err) = crate::handlers::contacts::auto_save_contact(
            &state.db,
            &current_user,
            crate::models::contact::ContactKind::Consignee,
            address,
            gstin,
        )
        .await
        {
            tracing::warn!(error = %err, "failed to auto-save consignee contact");
        }
    }

    let saved = collection
        .find_one(doc! { "_id": object_id })
        .await?
        .ok_or_else(|| AppError::internal("Failed to update bilty"))?;

    Ok(Json(json!({
        "message": "Bilty updated successfully",
        "bilty": build_bilty_response(&state, &saved).await,
    }))
    .into_response())
}

/// GET /api/bilty/suggestions/packing — the user's previously-used
/// "method of packing" values, most frequently used first.
pub async fn get_packing_suggestions(
    State(state): State<Arc<AppState>>,
    current_user: UserRecord,
) -> Result<impl IntoResponse, AppError> {
    let cursor = state
        .db
        .collection::<Document>("bilties")
        .find(doc! { "createdBy": current_user.id })
        .projection(doc! { "formData.methodOfPacking": 1 })
        .await?;
    let docs: Vec<Document> = cursor.try_collect().await?;

    let mut counts: std::collections::HashMap<String, (usize, String)> = std::collections::HashMap::new();
    for doc in &docs {
        let value = doc
            .get_document("formData")
            .ok()
            .and_then(|form| form.get_str("methodOfPacking").ok())
            .map(str::trim)
            .unwrap_or("");
        if value.is_empty() {
            continue;
        }
        let entry = counts
            .entry(value.to_lowercase())
            .or_insert_with(|| (0, value.to_string()));
        entry.0 += 1;
    }

    let mut ranked: Vec<(usize, String)> = counts.into_values().collect();
    ranked.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.cmp(&b.1)));

    Ok(Json(ranked.into_iter().map(|(_, value)| value).collect::<Vec<_>>()))
}

pub async fn get_my_bilty(
    State(state): State<Arc<AppState>>,
    current_user: UserRecord,
) -> Result<impl IntoResponse, AppError> {
    let cursor = state
        .db
        .collection::<Bilty>("bilties")
        .find(doc! { "createdBy": current_user.id })
        .sort(doc! { "createdAt": -1 })
        .await?;

    let bilties: Vec<Bilty> = cursor.try_collect().await?;
    let mut responses = Vec::with_capacity(bilties.len());
    for bilty in &bilties {
        responses.push(build_bilty_response(&state, bilty).await);
    }

    Ok(Json(responses))
}

pub async fn get_bilty_by_id(
    State(state): State<Arc<AppState>>,
    current_user: UserRecord,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let object_id =
        ObjectId::parse_str(&id).map_err(|_| AppError::internal("Failed to fetch bilty"))?;

    let bilty = state
        .db
        .collection::<Bilty>("bilties")
        .find_one(doc! { "_id": object_id })
        .await?
        .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "Bilty not found"))?;

    if bilty.created_by != current_user.id && !can_manage_all_bilties(current_user.role) {
        return Err(AppError::new(StatusCode::FORBIDDEN, "Access denied"));
    }

    Ok(Json(build_bilty_response(&state, &bilty).await))
}

pub async fn get_all_bilty(
    State(state): State<Arc<AppState>>,
    current_user: UserRecord,
) -> Result<impl IntoResponse, AppError> {
    require_role(&current_user, &[Role::Superadmin])?;

    let cursor = state
        .db
        .collection::<Bilty>("bilties")
        .find(doc! {})
        .sort(doc! { "createdAt": -1 })
        .await?;

    let bilties: Vec<Bilty> = cursor.try_collect().await?;
    let mut responses = Vec::with_capacity(bilties.len());
    for bilty in &bilties {
        responses.push(build_bilty_response(&state, bilty).await);
    }

    Ok(Json(responses))
}

/// `deleteBilty` (backend/src/controllers/biltyController.ts). Node's route
/// already enforces superadmin via `authorize("superadmin")` middleware
/// before the controller ever runs, which makes the controller's own
/// `role !== "superadmin"` check (with its *different* message,
/// "Superadmin access required") dead code in practice — `require_role`
/// here reproduces the message that's actually reachable ("Access denied"),
/// consistent with every other superadmin-only handler in this port.
pub async fn delete_bilty(
    State(state): State<Arc<AppState>>,
    current_user: UserRecord,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    require_role(&current_user, &[Role::Superadmin])?;

    let object_id =
        ObjectId::parse_str(&id).map_err(|_| AppError::internal("Failed to delete bilty"))?;

    let bilty = state
        .db
        .collection::<Bilty>("bilties")
        .find_one_and_delete(doc! { "_id": object_id })
        .await?
        .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "Bilty not found"))?;

    // Deliberately no `isActive` filter here — a currently-deactivated
    // range still gets its `nextNumber` reclaimed if it numerically
    // contains the freed number, matching Node's query exactly.
    if let Some(consignment_no) = bilty.consignment_no {
        let range = state
            .db
            .collection::<NumberRange>("numberranges")
            .find_one(doc! {
                "rangeStart": { "$lte": consignment_no },
                "rangeEnd": { "$gte": consignment_no },
                "$or": [
                    { "scope": "master" },
                    { "scope": "personal", "userId": bilty.created_by },
                ],
            })
            .await?;

        if let Some(range) = range {
            reset_range_to_first_available(&state.db, range.id).await?;
        }
    }

    Ok(Json(json!({ "message": "Bilty deleted successfully" })))
}

const ALLOWED_BILL_MIME_TYPES: &[&str] = &["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BILL_UPLOAD_BYTES: usize = 10 * 1024 * 1024;

/// `extractBillData` (backend/src/controllers/biltyController.ts). One
/// deliberate fix over the Node version: invalid-file-type and too-large
/// uploads return 400 here, not Node's accidental 500 (multer's own errors
/// there fall through to the generic catch-all handler, which defaults to
/// 500 — a gap flagged in the earlier audit).
pub async fn extract_bill_data(
    State(state): State<Arc<AppState>>,
    _current_user: UserRecord,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, AppError> {
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut content_type: Option<String> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| bad_request("Invalid upload"))?
    {
        if field.name() == Some("bill") {
            content_type = field.content_type().map(|s| s.to_string());
            let bytes = field.bytes().await.map_err(|_| bad_request("Invalid upload"))?;
            file_bytes = Some(bytes.to_vec());
            break;
        }
    }

    let bytes = file_bytes.ok_or_else(|| bad_request("No bill file uploaded"))?;
    let content_type = content_type.unwrap_or_default();

    if !ALLOWED_BILL_MIME_TYPES.contains(&content_type.as_str()) {
        return Err(bad_request("Only JPEG, PNG, WEBP images or PDF files are allowed"));
    }

    if bytes.len() > MAX_BILL_UPLOAD_BYTES {
        return Err(bad_request("File is too large (10MB maximum)"));
    }

    let raw_text = if content_type == "application/pdf" {
        let pdfium = state
            .pdfium
            .as_deref()
            .ok_or_else(|| AppError::internal("PDF bill scanning is not available on this server"))?;
        extract_text_from_pdf(pdfium, &state.ocr_pool, bytes).await?
    } else {
        state.ocr_pool.ocr_image_bytes(&bytes).await?
    };

    let extracted_fields = extract_bill_fields(&raw_text);
    let message = if extracted_fields.is_empty() {
        "Couldn't confidently read any fields from this bill. Please fill the form manually."
    } else {
        "Extracted what we could find on the bill. Please review every field before saving."
    };

    Ok(Json(json!({
        "message": message,
        "extractedFields": extracted_fields,
        "rawText": raw_text,
    })))
}
