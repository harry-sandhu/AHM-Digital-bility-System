use crate::{
    error::AppError,
    middleware::auth::require_role,
    models::{
        number_range::{NumberRange, NumberRangeScope},
        user::{Role, UserRecord},
    },
    state::AppState,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use futures_util::TryStreamExt;
use mongodb::{
    bson::{doc, oid::ObjectId, Document},
    Database,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

fn bad_request(message: impl Into<String>) -> AppError {
    AppError::new(StatusCode::BAD_REQUEST, message)
}

/// backend/src/controllers/numberRangeController.ts's `isValidInteger` +
/// `validateBounds`, ported as one step: returns the validated (start, end)
/// pair or the exact Node error message for the first failing check.
///
/// One acknowledged divergence: a JSON value like `1000.0` is classified as
/// non-integer here (serde_json parses it as a float), whereas JS's
/// `Number.isInteger(1000.0)` is `true`. The frontend's number inputs never
/// produce a literal trailing `.0`, so this is not expected to be reachable
/// in practice.
fn validate_bounds(range_start: Option<&Value>, range_end: Option<&Value>) -> Result<(i64, i64), String> {
    let as_integer = |value: Option<&Value>| -> Option<i64> {
        let number = value?.as_number_i64_if_integer()?;
        Some(number)
    };

    let start = as_integer(range_start);
    let end = as_integer(range_end);

    let (start, end) = match (start, end) {
        (Some(s), Some(e)) => (s, e),
        _ => return Err("Range start and end must be integers".to_string()),
    };

    if start < 1000 || end < 1000 {
        return Err("Range values must be at least 1000".to_string());
    }

    if start > end {
        return Err("Range start cannot be greater than range end".to_string());
    }

    Ok((start, end))
}

/// Small helper trait-like extension used only by `validate_bounds` above,
/// to express "a JSON number with no fractional/exponent part" the same way
/// `Number.isInteger` does for a value that was already confirmed to be a
/// JS `number`.
trait IntegerJsonValue {
    fn as_number_i64_if_integer(&self) -> Option<i64>;
}

impl IntegerJsonValue for Value {
    fn as_number_i64_if_integer(&self) -> Option<i64> {
        self.as_i64()
    }
}

/// `findOverlap` — any *active* range (either scope) whose bounds intersect
/// the given [range_start, range_end], optionally excluding one range id
/// (used when updating that same range).
async fn find_overlap(
    db: &Database,
    range_start: i64,
    range_end: i64,
    exclude_id: Option<ObjectId>,
) -> mongodb::error::Result<bool> {
    let mut filter = doc! {
        "isActive": true,
        "rangeStart": { "$lte": range_end },
        "rangeEnd": { "$gte": range_start },
    };
    if let Some(id) = exclude_id {
        filter.insert("_id", doc! { "$ne": id });
    }

    Ok(db
        .collection::<Document>("numberranges")
        .find_one(filter)
        .await?
        .is_some())
}

async fn user_exists(db: &Database, user_id: ObjectId) -> mongodb::error::Result<bool> {
    Ok(db
        .collection::<Document>("users")
        .find_one(doc! { "_id": user_id })
        .await?
        .is_some())
}

async fn has_active_non_exhausted_personal_range(
    db: &Database,
    user_id: ObjectId,
    exclude_id: Option<ObjectId>,
) -> mongodb::error::Result<bool> {
    let mut filter = doc! {
        "scope": "personal",
        "userId": user_id,
        "isActive": true,
        "isExhausted": false,
    };
    if let Some(id) = exclude_id {
        filter.insert("_id", doc! { "$ne": id });
    }

    Ok(db
        .collection::<Document>("numberranges")
        .find_one(filter)
        .await?
        .is_some())
}

/// `serializeRange` — spreads the raw document plus a computed `remaining`.
/// `userId` is either omitted (master scope, or personal scope with no
/// populate requested — matching `createRange`'s un-populated response),
/// a plain hex string (same, explicit case), or a populated
/// `{_id, name, phone}` object (matching `listRanges`/`updateRange`, which
/// re-fetch with `.populate("userId", "name phone")`).
async fn serialize_range(db: &Database, range: &NumberRange, populate_user: bool) -> Value {
    let mut value = json!({
        "_id": range.id.to_hex(),
        "scope": range.scope,
        "rangeStart": range.range_start,
        "rangeEnd": range.range_end,
        "nextNumber": range.next_number,
        "isExhausted": range.is_exhausted,
        "isActive": range.is_active,
        "remaining": range.remaining(),
    });

    if let Some(label) = &range.label {
        value["label"] = json!(label);
    }
    if let Some(created_at) = range.created_at {
        value["createdAt"] = json!(created_at
            .to_chrono()
            .format("%Y-%m-%dT%H:%M:%S%.3fZ")
            .to_string());
    }

    if let Some(user_id) = range.user_id {
        if populate_user {
            let user_doc = db
                .collection::<Document>("users")
                .find_one(doc! { "_id": user_id })
                .projection(doc! { "name": 1, "phone": 1 })
                .await
                .ok()
                .flatten();

            value["userId"] = match user_doc {
                Some(doc) => json!({
                    "_id": user_id.to_hex(),
                    "name": doc.get_str("name").unwrap_or_default(),
                    "phone": doc.get_str("phone").unwrap_or_default(),
                }),
                // The referenced user is gone (unreachable in practice — this
                // app only disables users, never deletes them). Node's
                // populate would leave this unresolved; falling back to the
                // bare id is the closest faithful equivalent.
                None => json!(user_id.to_hex()),
            };
        } else {
            value["userId"] = json!(user_id.to_hex());
        }
    }

    value
}

#[derive(Debug, Deserialize, Default)]
pub struct CreateRangeRequest {
    pub label: Option<Value>,
    pub scope: Option<String>,
    #[serde(rename = "userId")]
    pub user_id: Option<Value>,
    #[serde(rename = "rangeStart")]
    pub range_start: Option<Value>,
    #[serde(rename = "rangeEnd")]
    pub range_end: Option<Value>,
}

fn parse_user_id_value(value: &Value) -> Option<ObjectId> {
    value.as_str().and_then(|s| ObjectId::parse_str(s).ok())
}

pub async fn create_range(
    State(state): State<Arc<AppState>>,
    current_user: UserRecord,
    Json(body): Json<CreateRangeRequest>,
) -> Result<impl IntoResponse, AppError> {
    require_role(&current_user, &[Role::Superadmin])?;

    let (range_start, range_end) =
        validate_bounds(body.range_start.as_ref(), body.range_end.as_ref()).map_err(bad_request)?;

    let scope = match body.scope.as_deref() {
        Some("master") => NumberRangeScope::Master,
        Some("personal") => NumberRangeScope::Personal,
        _ => return Err(bad_request("Scope must be master or personal")),
    };

    let user_id = body.user_id.as_ref().and_then(parse_user_id_value);
    if scope == NumberRangeScope::Personal && user_id.is_none() {
        return Err(bad_request("A valid user is required for a personal range"));
    }

    if scope == NumberRangeScope::Personal {
        let user_id = user_id.unwrap();

        if !user_exists(&state.db, user_id).await? {
            return Err(bad_request("Assigned user was not found"));
        }

        if has_active_non_exhausted_personal_range(&state.db, user_id, None).await? {
            return Err(bad_request("This user already has an active personal range"));
        }
    }

    if find_overlap(&state.db, range_start, range_end, None).await? {
        return Err(bad_request("The range overlaps an active range"));
    }

    // `label: typeof label === "string" ? label.trim() : undefined` — stored
    // only when the input was actually a string (even if trimming leaves it
    // empty); otherwise the field is omitted entirely, matching Mongoose's
    // "no schema default" behavior for an unset field.
    let label = body
        .label
        .as_ref()
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string());

    let range = NumberRange {
        id: ObjectId::new(),
        label,
        scope,
        user_id: if scope == NumberRangeScope::Personal {
            user_id
        } else {
            None
        },
        range_start,
        range_end,
        next_number: range_start,
        is_exhausted: false,
        is_active: true,
        created_by: current_user.id,
        created_at: Some(mongodb::bson::DateTime::now()),
    };

    state
        .db
        .collection::<NumberRange>("numberranges")
        .insert_one(&range)
        .await?;

    Ok((
        StatusCode::CREATED,
        Json(serialize_range(&state.db, &range, false).await),
    ))
}

pub async fn list_ranges(
    State(state): State<Arc<AppState>>,
    current_user: UserRecord,
) -> Result<impl IntoResponse, AppError> {
    require_role(&current_user, &[Role::Superadmin])?;

    let cursor = state
        .db
        .collection::<NumberRange>("numberranges")
        .find(doc! {})
        .sort(doc! { "createdAt": 1 })
        .await?;

    let ranges: Vec<NumberRange> = cursor.try_collect().await?;
    let mut serialized = Vec::with_capacity(ranges.len());
    for range in &ranges {
        serialized.push(serialize_range(&state.db, range, true).await);
    }

    Ok(Json(serialized))
}

#[derive(Debug, Deserialize, Default)]
pub struct UpdateRangeRequest {
    pub label: Option<Value>,
    #[serde(rename = "isActive")]
    pub is_active: Option<Value>,
    #[serde(rename = "userId")]
    pub user_id: Option<Value>,
    #[serde(rename = "rangeEnd")]
    pub range_end: Option<Value>,
}

pub async fn update_range(
    State(state): State<Arc<AppState>>,
    current_user: UserRecord,
    Path(id): Path<String>,
    Json(body): Json<UpdateRangeRequest>,
) -> Result<impl IntoResponse, AppError> {
    require_role(&current_user, &[Role::Superadmin])?;

    let object_id =
        ObjectId::parse_str(&id).map_err(|_| AppError::internal("Failed to update number range"))?;

    let collection = state.db.collection::<NumberRange>("numberranges");
    let mut range = collection
        .find_one(doc! { "_id": object_id })
        .await?
        .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "Number range not found"))?;

    // `label` — only reassigned when the provided value is a string;
    // present-but-non-string leaves the existing label untouched (ported
    // literally from the Node ternary, not "fixed" into a type-check 400).
    if let Some(label_value) = &body.label {
        if let Some(label_str) = label_value.as_str() {
            range.label = Some(label_str.trim().to_string());
        }
    }

    // `isActive` — present-and-non-boolean is a 400, unlike `label`'s
    // silent ignore above; this asymmetry is in the Node source as-is.
    if let Some(is_active_value) = &body.is_active {
        match is_active_value.as_bool() {
            Some(flag) => range.is_active = flag,
            None => return Err(bad_request("isActive must be boolean")),
        }
    }

    if range.scope != NumberRangeScope::Personal && body.user_id.is_some() {
        return Err(bad_request("Only personal ranges can change user"));
    }

    if range.scope == NumberRangeScope::Personal {
        let next_user_id = match &body.user_id {
            Some(value) => parse_user_id_value(value),
            None => range.user_id,
        };

        let next_user_id = next_user_id
            .ok_or_else(|| bad_request("A valid user is required for a personal range"))?;

        if !user_exists(&state.db, next_user_id).await? {
            return Err(bad_request("Assigned user was not found"));
        }

        let existing_personal =
            has_active_non_exhausted_personal_range(&state.db, next_user_id, Some(range.id)).await?;

        // `targetIsActive = isActive === undefined ? range.isActive : isActive`
        // — by this point `range.isActive` has *already* been mutated above
        // if the request provided one, so this is equivalent to just
        // reading the (possibly just-updated) `range.is_active`.
        let target_is_active = range.is_active;

        if existing_personal && target_is_active && !range.is_exhausted {
            return Err(bad_request("This user already has an active personal range"));
        }

        range.user_id = Some(next_user_id);
    }

    if let Some(range_end_value) = &body.range_end {
        let (_, new_range_end) =
            validate_bounds(Some(&json!(range.range_start)), Some(range_end_value)).map_err(bad_request)?;

        if new_range_end < range.next_number - 1 {
            return Err(bad_request("Cannot shrink a range below numbers already issued"));
        }
        if new_range_end < range.range_end {
            return Err(bad_request("Range end can only be extended upward"));
        }

        if find_overlap(&state.db, range.range_start, new_range_end, Some(range.id)).await? {
            return Err(bad_request("The range overlaps an active range"));
        }

        range.range_end = new_range_end;
        if range.next_number <= range.range_end {
            range.is_exhausted = false;
        }
    }

    // `if (range.isActive && isActive === true)` — `range.isActive` was
    // already overwritten above if the request set it, so this condition
    // is really just "did this request explicitly set isActive to true",
    // not an old-vs-new comparison. See the landmines note in the plan.
    let request_set_active_true = body.is_active.as_ref().and_then(Value::as_bool) == Some(true);
    if request_set_active_true {
        if find_overlap(&state.db, range.range_start, range.range_end, Some(range.id)).await? {
            return Err(bad_request("The range overlaps an active range"));
        }
    }

    collection
        .replace_one(doc! { "_id": object_id }, &range)
        .await?;

    let saved = collection
        .find_one(doc! { "_id": object_id })
        .await?
        .ok_or_else(|| AppError::internal("Failed to update number range"))?;

    Ok(Json(serialize_range(&state.db, &saved, true).await))
}

pub async fn delete_range(
    State(state): State<Arc<AppState>>,
    current_user: UserRecord,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    require_role(&current_user, &[Role::Superadmin])?;

    let object_id =
        ObjectId::parse_str(&id).map_err(|_| AppError::internal("Failed to delete number range"))?;

    let collection = state.db.collection::<NumberRange>("numberranges");
    let range = collection
        .find_one(doc! { "_id": object_id })
        .await?
        .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "Number range not found"))?;

    if range.next_number != range.range_start {
        return Err(bad_request("This range has issued numbers. Deactivate it instead"));
    }

    collection.delete_one(doc! { "_id": object_id }).await?;

    Ok(Json(json!({ "message": "Number range deleted successfully" })))
}
