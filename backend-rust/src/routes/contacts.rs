use crate::{handlers::contacts as handlers, state::AppState};
use axum::{routing::get, Router};
use std::sync::Arc;

/// Mounted at /api/contacts.
pub fn router() -> Router<Arc<AppState>> {
    Router::new().route("/", get(handlers::list_contacts))
}
