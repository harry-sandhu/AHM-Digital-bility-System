use crate::utils::ocr::OcrPool;
use mongodb::Database;
use pdfium_render::prelude::Pdfium;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub jwt_secret: String,
    pub allowed_origins: Vec<String>,
    pub ocr_pool: Arc<OcrPool>,
    /// `None` when pdfium couldn't be loaded at startup — PDF bill-scans
    /// degrade gracefully (a clear error) rather than the whole server
    /// refusing to boot just because PDF support is unavailable; image
    /// uploads are unaffected either way.
    pub pdfium: Option<Arc<Pdfium>>,
}
