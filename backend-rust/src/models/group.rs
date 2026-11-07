use mongodb::bson::{oid::ObjectId, DateTime as BsonDateTime};
use serde::{Deserialize, Serialize};

/// A named pool of users that share one consignor/consignee contact list.
/// Created and assigned by a superadmin only.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Group {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub name: String,
    #[serde(rename = "createdAt", default)]
    pub created_at: Option<BsonDateTime>,
}

#[derive(Debug, Serialize)]
pub struct PublicGroup {
    pub id: String,
    pub name: String,
}

pub fn sanitize_group(group: &Group) -> PublicGroup {
    PublicGroup {
        id: group.id.to_hex(),
        name: group.name.clone(),
    }
}
