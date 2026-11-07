use crate::{
    error::AppError,
    models::user::{Role, UserRecord},
    state::AppState,
    utils::token::verify_token,
};
use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
};
use mongodb::bson::{doc, oid::ObjectId};
use std::sync::Arc;

/// Mirrors backend/src/middleware/auth.ts exactly, including its specific
/// error messages/status codes for each failure mode, and projects the
/// password hash out of the query (a fix over the Node version, which loads
/// the full doc and just never leaks the hash downstream).
impl FromRequestParts<Arc<AppState>> for UserRecord {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &Arc<AppState>,
    ) -> Result<Self, Self::Rejection> {
        let header_value = parts
            .headers
            .get("Authorization")
            .and_then(|value| value.to_str().ok());

        let token = header_value
            .and_then(|value| value.split(' ').nth(1))
            .ok_or_else(|| AppError::new(StatusCode::UNAUTHORIZED, "No token provided"))?;

        let claims = verify_token(token, &state.jwt_secret)
            .map_err(|_| AppError::new(StatusCode::UNAUTHORIZED, "Invalid token"))?;

        let user_id = ObjectId::parse_str(&claims.id)
            .map_err(|_| AppError::new(StatusCode::UNAUTHORIZED, "Invalid token"))?;

        let user = state
            .db
            .collection::<UserRecord>("users")
            .find_one(doc! { "_id": user_id })
            .projection(doc! { "password": 0 })
            .await
            .map_err(|_| AppError::new(StatusCode::UNAUTHORIZED, "Invalid token"))?
            .ok_or_else(|| AppError::new(StatusCode::UNAUTHORIZED, "User not found"))?;

        if !user.is_active {
            return Err(AppError::new(
                StatusCode::FORBIDDEN,
                "Your account has been disabled",
            ));
        }

        Ok(user)
    }
}

/// Mirrors backend/src/middleware/authorize.ts's role check (the "no user"
/// 401 branch is already handled by the `UserRecord` extractor above before
/// a handler body runs, so this only needs to replicate the 403 branch).
pub fn require_role(user: &UserRecord, roles: &[Role]) -> Result<(), AppError> {
    if roles.contains(&user.role) {
        Ok(())
    } else {
        Err(AppError::new(StatusCode::FORBIDDEN, "Access denied"))
    }
}
