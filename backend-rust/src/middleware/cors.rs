use crate::state::AppState;
use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use std::sync::Arc;

/// `tower_http::cors::CorsLayer` only controls which `Access-Control-*`
/// *headers* get set — browsers enforce CORS client-side based on those
/// headers, but a non-browser client (curl, a script, a server-to-server
/// call) can simply ignore missing headers and read the response anyway.
/// Node's version (backend/src/server.ts) does something stricter: its
/// `cors()` origin callback actively rejects a disallowed-but-present
/// `Origin` header via `next(err)`, which never reaches the route handler
/// at all. Confirmed by testing: without this, a disallowed-origin request
/// here still got a 200 with the real body, just missing the CORS header —
/// a real gap, not just cosmetic, since it affects any client that doesn't
/// respect CORS. This middleware reproduces the actual Node behavior:
/// - no `Origin` header at all → allowed through (matches "non-browser
///   requests... are allowed through" in the Node comment)
/// - `Origin` present and in the allow-list → allowed through
/// - `Origin` present and NOT in the allow-list → rejected here, before
///   the request reaches any route handler
///
/// The rejection response's shape (`{success, message, stack}`, not this
/// codebase's usual `{error}`) deliberately matches Node's generic
/// catch-all `errorMiddleware.ts`, which is what actually produces this
/// specific response in the Node app (the only explicit-origin-based
/// rejection flows through there, not through any of the `{error}`-shaped
/// controller responses).
pub async fn enforce_allowed_origin(
    State(state): State<Arc<AppState>>,
    request: Request,
    next: Next,
) -> Response {
    let origin = request
        .headers()
        .get(axum::http::header::ORIGIN)
        .and_then(|value| value.to_str().ok());

    if let Some(origin) = origin {
        if !state.allowed_origins.iter().any(|allowed| allowed == origin) {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({
                    "success": false,
                    "message": "Origin is not allowed by CORS",
                    "stack": null,
                })),
            )
                .into_response();
        }
    }

    next.run(request).await
}
