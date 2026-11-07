use crate::{handlers::groups as handlers, state::AppState};
use axum::{
    routing::{get, patch},
    Router,
};
use std::sync::Arc;

/// Mounted at /api/groups. Every route is superadmin-only (checked inside
/// each handler via `require_role`, matching the rest of this codebase).
pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(handlers::list_groups).post(handlers::create_group))
        .route("/{group_id}/users/{user_id}", patch(handlers::assign_user_to_group))
}
