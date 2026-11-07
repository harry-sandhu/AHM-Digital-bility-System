use crate::{
    error::AppError,
    models::user::{sanitize_user, Role, User, UserRecord},
    state::AppState,
    utils::{
        phone::{is_phone_length_valid, normalize_phone},
        token::sign_token,
    },
};
use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use mongodb::bson::{doc, oid::ObjectId};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

#[derive(Debug, Deserialize, Default)]
pub struct RegisterRequest {
    pub name: Option<String>,
    pub phone: Option<String>,
    pub password: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
pub struct LoginRequest {
    pub phone: Option<String>,
    pub password: Option<String>,
}

fn bad_request(message: &str) -> AppError {
    AppError::new(StatusCode::BAD_REQUEST, message)
}

/// Mirrors backend/src/routes/authRoutes.ts's express-validator chain (run
/// first, in this exact field order) followed by
/// backend/src/controllers/authController.ts's `register` (run second).
pub async fn register(
    State(state): State<Arc<AppState>>,
    Json(body): Json<RegisterRequest>,
) -> Result<impl IntoResponse, AppError> {
    let raw_name = body.name.unwrap_or_default();
    let raw_phone = body.phone.unwrap_or_default();
    let raw_password = body.password.unwrap_or_default();

    if raw_name.trim().is_empty() {
        return Err(bad_request("Name is required"));
    }
    if raw_phone.trim().is_empty() {
        return Err(bad_request("Phone is required"));
    }
    if raw_password.len() < 6 {
        return Err(bad_request("Password must be at least 6 characters"));
    }

    let trimmed_name = raw_name.trim().to_string();
    let normalized_phone = normalize_phone(&raw_phone);

    if trimmed_name.is_empty() || normalized_phone.is_empty() || raw_password.is_empty() {
        return Err(bad_request("Name, phone and password are required"));
    }

    if !is_phone_length_valid(&normalized_phone) {
        return Err(bad_request("Phone number must contain 10 to 15 digits"));
    }

    let users = state.db.collection::<User>("users");

    let existing = users
        .find_one(doc! { "phone": &normalized_phone })
        .await?;
    if existing.is_some() {
        return Err(bad_request("Phone already exists"));
    }

    let hashed_password = bcrypt::hash(&raw_password, 10)
        .map_err(|_| AppError::internal("Registration failed"))?;

    let user = User {
        id: ObjectId::new(),
        name: trimmed_name,
        phone: normalized_phone,
        password: hashed_password,
        role: Role::User,
        is_active: true,
        bilty_access_paid_at: None,
        bilty_access_expires_at: None,
        bilty_access_amount: Some(0.0),
        bilty_access_freight_amount: None,
        group_id: None,
        created_at: Some(mongodb::bson::DateTime::now()),
    };

    users
        .insert_one(&user)
        .await
        .map_err(|_| AppError::internal("Registration failed"))?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "message": "User registered successfully",
            "user": sanitize_user(&user),
        })),
    ))
}

/// Mirrors authRoutes.ts's login validators followed by authController.ts's
/// `login`.
pub async fn login(
    State(state): State<Arc<AppState>>,
    Json(body): Json<LoginRequest>,
) -> Result<impl IntoResponse, AppError> {
    let raw_phone = body.phone.unwrap_or_default();
    let raw_password = body.password.unwrap_or_default();

    if raw_phone.trim().is_empty() {
        return Err(bad_request("Phone is required"));
    }
    if raw_password.is_empty() {
        return Err(bad_request("Password is required"));
    }

    let normalized_phone = normalize_phone(&raw_phone);

    if normalized_phone.is_empty() || raw_password.is_empty() {
        return Err(bad_request("Phone and password are required"));
    }

    if !is_phone_length_valid(&normalized_phone) {
        return Err(bad_request("Phone number must contain 10 to 15 digits"));
    }

    let users = state.db.collection::<User>("users");
    let user = users
        .find_one(doc! { "phone": &normalized_phone })
        .await?
        .ok_or_else(|| bad_request("Invalid phone or password"))?;

    let password_matches = bcrypt::verify(&raw_password, &user.password)
        .map_err(|_| AppError::internal("Login failed"))?;
    if !password_matches {
        return Err(bad_request("Invalid phone or password"));
    }

    // Checked only after the password is confirmed correct, so a disabled
    // account doesn't leak its existence to someone who doesn't have the
    // password.
    if !user.is_active {
        return Err(AppError::new(
            StatusCode::FORBIDDEN,
            "Your account has been disabled",
        ));
    }

    let token = sign_token(&user.id.to_hex(), &state.jwt_secret)
        .map_err(|_| AppError::internal("Login failed"))?;

    Ok(Json(json!({
        "token": token,
        "user": sanitize_user(&user),
    })))
}

/// Mirrors authController.ts's `getCurrentUser`. The 401 "Authentication
/// required" branch is unreachable here in practice since the `UserRecord`
/// extractor already rejects the request before this handler runs — kept
/// implicit rather than ported as dead code.
pub async fn get_current_user(user: UserRecord) -> impl IntoResponse {
    Json(json!({ "user": sanitize_user(&user) }))
}
