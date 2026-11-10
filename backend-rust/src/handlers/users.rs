use crate::{
    error::AppError,
    middleware::auth::require_role,
    models::user::{to_listed_user, Role, UserRecord},
    state::AppState,
    utils::phone::{is_phone_length_valid, normalize_phone},
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use futures_util::TryStreamExt;
use mongodb::bson::{doc, oid::ObjectId};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

fn bad_request(message: &str) -> AppError {
    AppError::new(StatusCode::BAD_REQUEST, message)
}

/// Mirrors backend/src/controllers/userController.ts's `getAllUsers`
/// exactly, including returning the raw (unpaginated) list shape — no
/// `?page=`/`?limit=` params are added here since nothing in this module
/// needs them yet; the plan's pagination note targets `getAllBilty`, where
/// data volume is the actual concern.
pub async fn get_all_users(
    State(state): State<Arc<AppState>>,
    current_user: UserRecord,
) -> Result<impl IntoResponse, AppError> {
    require_role(&current_user, &[Role::Superadmin])?;

    let cursor = state
        .db
        .collection::<UserRecord>("users")
        .find(doc! {})
        .projection(doc! { "password": 0 })
        .sort(doc! { "createdAt": -1, "name": 1 })
        .await?;

    let users: Vec<UserRecord> = cursor.try_collect().await?;
    let listed: Vec<_> = users.iter().map(to_listed_user).collect();

    Ok(Json(listed))
}

#[derive(Debug, Deserialize, Default)]
pub struct CreateAdminRequest {
    pub name: Option<String>,
    pub phone: Option<String>,
    pub password: Option<String>,
}

/// Mirrors backend/src/controllers/userController.ts's `createAdmin`, with
/// one intentional fix over the Node version: a minimum password length is
/// now enforced here too (previously only register/login did). Node will
/// accept a short admin password where this will not — documented as an
/// expected divergence in the migration plan, not a bug.
pub async fn create_admin(
    State(state): State<Arc<AppState>>,
    current_user: UserRecord,
    Json(body): Json<CreateAdminRequest>,
) -> Result<impl IntoResponse, AppError> {
    require_role(&current_user, &[Role::Superadmin])?;

    let raw_name = body.name.unwrap_or_default();
    let raw_phone = body.phone.unwrap_or_default();
    let raw_password = body.password.unwrap_or_default();

    let trimmed_name = raw_name.trim().to_string();
    let normalized_phone = normalize_phone(&raw_phone);

    if trimmed_name.is_empty() || normalized_phone.is_empty() || raw_password.is_empty() {
        return Err(bad_request("Name, phone and password are required"));
    }

    if raw_password.len() < 6 {
        return Err(bad_request("Password must be at least 6 characters"));
    }

    if !is_phone_length_valid(&normalized_phone) {
        return Err(bad_request("Phone number must contain 10 to 15 digits"));
    }

    let users = state.db.collection::<UserRecord>("users");
    let existing = users
        .find_one(doc! { "phone": &normalized_phone })
        .await?;
    if existing.is_some() {
        return Err(bad_request("Phone already exists"));
    }

    let hashed_password =
        bcrypt::hash(&raw_password, 10).map_err(|_| AppError::internal("Failed to create admin"))?;

    let admin_id = ObjectId::new();
    state
        .db
        .collection::<mongodb::bson::Document>("users")
        .insert_one(doc! {
            "_id": admin_id,
            "name": &trimmed_name,
            "phone": &normalized_phone,
            "password": hashed_password,
            "role": "admin",
            "isActive": true,
            "biltyAccessAmount": 0,
            "createdAt": mongodb::bson::DateTime::now(),
        })
        .await
        .map_err(|_| AppError::internal("Failed to create admin"))?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "message": "Admin created successfully",
            "user": {
                "id": admin_id.to_hex(),
                "name": trimmed_name,
                "phone": normalized_phone,
                "role": "admin",
                "isActive": true,
            },
        })),
    ))
}

/// Mirrors backend/src/controllers/userController.ts's `disableUser`,
/// including its unusual "any error, even a malformed id, is a 500" behavior
/// (Node's `User.findById` throws on an invalid ObjectId and that throw is
/// never specifically caught, so it falls through to the generic 500).
pub async fn disable_user(
    State(state): State<Arc<AppState>>,
    current_user: UserRecord,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    require_role(&current_user, &[Role::Superadmin])?;

    let object_id =
        ObjectId::parse_str(&id).map_err(|_| AppError::internal("Failed to disable user"))?;

    let users = state.db.collection::<UserRecord>("users");
    let target = users
        .find_one(doc! { "_id": object_id })
        .await?
        .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "User not found"))?;

    if target.role != Role::User {
        return Err(bad_request("Only normal users can be disabled"));
    }

    if !target.is_active {
        return Err(bad_request("User is already disabled"));
    }

    users
        .update_one(doc! { "_id": object_id }, doc! { "$set": { "isActive": false } })
        .await?;

    Ok(Json(json!({ "message": "User disabled successfully" })))
}
