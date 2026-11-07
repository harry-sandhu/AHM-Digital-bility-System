use crate::error::AppError;
use axum::http::StatusCode;
use leptess::LepTess;
use pdfium_render::prelude::*;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};
use tokio::sync::Mutex;

/// Digital PDFs have an embedded text layer we can read directly; below
/// this length it's treated as likely scanned (matches the Node version's
/// `MIN_PDF_TEXT_LENGTH` in backend/src/controllers/biltyController.ts).
const MIN_PDF_TEXT_LENGTH: usize = 40;

/// Unlike the Node version (which OCRs every page of a scanned PDF with no
/// limit), cap how many pages get rendered+OCR'd in one request — a fix
/// flagged in the migration audit, since an uncapped multi-page PDF can
/// trigger dozens of sequential OCR passes in a single upload.
const MAX_OCR_PDF_PAGES: usize = 5;

const PDF_RENDER_SCALE: f32 = 2.0;

/// Neither Tesseract/Leptonica nor pdfium cap how large a bitmap they'll
/// allocate for a declared image size — a tiny but maliciously crafted file
/// (a few KB claiming a huge pixel count, the classic "decompression bomb"
/// pattern) can trigger a multi-gigabyte allocation. Not present in the
/// Node version either, but worth closing here rather than carrying the gap
/// forward: ~40 megapixels comfortably covers any real photo or scan.
const MAX_IMAGE_PIXELS: u64 = 40_000_000;

/// Clamp applied to our own PDF-page render target size (computed from the
/// page's declared dimensions × `PDF_RENDER_SCALE`) — a PDF can declare an
/// arbitrarily large page size, which would otherwise make us ask pdfium to
/// allocate an arbitrarily large bitmap.
const MAX_PDF_RENDER_DIMENSION: i32 = 4000;

fn check_image_dimensions(bytes: &[u8]) -> Result<(), AppError> {
    let reader = image::ImageReader::new(std::io::Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|_| AppError::new(StatusCode::BAD_REQUEST, "Could not read the uploaded image"))?;

    let (width, height) = reader
        .into_dimensions()
        .map_err(|_| AppError::new(StatusCode::BAD_REQUEST, "Could not read the uploaded image"))?;

    if (width as u64) * (height as u64) > MAX_IMAGE_PIXELS {
        return Err(AppError::new(
            StatusCode::BAD_REQUEST,
            "Image dimensions are too large",
        ));
    }

    Ok(())
}

/// A small fixed-size pool of reused `LepTess` instances — the fix for the
/// Node version's "spin up and tear down a fresh tesseract.js worker on
/// every request" inefficiency (also flagged in the audit). `LepTess` is
/// `Send` but not `Sync` (confirmed in tesseract-plumbing: `unsafe impl
/// Send for TessBaseApi`, no matching `Sync` impl), so each worker is
/// guarded by its own async mutex rather than shared directly; a simple
/// round-robin picks which worker a given request waits on.
pub struct OcrPool {
    workers: Vec<Arc<Mutex<LepTess>>>,
    next: AtomicUsize,
}

impl OcrPool {
    pub fn new(size: usize) -> anyhow::Result<Self> {
        let mut workers = Vec::with_capacity(size);
        for _ in 0..size.max(1) {
            let worker = LepTess::new(None, "eng")
                .map_err(|err| anyhow::anyhow!("failed to initialize OCR worker: {err}"))?;
            workers.push(Arc::new(Mutex::new(worker)));
        }

        Ok(Self {
            workers,
            next: AtomicUsize::new(0),
        })
    }

    pub async fn ocr_image_bytes(&self, bytes: &[u8]) -> Result<String, AppError> {
        check_image_dimensions(bytes)?;

        let index = self.next.fetch_add(1, Ordering::Relaxed) % self.workers.len();
        let worker = Arc::clone(&self.workers[index]);
        let mut guard = worker.lock().await;

        guard
            .set_image_from_mem(bytes)
            .map_err(|_| AppError::new(StatusCode::BAD_REQUEST, "Could not read the uploaded image"))?;

        guard
            .get_utf8_text()
            .map_err(|_| AppError::internal("Failed to read the uploaded bill"))
    }
}

/// Mirrors `extractTextFromPdf` in backend/src/controllers/biltyController.ts:
/// try the embedded text layer first via pdfium-render (the closest Rust
/// equivalent of `pdf-parse`'s `getText()`), and only fall back to
/// rendering+OCR-ing pages (pdfium-render's `page.render()`, the equivalent
/// of `pdf-parse`'s `getScreenshot()`) when that comes back too short —
/// i.e. likely a scanned PDF with no text layer.
pub async fn extract_text_from_pdf(
    pdfium: &Pdfium,
    ocr_pool: &OcrPool,
    bytes: Vec<u8>,
) -> Result<String, AppError> {
    let document = pdfium
        .load_pdf_from_byte_vec(bytes, None)
        .map_err(|_| AppError::new(StatusCode::BAD_REQUEST, "Could not read the uploaded PDF"))?;

    let combined_text: String = document
        .pages()
        .iter()
        .filter_map(|page| page.text().ok().map(|text| text.all()))
        .collect::<Vec<_>>()
        .join("\n");

    if combined_text.trim().chars().count() >= MIN_PDF_TEXT_LENGTH {
        return Ok(combined_text);
    }

    let page_count = document.pages().len() as usize;
    let pages_to_render = page_count.min(MAX_OCR_PDF_PAGES);

    let mut page_texts = Vec::with_capacity(pages_to_render);
    for index in 0..pages_to_render {
        let page = document
            .pages()
            .get(index as i32)
            .map_err(|_| AppError::internal("Failed to read the uploaded bill"))?;

        let width = ((page.width().value * PDF_RENDER_SCALE).round() as i32).clamp(1, MAX_PDF_RENDER_DIMENSION);
        let height = ((page.height().value * PDF_RENDER_SCALE).round() as i32).clamp(1, MAX_PDF_RENDER_DIMENSION);

        let bitmap = page
            .render(width, height, None)
            .map_err(|_| AppError::internal("Failed to read the uploaded bill"))?;

        let image = bitmap
            .as_image()
            .map_err(|_| AppError::internal("Failed to read the uploaded bill"))?;

        let mut png_bytes = Vec::new();
        image
            .write_to(&mut std::io::Cursor::new(&mut png_bytes), image::ImageFormat::Png)
            .map_err(|_| AppError::internal("Failed to read the uploaded bill"))?;

        page_texts.push(ocr_pool.ocr_image_bytes(&png_bytes).await?);
    }

    Ok(page_texts.join("\n"))
}

/// Loads the external pdfium library. Tries `PDFIUM_LIB_PATH` first (set
/// this to an explicit `libpdfium.so`/`.dylib`/`.dll` path — useful for
/// local development, and for a Docker image that bundles its own copy
/// rather than relying on a system package), falling back to whatever the
/// system library search finds.
pub fn load_pdfium() -> anyhow::Result<Pdfium> {
    let bindings = if let Ok(path) = std::env::var("PDFIUM_LIB_PATH") {
        Pdfium::bind_to_library(&path)
            .map_err(|err| anyhow::anyhow!("failed to load pdfium library at {path}: {err}"))?
    } else {
        Pdfium::bind_to_system_library()
            .map_err(|err| anyhow::anyhow!("failed to load system pdfium library: {err}"))?
    };

    Ok(Pdfium::new(bindings))
}
