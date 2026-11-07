use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

/// backend/src/models/BiltyCounter.ts
#[derive(Debug, Serialize, Deserialize)]
pub struct BiltyCounter {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub prefix: String,
    #[serde(default)]
    pub counter: i64,
}
