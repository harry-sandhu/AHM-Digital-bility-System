use crate::{handlers::auth as handlers, middleware::rate_limit, state::AppState};
use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

const AUTH_RATE_LIMIT_BURST: u32 = 10;
const AUTH_RATE_LIMIT_WINDOW_SECS: u64 = 15 * 60;

/// Mirrors backend/src/routes/authRoutes.ts, mounted at /api/auth.
/// `/register` and `/login` share one rate-limit bucket per IP (10 per 15
/// minutes), matching Node's `authLimiter` being the same middleware
/// instance applied to both paths in server.ts — not two independent
/// 10-per-15-minute allowances.
pub fn router() -> Router<Arc<AppState>> {
    let rate_limited = Router::new()
        .route("/register", post(handlers::register))
        .route("/login", post(handlers::login))
        .layer(rate_limit::build_layer(
            AUTH_RATE_LIMIT_BURST,
            AUTH_RATE_LIMIT_WINDOW_SECS,
            "Too many attempts. Please try again later.",
        ));

    let unlimited = Router::new().route("/me", get(handlers::get_current_user));

    rate_limited.merge(unlimited)
}
