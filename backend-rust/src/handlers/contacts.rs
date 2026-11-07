use crate::{
    error::AppError,
    models::{
        contact::{kind_str, parse_kind, sanitize_contact, Contact, ContactKind},
        user::UserRecord,
    },
    state::AppState,
};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use futures_util::TryStreamExt;
use mongodb::{bson::doc, Database};
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
/// successful save. Dedupes by exact address match within the user's
/// effective scope (group pool if they're in one, else their personal
/// list) — not fuzzy matching, an exact re-typed address just no-ops.
/// Failures are logged, not propagated: saving the bilty must never fail
/// because this side-effect didn't work.
pub async fn auto_save_contact(
    db: &Database,
    user: &UserRecord,
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
    match user.group_id {
        Some(group_id) => {
            filter.insert("groupId", group_id);
        }
        None => {
            filter.insert("userId", user.id);
        }
    }

    if collection.find_one(filter).await?.is_some() {
        return Ok(());
    }

    let gstin = gstin
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let contact = Contact {
        id: mongodb::bson::oid::ObjectId::new(),
        kind,
        address: address.to_string(),
        gstin,
        user_id: if user.group_id.is_none() { Some(user.id) } else { None },
        group_id: user.group_id,
        created_at: Some(mongodb::bson::DateTime::now()),
    };

    collection.insert_one(contact).await?;
    Ok(())
}
