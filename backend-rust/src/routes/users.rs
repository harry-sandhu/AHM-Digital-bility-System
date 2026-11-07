use crate::{handlers::users as handlers, state::AppState};
use axum::{
    routing::{get, patch, post},
    Router,
};
use std::sync::Arc;

/// Mirrors backend/src/routes/userRoutes.ts, mounted at /api/users. Role
/// checks happen inside each handler (via `require_role`) rather than as a
/// separate routing-layer middleware, matching the plan's hand-written,
/// diffable-against-Node style.
pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(handlers::get_all_users))
        .route("/admins", post(handlers::create_admin))
        .route("/{id}/disable", patch(handlers::disable_user))
}
