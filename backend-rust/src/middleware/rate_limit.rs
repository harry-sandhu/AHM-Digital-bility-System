use axum::{body::Body, http::StatusCode, response::IntoResponse, Json};
use governor::middleware::NoOpMiddleware;
use serde_json::json;
use tower_governor::{
    errors::GovernorError, governor::GovernorConfigBuilder, key_extractor::PeerIpKeyExtractor,
    GovernorLayer,
};

/// `express-rate-limit`'s three limiters in backend/src/server.ts (plus the
/// bill-extraction one added this session) use a fixed 15-minute window
/// counting up to N requests. `governor`'s token bucket instead replenishes
/// continuously — same long-run rate, no hard reset edge. Close enough for
/// abuse protection; not bit-for-bit identical to Node's windowing.
///
/// Key extractor is `PeerIpKeyExtractor` (the raw TCP peer IP), not
/// `SmartIpKeyExtractor`. Smart extraction trusts client-supplied headers
/// (X-Forwarded-For / X-Real-IP / Forwarded) with no allow-list of trusted
/// proxies, so anyone can set a fresh header per request and get a brand-new
/// bucket every time — a full rate-limit bypass unless this is confirmed to
/// sit behind a proxy that overwrites/strips that header before it reaches
/// us. We are not (confirmed) behind such a proxy, so the raw peer IP is the
/// safe default. If this later deploys behind Render/Nginx/Cloudflare, that
/// proxy's config must strip inbound X-Forwarded-For from the client before
/// setting its own — only then should this switch back to
/// `SmartIpKeyExtractor`, otherwise every user behind that proxy gets rate
/// limited as a single shared bucket (the peer IP is always the proxy's).
pub fn build_layer(
    burst_size: u32,
    window_secs: u64,
    message: &'static str,
) -> GovernorLayer<PeerIpKeyExtractor, NoOpMiddleware, Body> {
    let per_token_secs = (window_secs / burst_size.max(1) as u64).max(1);

    let mut builder = GovernorConfigBuilder::default();
    builder.per_second(per_token_secs).burst_size(burst_size);

    let config = builder
        .key_extractor(PeerIpKeyExtractor)
        .finish()
        .expect("rate limit burst_size/period must be non-zero");

    GovernorLayer::new(config).error_handler(move |error| match error {
        GovernorError::TooManyRequests { .. } => {
            (StatusCode::TOO_MANY_REQUESTS, Json(json!({ "error": message }))).into_response()
        }
        _ => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Rate limiting error" })),
        )
            .into_response(),
    })
}
