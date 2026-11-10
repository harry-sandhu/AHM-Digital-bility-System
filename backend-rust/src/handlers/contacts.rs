use crate::{
    error::AppError,
    middleware::auth::require_role,
    models::{
        contact::{kind_str, parse_kind, sanitize_contact, Contact, ContactKind},
        user::{Role, UserRecord},
    },
    state::AppState,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use futures_util::TryStreamExt;
use mongodb::{
    bson::{doc, oid::ObjectId, Document},
    Database,
};
use serde_json::json;
use std::collections::HashMap;
use serde::Deserialize;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct ListContactsQuery {
    pub kind: String,
}

/// GET /api/contacts?kind=consignor|consignee — the effective list for the
/// current user: their own personal contacts if they're not in a group, or
/// their group's shared pool if they are.
pub async fn list_contacts(
    State(state): State<Arc<AppState>>,
    current_user: UserRecord,
    Query(query): Query<ListContactsQuery>,
) -> Result<impl IntoResponse, AppError> {
    let kind = parse_kind(&query.kind)
        .ok_or_else(|| AppError::new(StatusCode::BAD_REQUEST, "kind must be 'consignor' or 'consignee'"))?;

    let mut filter = doc! { "kind": kind_str(kind) };
    match current_user.group_id {
        Some(group_id) => {
            filter.insert("groupId", group_id);
        }
        None => {
            filter.insert("userId", current_user.id);
        }
    }

    let cursor = state
        .db
        .collection::<Contact>("contacts")
        .find(filter)
        .sort(doc! { "address": 1 })
        .await?;
    let contacts: Vec<Contact> = cursor.try_collect().await?;

    Ok(Json(contacts.iter().map(sanitize_contact).collect::<Vec<_>>()))
}

/// Best-effort auto-save hook, called from the bilty update handler after a
/// successful save. Dedupes by exact value match within the user's
/// effective scope (group pool if they're in one, else their personal
/// list). Failures are logged by the caller, not propagated: saving the
/// bilty must never fail because this side-effect didn't work.
pub async fn auto_save_contact(
    db: &Database,
    user: &UserRecord,
    kind: ContactKind,
    address: &str,
    gstin: Option<&str>,
) -> mongodb::error::Result<()> {
    auto_save_scoped(db, user.id, user.group_id, kind, address, gstin).await
}

pub async fn auto_save_scoped(
    db: &Database,
    user_id: ObjectId,
    group_id: Option<ObjectId>,
    kind: ContactKind,
    address: &str,
    gstin: Option<&str>,
) -> mongodb::error::Result<()> {
    let address = address.trim();
    if address.is_empty() {
        return Ok(());
    }

    let collection = db.collection::<Contact>("contacts");

    let mut filter = doc! { "kind": kind_str(kind), "address": address };
    match group_id {
        Some(group_id) => {
            filter.insert("groupId", group_id);
        }
        None => {
            filter.insert("userId", user_id);
        }
    }

    let gstin = gstin
        .map(|s| s.trim().to_uppercase())
        .filter(|s| !s.is_empty());

    if let Some(existing) = collection.find_one(filter.clone()).await? {
        // The contact may have first been saved without a GSTIN. Fill it in
        // now that one was typed, so picking the contact auto-fills it.
        if existing.gstin.is_none() {
            if let Some(gstin) = &gstin {
                collection
                    .update_one(
                        doc! { "_id": existing.id },
                        doc! { "$set": { "gstin": gstin } },
                    )
                    .await?;
            }
        }
        return Ok(());
    }

    let has_gstin = matches!(kind, ContactKind::Consignor | ContactKind::Consignee);
    let contact = Contact {
        id: ObjectId::new(),
        kind,
        address: address.to_string(),
        gstin: if has_gstin { gstin } else { None },
        user_id: if group_id.is_none() { Some(user_id) } else { None },
        group_id,
        created_at: Some(mongodb::bson::DateTime::now()),
    };

    collection.insert_one(contact).await?;
    Ok(())
}

/// One-time fill of the suggestion lists from bilties saved before this
/// feature existed (consignor, consignee, packing, delivery). Guarded by a
/// marker document so a superadmin's later deletions are never undone.
pub async fn backfill_from_bilties(db: &Database) -> anyhow::Result<()> {
    let meta = db.collection::<Document>("meta");
    if meta.find_one(doc! { "_id": "suggestions_backfill_v1" }).await?.is_some() {
        return Ok(());
    }

    let group_by_user: HashMap<ObjectId, Option<ObjectId>> = db
        .collection::<Document>("users")
        .find(doc! {})
        .projection(doc! { "groupId": 1 })
        .await?
        .try_collect::<Vec<Document>>()
        .await?
        .into_iter()
        .filter_map(|u| Some((u.get_object_id("_id").ok()?, u.get_object_id("groupId").ok())))
        .collect();

    let bilties: Vec<Document> = db
        .collection::<Document>("bilties")
        .find(doc! {})
        .sort(doc! { "createdAt": 1 })
        .await?
        .try_collect()
        .await?;

    let mut added = 0usize;
    for bilty in &bilties {
        let (Ok(owner), Ok(form)) = (bilty.get_object_id("createdBy"), bilty.get_document("formData"))
        else {
            continue;
        };
        let group_id = group_by_user.get(&owner).copied().flatten();

        let entries = [
            (ContactKind::Consignor, "consignorAddress", Some("consignorGstin")),
            (ContactKind::Consignee, "consigneeAddress", Some("consigneeGstin")),
            (ContactKind::Packing, "methodOfPacking", None),
            (ContactKind::Delivery, "deliveryAddress", None),
        ];
        for (kind, field, gstin_field) in entries {
            if let Ok(value) = form.get_str(field) {
                let gstin = gstin_field.and_then(|f| form.get_str(f).ok());
                auto_save_scoped(db, owner, group_id, kind, value, gstin).await?;
                added += 1;
            }
        }
    }

    meta.insert_one(doc! { "_id": "suggestions_backfill_v1", "at": mongodb::bson::DateTime::now() })
        .await?;
    tracing::info!(processed = added, "suggestion lists backfilled from existing bilties");
    Ok(())
}

// ---- Superadmin management -------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct ListAllQuery {
    pub kind: Option<String>,
}

/// GET /api/contacts/all — every saved suggestion across all users and
/// groups, with who owns it. Superadmin only.
pub async fn list_all_contacts(
    State(state): State<Arc<AppState>>,
    current_user: UserRecord,
    Query(query): Query<ListAllQuery>,
) -> Result<impl IntoResponse, AppError> {
    require_role(&current_user, &[Role::Superadmin])?;

    let mut filter = doc! {};
    if let Some(raw) = query.kind.as_deref().filter(|k| !k.is_empty()) {
        let kind = parse_kind(raw).ok_or_else(|| AppError::new(StatusCode::BAD_REQUEST, "Unknown kind"))?;
        filter.insert("kind", kind_str(kind));
    }

    let contacts: Vec<Contact> = state
        .db
        .collection::<Contact>("contacts")
        .find(filter)
        .sort(doc! { "kind": 1, "address": 1 })
        .await?
        .try_collect()
        .await?;

    let user_names: HashMap<ObjectId, String> = state
        .db
        .collection::<Document>("users")
        .find(doc! {})
        .projection(doc! { "name": 1 })
        .await?
        .try_collect::<Vec<Document>>()
        .await?
        .into_iter()
        .filter_map(|u| Some((u.get_object_id("_id").ok()?, u.get_str("name").ok()?.to_string())))
        .collect();
    let group_names: HashMap<ObjectId, String> = state
        .db
        .collection::<Document>("groups")
        .find(doc! {})
        .await?
        .try_collect::<Vec<Document>>()
        .await?
        .into_iter()
        .filter_map(|g| Some((g.get_object_id("_id").ok()?, g.get_str("name").ok()?.to_string())))
        .collect();

    let rows: Vec<_> = contacts
        .iter()
        .map(|c| {
            let (owner_type, owner_name) = match (c.group_id, c.user_id) {
                (Some(g), _) => ("group", group_names.get(&g).cloned().unwrap_or_else(|| "(deleted group)".into())),
                (None, Some(u)) => ("user", user_names.get(&u).cloned().unwrap_or_else(|| "(deleted user)".into())),
                _ => ("user", "—".into()),
            };
            json!({
                "id": c.id.to_hex(),
                "kind": kind_str(c.kind),
                "address": c.address,
                "gstin": c.gstin,
                "ownerType": owner_type,
                "ownerName": owner_name,
            })
        })
        .collect();

    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct UpdateContactRequest {
    pub address: Option<String>,
    pub gstin: Option<String>,
}

const MAX_SUGGESTION_LEN: usize = 5000;

/// PATCH /api/contacts/:id — edit a saved suggestion's text and (for
/// consignor/consignee) its GSTIN. Superadmin only. Does not touch bilties
/// that already used the old value.
pub async fn update_contact(
    State(state): State<Arc<AppState>>,
    current_user: UserRecord,
    Path(id): Path<String>,
    Json(body): Json<UpdateContactRequest>,
) -> Result<impl IntoResponse, AppError> {
    require_role(&current_user, &[Role::Superadmin])?;
    let object_id = ObjectId::parse_str(&id).map_err(|_| AppError::new(StatusCode::BAD_REQUEST, "Invalid id"))?;

    let collection = state.db.collection::<Contact>("contacts");
    let existing = collection
        .find_one(doc! { "_id": object_id })
        .await?
        .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "Suggestion not found"))?;

    let mut set = doc! {};

    if let Some(address) = body.address.as_deref() {
        let address = address.trim();
        if address.is_empty() {
            return Err(AppError::new(StatusCode::BAD_REQUEST, "Value can't be empty"));
        }
        if address.chars().count() > MAX_SUGGESTION_LEN {
            return Err(AppError::new(StatusCode::BAD_REQUEST, "Value is too long"));
        }

        if address != existing.address {
            let mut dup = doc! {
                "_id": { "$ne": object_id },
                "kind": kind_str(existing.kind),
                "address": address,
            };
            match (existing.group_id, existing.user_id) {
                (Some(g), _) => dup.insert("groupId", g),
                (None, Some(u)) => dup.insert("userId", u),
                _ => None,
            };
            if collection.find_one(dup).await?.is_some() {
                return Err(AppError::new(
                    StatusCode::CONFLICT,
                    "That value already exists in the same list",
                ));
            }
        }
        set.insert("address", address);
    }

    if matches!(existing.kind, ContactKind::Consignor | ContactKind::Consignee) {
        if let Some(gstin) = body.gstin.as_deref() {
            let gstin = gstin.trim().to_uppercase();
            if gstin.chars().count() > 50 {
                return Err(AppError::new(StatusCode::BAD_REQUEST, "GSTIN is too long"));
            }
            if gstin.is_empty() {
                collection
                    .update_one(doc! { "_id": object_id }, doc! { "$unset": { "gstin": "" } })
                    .await?;
            } else {
                set.insert("gstin", gstin);
            }
        }
    }

    if !set.is_empty() {
        collection
            .update_one(doc! { "_id": object_id }, doc! { "$set": set })
            .await?;
    }

    let updated = collection
        .find_one(doc! { "_id": object_id })
        .await?
        .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "Suggestion not found"))?;
    Ok(Json(sanitize_contact(&updated)))
}

/// DELETE /api/contacts/:id — superadmin only.
pub async fn delete_contact(
    State(state): State<Arc<AppState>>,
    current_user: UserRecord,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    require_role(&current_user, &[Role::Superadmin])?;
    let object_id = ObjectId::parse_str(&id).map_err(|_| AppError::new(StatusCode::BAD_REQUEST, "Invalid id"))?;

    let result = state
        .db
        .collection::<Contact>("contacts")
        .delete_one(doc! { "_id": object_id })
        .await?;
    if result.deleted_count == 0 {
        return Err(AppError::new(StatusCode::NOT_FOUND, "Suggestion not found"));
    }
    Ok(Json(json!({ "message": "Deleted" })))
}
