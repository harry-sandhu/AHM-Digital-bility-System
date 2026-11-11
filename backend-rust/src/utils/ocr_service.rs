use serde_json::Value;
use std::time::Duration;

/// Client for the local OCR service (`ocr-service/`, running on the same
/// machine). It reads photographed tax invoices by position and returns
/// bilty form values. Optional: when `OCR_SERVICE_URL` is unset, or the
/// service is down, bill scanning falls back to the built-in Tesseract path.
#[derive(Clone)]
pub struct OcrServiceClient {
    client: reqwest::Client,
    url: String,
    key: Option<String>,
}

pub struct ServiceExtraction {
    /// Form field values, keyed like `BiltyFormState`.
    pub fields: serde_json::Map<String, Value>,
    pub warnings: Vec<String>,
    /// Fields confirmed by the invoice's own QR code.
    pub verified: Vec<String>,
    /// Reasons the photo should be retaken (blurry, too dark, too small). When
    /// non-empty, no fields were read.
    pub retake: Vec<String>,
    pub raw_text: String,
}

impl OcrServiceClient {
    pub fn new(base_url: &str, key: Option<String>) -> anyhow::Result<Self> {
        let client = reqwest::Client::builder()
            // A cold first request loads the models; generous but bounded.
            .timeout(Duration::from_secs(90))
            .connect_timeout(Duration::from_secs(3))
            .build()?;
        Ok(Self {
            client,
            url: format!("{}/extract", base_url.trim_end_matches('/')),
            key,
        })
    }

    pub async fn extract(&self, image: Vec<u8>, content_type: &str) -> Result<ServiceExtraction, String> {
        let mut request = self
            .client
            .post(&self.url)
            .header("Content-Type", content_type)
            .body(image);
        if let Some(key) = &self.key {
            request = request.header("X-OCR-Key", key);
        }

        let response = request.send().await.map_err(|err| format!("request failed: {err}"))?;
        let status = response.status();
        let body = response.bytes().await.map_err(|err| format!("reading response failed: {err}"))?;
        if !status.is_success() {
            return Err(format!("service answered {status}"));
        }

        let value: Value = serde_json::from_slice(&body).map_err(|err| format!("bad JSON: {err}"))?;
        Ok(ServiceExtraction {
            fields: value
                .get("fields")
                .and_then(Value::as_object)
                .cloned()
                .unwrap_or_default(),
            warnings: strings(&value, "warnings"),
            verified: strings(&value, "verified"),
            retake: strings(&value, "retake"),
            raw_text: value
                .get("rawText")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string(),
        })
    }
}

fn strings(value: &Value, key: &str) -> Vec<String> {
    value
        .get(key)
        .and_then(Value::as_array)
        .map(|items| items.iter().filter_map(|v| v.as_str().map(str::to_string)).collect())
        .unwrap_or_default()
}
