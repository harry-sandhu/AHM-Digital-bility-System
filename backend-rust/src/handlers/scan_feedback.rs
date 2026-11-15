//! What happened to each auto-filled field after a bill scan: kept, changed,
//! cleared, or filled by hand because the scan missed it. Field NAMES and
//! outcomes only — never the values or the image — so it is safe to keep and
//! shows where the reader is weak.
use crate::{
    error::AppError,
    middleware::auth::require_role,
    models::user::{Role, UserRecord},
    state::AppState,
};
use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use futures_util::TryStreamExt;
use mongodb::bson::{doc, Document, DateTime as BsonDateTime};
use serde::Deserialize;
use serde_json::json;
use std::collections::BTreeMap;
use std::sync::Arc;

const COLLECTION: &str = "scan_feedback";
const OUTCOMES: [&str; 4] = ["kept", "changed", "cleared", "missed"];
const MAX_FIELDS: usize = 80;

#[derive(Debug, Deserialize)]
pub struct ScanFeedbackBody {
    /// field name -> "kept" | "changed" | "cleared" | "missed"
    pub fields: BTreeMap<String, String>,
    /// "image" or "pdf" (optional)
    #[serde(default)]
    pub source: Option<String>,
}

/// POST /api/bilty/scan-feedback
pub async fn record_scan_feedback(
    State(state): State<Arc<AppState>>,
    current_user: UserRecord,
    Json(body): Json<ScanFeedbackBody>,
) -> Result<impl IntoResponse, AppError> {
    if body.fields.is_empty() || body.fields.len() > MAX_FIELDS {
        return Err(AppError::new(StatusCode::BAD_REQUEST, "invalid feedback"));
    }
    let mut fields = Document::new();
    for (name, outcome) in &body.fields {
        let name_ok = !name.is_empty()
            && name.len() <= 40
            && name.chars().all(|c| c.is_ascii_alphanumeric());
        if !name_ok || !OUTCOMES.contains(&outcome.as_str()) {
            return Err(AppError::new(StatusCode::BAD_REQUEST, "invalid feedback"));
        }
        fields.insert(name.clone(), outcome.clone());
    }
    let source = match body.source.as_deref() {
        Some("pdf") => "pdf",
        _ => "image",
    };
    state
        .db
        .collection::<Document>(COLLECTION)
        .insert_one(doc! {
            "userId": current_user.id,
            "at": BsonDateTime::now(),
            "source": source,
            "fields": fields,
        })
        .await?;
    Ok((StatusCode::CREATED, Json(json!({ "ok": true }))))
}

/// GET /api/bilty/scan-feedback/summary — superadmin: per field, how often
/// the scan was kept, changed, cleared or missed (latest 5000 scans).
pub async fn scan_feedback_summary(
    State(state): State<Arc<AppState>>,
    current_user: UserRecord,
) -> Result<impl IntoResponse, AppError> {
    require_role(&current_user, &[Role::Superadmin])?;
    let cursor = state
        .db
        .collection::<Document>(COLLECTION)
        .find(doc! {})
        .sort(doc! { "at": -1 })
        .limit(5000)
        .await?;
    let docs: Vec<Document> = cursor.try_collect().await?;

    let mut per_field: BTreeMap<String, [u32; 4]> = BTreeMap::new();
    for d in &docs {
        if let Ok(fields) = d.get_document("fields") {
            for (name, v) in fields {
                if let Some(idx) = v.as_str().and_then(|s| OUTCOMES.iter().position(|o| *o == s)) {
                    per_field.entry(name.clone()).or_insert([0; 4])[idx] += 1;
                }
            }
        }
    }
    let mut rows: Vec<serde_json::Value> = per_field
        .into_iter()
        .map(|(field, c)| {
            let total = c.iter().sum::<u32>().max(1);
            let wrong = c[1] + c[2] + c[3];
            json!({
                "field": field,
                "kept": c[0], "changed": c[1], "cleared": c[2], "missed": c[3],
                "fixRate": (wrong as f64 / total as f64 * 1000.0).round() / 10.0,
            })
        })
        .collect();
    rows.sort_by(|a, b| {
        b["fixRate"].as_f64().partial_cmp(&a["fixRate"].as_f64()).unwrap_or(std::cmp::Ordering::Equal)
    });
    Ok(Json(json!({ "scans": docs.len(), "fields": rows })))
}
