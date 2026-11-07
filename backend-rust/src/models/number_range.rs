use mongodb::bson::{oid::ObjectId, DateTime as BsonDateTime};
use serde::{Deserialize, Serialize};

/// backend/src/models/NumberRange.ts
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NumberRangeScope {
    Master,
    Personal,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NumberRange {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    #[serde(default)]
    pub label: Option<String>,
    pub scope: NumberRangeScope,
    #[serde(rename = "userId", default)]
    pub user_id: Option<ObjectId>,
    #[serde(rename = "rangeStart")]
    pub range_start: i64,
    #[serde(rename = "rangeEnd")]
    pub range_end: i64,
    #[serde(rename = "nextNumber")]
    pub next_number: i64,
    #[serde(rename = "isExhausted", default)]
    pub is_exhausted: bool,
    #[serde(rename = "isActive", default = "default_true")]
    pub is_active: bool,
    #[serde(rename = "createdBy")]
    pub created_by: ObjectId,
    #[serde(rename = "createdAt", default)]
    pub created_at: Option<BsonDateTime>,
}

impl NumberRange {
    /// backend/src/controllers/numberRangeController.ts's `serializeRange`'s
    /// `remaining` computation, ported verbatim.
    pub fn remaining(&self) -> i64 {
        (self.range_end - self.next_number + 1).max(0)
    }
}
