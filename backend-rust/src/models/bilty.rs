use mongodb::bson::{oid::ObjectId, DateTime as BsonDateTime, Document};
use serde::{Deserialize, Serialize};

/// backend/src/models/bilty.ts
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BiltyStatus {
    Draft,
    Expired,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bilty {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    #[serde(rename = "biltyNumber")]
    pub bilty_number: String,
    #[serde(rename = "consignmentNo", default)]
    pub consignment_no: Option<i64>,
    #[serde(rename = "createdBy")]
    pub created_by: ObjectId,
    /// Kept as a raw `Document` (not a rigid struct) so a freshly-generated
    /// bilty's literal `formData: {}` (empty, zero keys — see
    /// backend/src/controllers/biltyController.ts's `generateBilty`) round-trips
    /// exactly; `updateBilty`'s handler builds the replacement document with
    /// per-field type/length validation instead (see handlers/bilty.rs).
    #[serde(rename = "formData", default)]
    pub form_data: Document,
    #[serde(default)]
    pub status: Option<BiltyStatus>,
    #[serde(rename = "paymentAmount", default)]
    pub payment_amount: Option<f64>,
    #[serde(rename = "paymentPaidAt", default)]
    pub payment_paid_at: Option<BsonDateTime>,
    #[serde(rename = "paymentExpiresAt", default)]
    pub payment_expires_at: Option<BsonDateTime>,
    #[serde(rename = "expiresAt", default)]
    pub expires_at: Option<BsonDateTime>,
    /// Signed difference between the fee for the bilty's current freight
    /// and the fee originally paid (`paymentAmount`): positive = extra
    /// charge, negative = discount.
    #[serde(rename = "freightAdjustment", default)]
    pub freight_adjustment: Option<f64>,
    /// Highest extra charge the user has already confirmed/paid.
    #[serde(rename = "extraPaid", default)]
    pub extra_paid: Option<f64>,
    /// GST charge paid for this bilty when the Transporter pays the GST
    /// (5% of its freight). Raised/lowered as the freight changes.
    #[serde(rename = "gstChargePaid", default)]
    pub gst_charge_paid: Option<f64>,
    /// Set the first time the bilty is printed. After this only a
    /// superadmin may change it (and each change keeps a backup).
    #[serde(rename = "printedAt", default)]
    pub printed_at: Option<BsonDateTime>,
    #[serde(rename = "createdAt", default)]
    pub created_at: Option<BsonDateTime>,
}

/// Lean projection used only by the consignment-number allocator (which
/// only ever needs `consignmentNo`) — the full `Bilty` struct can't be
/// reused there since a `{consignmentNo: 1}` projection omits required
/// fields like `biltyNumber`/`createdBy`.
#[derive(Debug, Deserialize)]
pub struct ConsignmentNoOnly {
    #[serde(rename = "consignmentNo", default)]
    pub consignment_no: Option<i64>,
}
