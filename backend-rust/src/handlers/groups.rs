use crate::{
    error::AppError,
    middleware::auth::require_role,
    models::{
        contact::{kind_str, Contact},
        group::{sanitize_group, Group},
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
    bson::{doc, oid::ObjectId, DateTime as BsonDateTime},
    Database,
};
use serde::Deserialize;
use serde_json::json;
use std::collections::HashSet;
use std::sync::Arc;

fn bad_request(message: impl Into<String>) -> AppError {
    AppError::new(StatusCode::BAD_REQUEST, message)
}

pub async fn list_groups(
    State(state): State<Arc<AppState>>,
    current_user: UserRecord,
) -> Result<impl IntoResponse, AppError> {
    require_role(&current_user, &[Role::Superadmin])?;

    let cursor = state
        .db
        .collection::<Group>("groups")
        .find(doc! {})
        .sort(doc! { "name": 1 })
        .await?;
    let groups: Vec<Group> = cursor.try_collect().await?;

    Ok(Json(groups.iter().map(sanitize_group).collect::<Vec<_>>()))
}

#[derive(Debug, Deserialize, Default)]
pub struct CreateGroupRequest {
    pub name: Option<String>,
}

pub async fn create_group(
    State(state): State<Arc<AppState>>,
    current_user: UserRecord,
    Json(body): Json<CreateGroupRequest>,
) -> Result<impl IntoResponse, AppError> {
    require_role(&current_user, &[Role::Superadmin])?;

    let name = body.name.unwrap_or_default().trim().to_string();
    if name.is_empty() {
        return Err(bad_request("Group name is required"));
    }

    let groups = state.db.collection::<Group>("groups");
    if groups.find_one(doc! { "name": &name }).await?.is_some() {
        return Err(bad_request("A group with that name already exists"));
    }

    let group = Group {
        id: ObjectId::new(),
        name: name.clone(),
        created_at: Some(BsonDateTime::now()),
    };
    groups.insert_one(&group).await?;

    Ok((StatusCode::CREATED, Json(sanitize_group(&group))))
}

/// Removes exact-duplicate (kind, address) contacts within a group, keeping
/// whichever was created first. Needed after a merge: a user joining a
/// group may already have an entry the group itself already had.
async fn dedupe_group_contacts(db: &Database, group_id: ObjectId) -> mongodb::error::Result<()> {
    let collection = db.collection::<Contact>("contacts");
    let cursor = collection
        .find(doc! { "groupId": group_id })
        .sort(doc! { "createdAt": 1 })
        .await?;
    let all: Vec<Contact> = cursor.try_collect().await?;

    let mut seen: HashSet<(&'static str, String)> = HashSet::new();
    let mut duplicate_ids = Vec::new();
    for contact in &all {
        let key = (kind_str(contact.kind), contact.address.clone());
        if !seen.insert(key) {
            duplicate_ids.push(contact.id);
        }
    }

    if !duplicate_ids.is_empty() {
        collection
            .delete_many(doc! { "_id": { "$in": duplicate_ids } })
            .await?;
    }
    Ok(())
}

/// PATCH /api/groups/{group_id}/users/{user_id} — assigns a user to a
/// group and merges their existing personal contacts into the group's
/// shared pool. This is a one-way move, not a copy: the user's contacts
/// stop being individually "personal" the moment they join.
pub async fn assign_user_to_group(
    State(state): State<Arc<AppState>>,
    current_user: UserRecord,
    Path((group_id, user_id)): Path<(String, String)>,
) -> Result<impl IntoResponse, AppError> {
    require_role(&current_user, &[Role::Superadmin])?;

    let group_oid = ObjectId::parse_str(&group_id).map_err(|_| bad_request("Invalid group id"))?;
    let user_oid = ObjectId::parse_str(&user_id).map_err(|_| bad_request("Invalid user id"))?;

    let users = state.db.collection::<UserRecord>("users");
    let target = users
        .find_one(doc! { "_id": user_oid })
        .await?
        .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "User not found"))?;

    state
        .db
        .collection::<Group>("groups")
        .find_one(doc! { "_id": group_oid })
        .await?
        .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "Group not found"))?;

    if target.group_id == Some(group_oid) {
        return Ok(Json(json!({ "message": "User is already in that group" })));
    }

    state
        .db
        .collection::<mongodb::bson::Document>("contacts")
        .update_many(
            doc! { "userId": user_oid },
            doc! { "$set": { "groupId": group_oid }, "$unset": { "userId": "" } },
        )
        .await?;

    dedupe_group_contacts(&state.db, group_oid).await?;

    users
        .update_one(
            doc! { "_id": user_oid },
            doc! { "$set": { "groupId": group_oid } },
        )
        .await?;

    Ok(Json(json!({ "message": "User assigned to group" })))
}
