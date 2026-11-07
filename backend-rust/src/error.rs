use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

/// HTTP-facing error. Serializes as `{"error": "..."}`, matching the shape
/// nearly every Node controller returns directly (see e.g.
/// backend/src/controllers/authController.ts) — not the generic catch-all
/// errorMiddleware.ts shape (`{success, message, stack}`), which only a few
/// uncaught-error paths (CORS rejection, multer failures) hit today.
pub struct AppError {
    pub status: StatusCode,
    pub message: String,
}

impl AppError {
    pub fn new(status: StatusCode, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
        }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, message)
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (self.status, Json(json!({ "error": self.message }))).into_response()
    }
}

impl From<mongodb::error::Error> for AppError {
    fn from(err: mongodb::error::Error) -> Self {
        tracing::error!(error = %err, "database error");
        AppError::internal("Internal server error")
    }
}
