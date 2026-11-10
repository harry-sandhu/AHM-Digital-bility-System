use crate::{handlers::contacts as handlers, state::AppState};
use axum::{
    routing::{get, patch},
    Router,
};
use std::sync::Arc;

/// Mounted at /api/contacts. `/` is for every user (their own effective
/// list); `/all` and `/{id}` are superadmin-only (checked in the handlers).
pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(handlers::list_contacts))
        .route("/all", get(handlers::list_all_contacts))
        .route("/{id}", patch(handlers::update_contact).delete(handlers::delete_contact))
}
