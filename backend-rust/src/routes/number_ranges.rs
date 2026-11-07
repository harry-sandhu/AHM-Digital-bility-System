use crate::{handlers::number_ranges as handlers, state::AppState};
use axum::{
    routing::{patch, post},
    Router,
};
use std::sync::Arc;

/// Mirrors backend/src/routes/numberRangeRoutes.ts, mounted at
/// /api/number-ranges. All four routes are superadmin-only.
pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", post(handlers::create_range).get(handlers::list_ranges))
        .route(
            "/{id}",
            patch(handlers::update_range).delete(handlers::delete_range),
        )
}
