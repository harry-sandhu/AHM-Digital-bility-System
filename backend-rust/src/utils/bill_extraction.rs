use once_cell::sync::Lazy;
use regex::{Regex, RegexBuilder};
use serde::Serialize;
use std::collections::BTreeSet;

/// Direct port of backend/src/utils/billExtraction.ts — same regexes, same
/// label-based heuristics, same best-effort/no-guarantees extraction. See
/// that file's own comments for why this is heuristic rather than exact.
#[derive(Debug, Default, Serialize)]
pub struct ExtractedBillFields {
    #[serde(rename = "invoiceNoDate", skip_serializing_if = "Option::is_none")]
    pub invoice_no_date: Option<String>,
    #[serde(rename = "invoiceDate", skip_serializing_if = "Option::is_none")]
    pub invoice_date: Option<String>,
    #[serde(rename = "consignorAddress", skip_serializing_if = "Option::is_none")]
    pub consignor_address: Option<String>,
    #[serde(rename = "consignorGstin", skip_serializing_if = "Option::is_none")]
    pub consignor_gstin: Option<String>,
    #[serde(rename = "consigneeAddress", skip_serializing_if = "Option::is_none")]
    pub consignee_address: Option<String>,
    #[serde(rename = "consigneeGstin", skip_serializing_if = "Option::is_none")]
    pub consignee_gstin: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub packages: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(rename = "actualWt", skip_serializing_if = "Option::is_none")]
    pub actual_wt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub amount: Option<String>,
    #[serde(rename = "declaredValue", skip_serializing_if = "Option::is_none")]
    pub declared_value: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub freight: Option<String>,
}

impl ExtractedBillFields {
    pub fn is_empty(&self) -> bool {
        self.invoice_no_date.is_none()
            && self.invoice_date.is_none()
            && self.consignor_address.is_none()
            && self.consignor_gstin.is_none()
            && self.consignee_address.is_none()
            && self.consignee_gstin.is_none()
            && self.packages.is_none()
            && self.description.is_none()
            && self.actual_wt.is_none()
            && self.amount.is_none()
            && self.declared_value.is_none()
            && self.freight.is_none()
    }
}

static GSTIN_REGEX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\b\d{2}[A-Za-z]{5}\d{4}[A-Za-z]\d[Zz][A-Za-z\d]\b").unwrap());
static DATE_REGEX: Lazy<Regex> = Lazy::new(|| Regex::new(r"\b(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})\b").unwrap());
static AMOUNT_REGEX: Lazy<Regex> = Lazy::new(|| {
    RegexBuilder::new(r"(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)")
        .case_insensitive(true)
        .build()
        .unwrap()
});
static PLAIN_NUMBER_REGEX: Lazy<Regex> = Lazy::new(|| Regex::new(r"([\d,]+(?:\.\d{1,2})?)").unwrap());

fn case_insensitive(pattern: &str) -> Regex {
    RegexBuilder::new(pattern).case_insensitive(true).build().unwrap()
}

fn clean_line(line: &str) -> String {
    line.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn split_lines(text: &str) -> Vec<String> {
    text.lines().map(clean_line).filter(|l| !l.is_empty()).collect()
}

/// Looks for a label and returns whatever follows it on the same line, or
/// failing that, the next non-label line below it. Bills have no fixed
/// layout, so this is a best-effort heuristic, not a guarantee.
fn find_after_label(lines: &[String], label_patterns: &[Regex], max_lookahead: usize) -> Option<String> {
    for (i, line) in lines.iter().enumerate() {
        for pattern in label_patterns {
            let Some(m) = pattern.find(line) else { continue };

            // `.replace(/^[:\-–]\s*/, "")` in the Node original strips at
            // most ONE leading separator char, then any whitespace after
            // it — not every leading separator/whitespace char repeatedly.
            let rest = &line[m.end()..];
            let after_separator = match rest.strip_prefix([':', '-', '–']) {
                Some(stripped) => stripped.trim_start(),
                None => rest,
            };
            let after_match = after_separator.trim();
            if !after_match.is_empty() {
                return Some(after_match.to_string());
            }

            for lookahead in 1..=max_lookahead {
                if let Some(next_line) = lines.get(i + lookahead) {
                    if !label_patterns.iter().any(|p| p.is_match(next_line)) {
                        return Some(next_line.clone());
                    }
                }
            }
        }
    }

    None
}

fn find_all_gstins(text: &str) -> Vec<String> {
    let mut seen = BTreeSet::new();
    let mut ordered = Vec::new();
    for m in GSTIN_REGEX.find_iter(text) {
        let upper = m.as_str().to_uppercase();
        if seen.insert(upper.clone()) {
            ordered.push(upper);
        }
    }
    ordered
}

fn capture_amount(text: &str) -> Option<String> {
    let captured = AMOUNT_REGEX
        .captures(text)
        .or_else(|| PLAIN_NUMBER_REGEX.captures(text))?;
    Some(captured.get(1)?.as_str().replace(',', ""))
}

pub fn extract_bill_fields(raw_text: &str) -> ExtractedBillFields {
    let lines = split_lines(raw_text);
    let mut extracted = ExtractedBillFields::default();

    let gstins = find_all_gstins(raw_text);
    extracted.consignor_gstin = gstins.first().cloned();
    extracted.consignee_gstin = gstins.get(1).cloned();

    let invoice_no_patterns = [
        case_insensitive(r"invoice\s*(no\.?|number|#)"),
        case_insensitive(r"\bbill\s*(no\.?|number)\b"),
    ];
    extracted.invoice_no_date = find_after_label(&lines, &invoice_no_patterns, 2);

    let invoice_date_patterns = [
        case_insensitive(r"invoice\s*date"),
        case_insensitive(r"\bbill\s*date\b"),
        case_insensitive(r"\bdated\b"),
    ];
    extracted.invoice_date = find_after_label(&lines, &invoice_date_patterns, 2)
        .and_then(|line| DATE_REGEX.captures(&line).map(|c| c[1].to_string()));

    let consignor_patterns = [
        case_insensitive(r"\bconsignor\b"),
        case_insensitive(r"\bseller\b"),
        case_insensitive(r"\bsold\s*by\b"),
        case_insensitive(r"\bbilled\s*by\b"),
    ];
    extracted.consignor_address = find_after_label(&lines, &consignor_patterns, 2);

    let consignee_patterns = [
        case_insensitive(r"\bconsignee\b"),
        case_insensitive(r"\bship(ped)?\s*to\b"),
        case_insensitive(r"\bbill(ed)?\s*to\b"),
        case_insensitive(r"\bbuyer\b"),
    ];
    extracted.consignee_address = find_after_label(&lines, &consignee_patterns, 2);

    let package_patterns = [
        case_insensitive(r"no\.?\s*of\s*packages?"),
        case_insensitive(r"\bpackages?\b"),
        case_insensitive(r"\bpkgs?\b"),
        case_insensitive(r"\bqty\b"),
    ];
    extracted.packages = find_after_label(&lines, &package_patterns, 2);

    let description_patterns = [
        case_insensitive(r"description\s*of\s*goods"),
        case_insensitive(r"\bparticulars\b"),
        case_insensitive(r"item\s*description"),
    ];
    extracted.description = find_after_label(&lines, &description_patterns, 2);

    let weight_patterns = [
        case_insensitive(r"net\s*weight"),
        case_insensitive(r"gross\s*weight"),
        case_insensitive(r"\bweight\b"),
        case_insensitive(r"\bwt\.?\b"),
    ];
    extracted.actual_wt = find_after_label(&lines, &weight_patterns, 2);

    let taxable_patterns = [
        case_insensitive(r"taxable\s*value"),
        case_insensitive(r"\btaxable\s*amount\b"),
    ];
    extracted.amount = find_after_label(&lines, &taxable_patterns, 2).and_then(|line| capture_amount(&line));

    let total_patterns = [
        case_insensitive(r"grand\s*total"),
        case_insensitive(r"total\s*amount"),
        case_insensitive(r"invoice\s*value"),
    ];
    extracted.declared_value = find_after_label(&lines, &total_patterns, 2).and_then(|line| capture_amount(&line));

    let freight_patterns = [case_insensitive(r"freight"), case_insensitive(r"transport\s*charges?")];
    extracted.freight = find_after_label(&lines, &freight_patterns, 2).and_then(|line| capture_amount(&line));

    extracted
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The same sample invoice used to validate billExtraction.ts's
    /// original port this session — same input, expect the same fields.
    #[test]
    fn extracts_fields_from_a_realistic_invoice() {
        let sample = "\
TAX INVOICE
ABC Traders Pvt Ltd
Invoice No: INV-2024-0456
Invoice Date: 12/03/2024
GSTIN: 07AAACB1234C1Z5

Consignor:
ABC Traders Pvt Ltd, Plot 12, Industrial Area, Delhi

Consignee:
XYZ Enterprises, 45 MG Road, Mumbai
GSTIN 27AAACX5678D1Z3

Description of Goods: Cotton Fabric Rolls
No. of Packages: 25
Net Weight: 1200 kg

Taxable Value: Rs. 85,000.00
Freight: Rs. 2,500
Grand Total: ₹ 95,300.00
";

        let extracted = extract_bill_fields(sample);

        assert_eq!(extracted.consignor_gstin, Some("07AAACB1234C1Z5".to_string()));
        assert_eq!(extracted.consignee_gstin, Some("27AAACX5678D1Z3".to_string()));
        assert_eq!(extracted.invoice_no_date, Some("INV-2024-0456".to_string()));
        assert_eq!(extracted.invoice_date, Some("12/03/2024".to_string()));
        assert_eq!(
            extracted.consignor_address,
            Some("ABC Traders Pvt Ltd, Plot 12, Industrial Area, Delhi".to_string())
        );
        assert_eq!(
            extracted.consignee_address,
            Some("XYZ Enterprises, 45 MG Road, Mumbai".to_string())
        );
        assert_eq!(extracted.packages, Some("25".to_string()));
        assert_eq!(extracted.description, Some("Cotton Fabric Rolls".to_string()));
        assert_eq!(extracted.actual_wt, Some("1200 kg".to_string()));
        assert_eq!(extracted.amount, Some("85000.00".to_string()));
        assert_eq!(extracted.declared_value, Some("95300.00".to_string()));
        assert_eq!(extracted.freight, Some("2500".to_string()));
    }

    #[test]
    fn empty_text_yields_no_fields() {
        assert!(extract_bill_fields("").is_empty());
    }
}
