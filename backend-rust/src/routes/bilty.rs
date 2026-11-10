use crate::{handlers::bilty as handlers, middleware::rate_limit, state::AppState};
use axum::{
    extract::DefaultBodyLimit,
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use tower::ServiceBuilder;

const MAX_BILL_UPLOAD_BYTES: usize = 10 * 1024 * 1024;
const WINDOW_SECS: u64 = 15 * 60;

/// Mirrors backend/src/routes/biltyRoutes.ts, mounted at /api/bilty.
pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/pay",
            post(handlers::purchase_bilty_access).layer(rate_limit::build_layer(
                30,
                WINDOW_SECS,
                "Too many requests. Please try again later.",
            )),
        )
        .route("/generate", get(handlers::generate_bilty))
        .route("/my", get(handlers::get_my_bilty))
        .route("/all", get(handlers::get_all_bilty))
        .route(
            "/extract-bill",
            post(handlers::extract_bill_data).layer(
                ServiceBuilder::new()
                    // axum's own default body-limit (2MB) is well under
                    // multer's 10MB cap — must raise it here or legitimate
                    // uploads get rejected before this route's own size
                    // check even runs.
                    .layer(DefaultBodyLimit::max(MAX_BILL_UPLOAD_BYTES))
                    .layer(rate_limit::build_layer(
                        20,
                        WINDOW_SECS,
                        "Too many bill uploads. Please try again later.",
                    )),
            ),
        )
        .route("/{id}/print", post(handlers::mark_printed))
        .route("/{id}/revisions", get(handlers::get_revisions))
        .route(
            "/{id}",
            get(handlers::get_bilty_by_id)
                .put(handlers::update_bilty)
                .delete(handlers::delete_bilty),
        )
}
