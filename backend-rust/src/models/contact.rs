use mongodb::bson::{oid::ObjectId, DateTime as BsonDateTime};
use serde::{Deserialize, Serialize};

/// A saved consignor or consignee entry, auto-collected from bilty saves.
/// Exactly one of `user_id`/`group_id` is set at a time: unscoped users
/// (no group) get a personal list keyed by `user_id`; once a superadmin
/// assigns a user to a group, their contacts are re-scoped to `group_id`
/// instead (see `assign_user_to_group`), and every member of that group
/// shares the same pool from then on.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ContactKind {
    Consignor,
    Consignee,
    /// Reusable "method of packing" text (stored in `address`).
    Packing,
    /// Reusable delivery-address text (stored in `address`).
    Delivery,
}

pub fn kind_str(kind: ContactKind) -> &'static str {
    match kind {
        ContactKind::Consignor => "consignor",
        ContactKind::Consignee => "consignee",
        ContactKind::Packing => "packing",
        ContactKind::Delivery => "delivery",
    }
}

pub fn parse_kind(raw: &str) -> Option<ContactKind> {
    match raw {
        "consignor" => Some(ContactKind::Consignor),
        "consignee" => Some(ContactKind::Consignee),
        "packing" => Some(ContactKind::Packing),
        "delivery" => Some(ContactKind::Delivery),
        _ => None,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Contact {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub kind: ContactKind,
    pub address: String,
    #[serde(default)]
    pub gstin: Option<String>,
    #[serde(rename = "userId", default)]
    pub user_id: Option<ObjectId>,
    #[serde(rename = "groupId", default)]
    pub group_id: Option<ObjectId>,
    #[serde(rename = "createdAt", default)]
    pub created_at: Option<BsonDateTime>,
}

#[derive(Debug, Serialize)]
pub struct PublicContact {
    pub id: String,
    pub address: String,
    pub gstin: Option<String>,
}

pub fn sanitize_contact(contact: &Contact) -> PublicContact {
    PublicContact {
        id: contact.id.to_hex(),
        address: contact.address.clone(),
        gstin: contact.gstin.clone(),
    }
}
