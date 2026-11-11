mod config;
mod db;
mod error;
mod handlers;
mod middleware;
mod models;
mod routes;
mod seeder;
mod state;
mod utils;

use axum::{http::HeaderValue, response::Json, routing::get, Router};
use config::Config;
use serde_json::{json, Value};
use state::AppState;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tracing_subscriber::EnvFilter;

async fn health() -> Json<Value> {
    // Commit may also come from the host at runtime (e.g. Render sets RENDER_GIT_COMMIT).
    let commit = match option_env!("BUILD_COMMIT") {
        Some(c) if c != "unknown" => c.to_string(),
        _ => std::env::var("RENDER_GIT_COMMIT")
            .map(|v| v.chars().take(7).collect())
            .unwrap_or_else(|_| "unknown".to_string()),
    };
    Json(json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION"),
        "commit": commit,
        // Lets us confirm a deploy really contains a feature.
        "features": ["transporter-gst-5pct", "gst-credit", "terms-print", "invoice-scan"],
    }))
}

async fn root() -> &'static str {
    "server running ok"
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .init();

    let config = Config::load()?;

    let db = db::connect(&config.mongo_uri).await?;
    db::ensure_indexes(&db).await?;
    tracing::info!("MongoDB connected");

    if let Err(err) = handlers::contacts::backfill_from_bilties(&db).await {
        tracing::warn!(error = %err, "suggestion backfill failed (will retry next start)");
    }

    seeder::seed_superadmin(
        &db,
        config.superadmin_phone.as_deref(),
        config.superadmin_password.as_deref(),
    )
    .await?;

    let ocr_pool = Arc::new(utils::ocr::OcrPool::new(2)?);
    tracing::info!("OCR worker pool ready");

    let pdfium = match utils::ocr::load_pdfium() {
        Ok(pdfium) => Some(Arc::new(pdfium)),
        Err(err) => {
            tracing::warn!(error = %err, "pdfium library not available — PDF bill-scans will be disabled, image bill-scans are unaffected");
            None
        }
    };

    let ocr_service = match config.ocr_service_url.as_deref() {
        Some(url) => {
            tracing::info!(%url, "OCR service configured for invoice scanning");
            Some(utils::ocr_service::OcrServiceClient::new(url, config.ocr_service_key.clone())?)
        }
        None => None,
    };

    let state = Arc::new(AppState {
        db,
        jwt_secret: config.jwt_secret.clone(),
        allowed_origins: config.allowed_origins.clone(),
        ocr_pool,
        pdfium,
        ocr_service,
    });

    let cors = build_cors_layer(&config.allowed_origins);
    let origin_guard =
        axum::middleware::from_fn_with_state(state.clone(), middleware::cors::enforce_allowed_origin);

    let app = Router::new()
        .route("/", get(root))
        .route("/api/health", get(health))
        .nest("/api/auth", routes::auth::router())
        .nest("/api/users", routes::users::router())
        .nest("/api/number-ranges", routes::number_ranges::router())
        .nest("/api/bilty", routes::bilty::router())
        .nest("/api/contacts", routes::contacts::router())
        .nest("/api/groups", routes::groups::router())
        .with_state(state)
        // `cors` sets Access-Control-* headers for allowed requests;
        // `origin_guard` wraps it and rejects disallowed-but-present
        // Origins before they reach `cors` or any route at all.
        .layer(cors)
        .layer(origin_guard);

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", config.port)).await?;
    tracing::info!(port = config.port, "server listening");

    // Needed so the rate limiter's PeerIpKeyExtractor can read the real
    // peer address for each connection.
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await?;

    Ok(())
}

/// Mirrors the current Node CORS allow-list behavior (backend/src/server.ts):
/// non-browser requests with no Origin header are allowed through, requests
/// with an Origin not in the configured list are rejected.
fn build_cors_layer(allowed_origins: &[String]) -> CorsLayer {
    let origins: Vec<HeaderValue> = allowed_origins
        .iter()
        .filter_map(|origin| origin.parse().ok())
        .collect();

    CorsLayer::new()
        .allow_origin(origins)
        .allow_methods(tower_http::cors::Any)
        .allow_headers(tower_http::cors::Any)
}

/// Render sends SIGTERM on every deploy/restart; the Node backend has no
/// handler for this today (a known gap from the earlier audit) and this
/// Rust port should not carry that gap forward.
async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("shutdown signal received, draining connections");
}
