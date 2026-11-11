use axum::{
    body::Body,
    extract::ConnectInfo,
    http::{Request, StatusCode},
    response::IntoResponse,
    Json,
};
use governor::middleware::NoOpMiddleware;
use serde_json::json;
use std::net::{IpAddr, SocketAddr};
use tower_governor::{
    errors::GovernorError, governor::GovernorConfigBuilder, key_extractor::KeyExtractor,
    GovernorLayer,
};

/// Rate-limit key: the real client address.
///
/// Normally that is the TCP peer. When the peer is a *local or private-network*
/// address (our reverse proxy, e.g. Caddy in the same Docker network or on
/// localhost), the client address is read from the **last** `X-Forwarded-For`
/// entry, which is the one the proxy itself appended. Earlier entries are
/// client-controlled and ignored. A request that reaches us directly from a
/// public address can't use the header at all, so it can't pick its own bucket.
///
/// Without this, everyone behind the proxy would share one bucket (the proxy's
/// address) and a handful of logins would lock out all users.
#[derive(Clone, Copy, Debug)]
pub struct TrustedProxyIpKeyExtractor;

fn is_private_peer(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => v4.is_loopback() || v4.is_private(),
        IpAddr::V6(v6) => v6.is_loopback() || (v6.segments()[0] & 0xfe00) == 0xfc00,
    }
}

impl KeyExtractor for TrustedProxyIpKeyExtractor {
    type Key = IpAddr;

    fn extract<T>(&self, req: &Request<T>) -> Result<Self::Key, GovernorError> {
        let peer = req
            .extensions()
            .get::<ConnectInfo<SocketAddr>>()
            .map(|info| info.0.ip())
            .ok_or(GovernorError::UnableToExtractKey)?;

        if is_private_peer(peer) {
            let forwarded = req
                .headers()
                .get("x-forwarded-for")
                .and_then(|value| value.to_str().ok())
                .and_then(|value| value.rsplit(',').next())
                .and_then(|last| last.trim().parse::<IpAddr>().ok());
            if let Some(client) = forwarded {
                return Ok(client);
            }
        }

        Ok(peer)
    }
}

/// `express-rate-limit`'s three limiters in backend/src/server.ts (plus the
/// bill-extraction one added this session) use a fixed 15-minute window
/// counting up to N requests. `governor`'s token bucket instead replenishes
/// continuously — same long-run rate, no hard reset edge. Close enough for
/// abuse protection; not bit-for-bit identical to Node's windowing.
///
/// Key extractor is `TrustedProxyIpKeyExtractor` (see above): the TCP peer, or
/// — only when that peer is a local/private reverse proxy — the client address
/// the proxy appended to `X-Forwarded-For`. (The stock `SmartIpKeyExtractor`
/// trusts that header from anyone, which would let a client pick a fresh
/// bucket per request.)
pub fn build_layer(
    burst_size: u32,
    window_secs: u64,
    message: &'static str,
) -> GovernorLayer<TrustedProxyIpKeyExtractor, NoOpMiddleware, Body> {
    let per_token_secs = (window_secs / burst_size.max(1) as u64).max(1);

    let mut builder = GovernorConfigBuilder::default();
    builder.per_second(per_token_secs).burst_size(burst_size);

    let config = builder
        .key_extractor(TrustedProxyIpKeyExtractor)
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

#[cfg(test)]
mod tests {
    use super::*;

    fn request(peer: &str, forwarded: Option<&str>) -> Request<()> {
        let mut builder = Request::builder();
        if let Some(value) = forwarded {
            builder = builder.header("x-forwarded-for", value);
        }
        let mut req = builder.body(()).unwrap();
        req.extensions_mut()
            .insert(ConnectInfo(format!("{peer}:50000").parse::<SocketAddr>().unwrap()));
        req
    }

    fn key(req: &Request<()>) -> String {
        TrustedProxyIpKeyExtractor.extract(req).unwrap().to_string()
    }

    #[test]
    fn behind_a_private_proxy_each_client_gets_its_own_key() {
        assert_eq!(key(&request("172.18.0.3", Some("203.0.113.7"))), "203.0.113.7");
        assert_eq!(key(&request("127.0.0.1", Some("203.0.113.8"))), "203.0.113.8");
    }

    #[test]
    fn only_the_proxy_appended_entry_counts() {
        // a client-supplied first entry must not choose the bucket
        assert_eq!(key(&request("172.18.0.3", Some("1.1.1.1, 203.0.113.7"))), "203.0.113.7");
    }

    #[test]
    fn a_public_peer_cannot_use_the_header() {
        assert_eq!(key(&request("198.51.100.9", Some("203.0.113.7"))), "198.51.100.9");
    }

    #[test]
    fn missing_or_garbage_header_falls_back_to_the_peer() {
        assert_eq!(key(&request("172.18.0.3", None)), "172.18.0.3");
        assert_eq!(key(&request("172.18.0.3", Some("not-an-ip"))), "172.18.0.3");
    }
}
