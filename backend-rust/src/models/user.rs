use mongodb::bson::{oid::ObjectId, DateTime as BsonDateTime};
use serde::{Deserialize, Serialize};

/// Matches the Mongoose enum ["superadmin", "admin", "user"] exactly
/// (backend/src/models/User.ts).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    Superadmin,
    Admin,
    User,
}

fn default_true() -> bool {
    true
}

/// Full user document, including the password hash. Only used where the
/// hash is actually needed (register/login) — never returned to a client
/// and never used for the auth middleware's user lookup (see
/// `UserRecord` below, which projects it out at the query level per the
/// Module 1 fix: the Node version loads the full doc on every request and
/// just happens to never leak it downstream).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub name: String,
    pub phone: String,
    pub password: String,
    #[serde(default)]
    pub role: Role,
    #[serde(rename = "isActive", default = "default_true")]
    pub is_active: bool,
    #[serde(rename = "biltyAccessPaidAt", default)]
    pub bilty_access_paid_at: Option<BsonDateTime>,
    #[serde(rename = "biltyAccessExpiresAt", default)]
    pub bilty_access_expires_at: Option<BsonDateTime>,
    #[serde(rename = "biltyAccessAmount", default)]
    pub bilty_access_amount: Option<f64>,
    #[serde(rename = "biltyAccessFreightAmount", default)]
    pub bilty_access_freight_amount: Option<f64>,
    /// Money credited back (e.g. a lower GST charge after freight was reduced),
    /// deducted from the user's next payments.
    #[serde(rename = "creditBalance", default)]
    pub credit_balance: Option<f64>,
    /// Set once a superadmin assigns this user to a shared contacts group
    /// (see models::group); unset means they have their own personal
    /// consignor/consignee contact list.
    #[serde(rename = "groupId", default)]
    pub group_id: Option<mongodb::bson::oid::ObjectId>,
    /// Mongoose's `{timestamps: true}` stamps this on every created
    /// document, including via register — must be set at construction
    /// time, not left to a DB default, since `getAllUsers` sorts by it.
    #[serde(rename = "createdAt", default)]
    pub created_at: Option<BsonDateTime>,
}

impl Default for Role {
    fn default() -> Self {
        Role::User
    }
}

/// The "current authenticated user" shape — identical to `User` but with
/// `password` projected out at the Mongo query level. This is what the auth
/// extractor loads and what every handler downstream treats as `req.user`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserRecord {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub name: String,
    pub phone: String,
    #[serde(default)]
    pub role: Role,
    #[serde(rename = "isActive", default = "default_true")]
    pub is_active: bool,
    #[serde(rename = "biltyAccessPaidAt", default)]
    pub bilty_access_paid_at: Option<BsonDateTime>,
    #[serde(rename = "biltyAccessExpiresAt", default)]
    pub bilty_access_expires_at: Option<BsonDateTime>,
    #[serde(rename = "biltyAccessAmount", default)]
    pub bilty_access_amount: Option<f64>,
    #[serde(rename = "biltyAccessFreightAmount", default)]
    pub bilty_access_freight_amount: Option<f64>,
    #[serde(rename = "creditBalance", default)]
    pub credit_balance: Option<f64>,
    #[serde(rename = "groupId", default)]
    pub group_id: Option<mongodb::bson::oid::ObjectId>,
    #[serde(rename = "createdAt", default)]
    pub created_at: Option<BsonDateTime>,
}

/// The JSON shape sent to clients — mirrors `sanitizeUser` in
/// backend/src/controllers/authController.ts exactly (field names, the
/// biltyAccessAmount-defaults-to-0 behavior, ISO date strings or null).
#[derive(Debug, Serialize)]
pub struct PublicUser {
    pub id: String,
    pub name: String,
    pub phone: String,
    pub role: Role,
    #[serde(rename = "isActive")]
    pub is_active: bool,
    #[serde(rename = "biltyAccessPaidAt")]
    pub bilty_access_paid_at: Option<String>,
    #[serde(rename = "biltyAccessExpiresAt")]
    pub bilty_access_expires_at: Option<String>,
    #[serde(rename = "biltyAccessAmount")]
    pub bilty_access_amount: f64,
    #[serde(rename = "biltyAccessFreightAmount")]
    pub bilty_access_freight_amount: Option<f64>,
    #[serde(rename = "creditBalance")]
    pub credit_balance: f64,
}

fn to_iso_string(value: Option<BsonDateTime>) -> Option<String> {
    value.map(|dt| dt.to_chrono().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string())
}

pub trait SanitizableUser {
    fn id(&self) -> ObjectId;
    fn name(&self) -> &str;
    fn phone(&self) -> &str;
    fn role(&self) -> Role;
    fn is_active(&self) -> bool;
    fn bilty_access_paid_at(&self) -> Option<BsonDateTime>;
    fn bilty_access_expires_at(&self) -> Option<BsonDateTime>;
    fn bilty_access_amount(&self) -> Option<f64>;
    fn bilty_access_freight_amount(&self) -> Option<f64>;
    fn credit_balance(&self) -> Option<f64>;
}

macro_rules! impl_sanitizable_user {
    ($ty:ty) => {
        impl SanitizableUser for $ty {
            fn id(&self) -> ObjectId {
                self.id
            }
            fn name(&self) -> &str {
                &self.name
            }
            fn phone(&self) -> &str {
                &self.phone
            }
            fn role(&self) -> Role {
                self.role
            }
            fn is_active(&self) -> bool {
                self.is_active
            }
            fn bilty_access_paid_at(&self) -> Option<BsonDateTime> {
                self.bilty_access_paid_at
            }
            fn bilty_access_expires_at(&self) -> Option<BsonDateTime> {
                self.bilty_access_expires_at
            }
            fn bilty_access_amount(&self) -> Option<f64> {
                self.bilty_access_amount
            }
            fn bilty_access_freight_amount(&self) -> Option<f64> {
                self.bilty_access_freight_amount
            }
            fn credit_balance(&self) -> Option<f64> {
                self.credit_balance
            }
        }
    };
}

impl_sanitizable_user!(User);
impl_sanitizable_user!(UserRecord);

pub fn sanitize_user(user: &impl SanitizableUser) -> PublicUser {
    PublicUser {
        id: user.id().to_hex(),
        name: user.name().to_string(),
        phone: user.phone().to_string(),
        role: user.role(),
        is_active: user.is_active(),
        bilty_access_paid_at: to_iso_string(user.bilty_access_paid_at()),
        bilty_access_expires_at: to_iso_string(user.bilty_access_expires_at()),
        bilty_access_amount: user.bilty_access_amount().unwrap_or(0.0),
        bilty_access_freight_amount: user.bilty_access_freight_amount(),
        credit_balance: user.credit_balance().unwrap_or(0.0),
    }
}

/// `getAllUsers` (backend/src/controllers/userController.ts) returns raw
/// Mongoose documents directly (`res.json(users)`), not `sanitizeUser`'s
/// output — so this list endpoint's shape is genuinely different from every
/// other auth/user response: keyed by `_id` (not `id`), and dates serialize
/// the same way Node's `JSON.stringify` on a `Date` does (plain ISO
/// strings), which is why `BsonDateTime`'s own Serialize impl (BSON
/// extended-JSON) can't be reused here either.
///
/// Deliberately omitted vs. the real Mongoose output: `updatedAt` and `__v`
/// (the schema version key) — nothing in the frontend reads either field
/// (see frontend/src/types/user.ts), so reproducing Mongoose's internal
/// versioning counter would add complexity with no observable behavior to
/// verify against.
#[derive(Debug, Serialize)]
pub struct ListedUser {
    #[serde(rename = "_id")]
    pub id: String,
    pub name: String,
    pub phone: String,
    pub role: Role,
    #[serde(rename = "isActive")]
    pub is_active: bool,
    #[serde(rename = "biltyAccessPaidAt", skip_serializing_if = "Option::is_none")]
    pub bilty_access_paid_at: Option<String>,
    #[serde(rename = "biltyAccessExpiresAt", skip_serializing_if = "Option::is_none")]
    pub bilty_access_expires_at: Option<String>,
    #[serde(rename = "biltyAccessAmount")]
    pub bilty_access_amount: f64,
    #[serde(rename = "biltyAccessFreightAmount", skip_serializing_if = "Option::is_none")]
    pub bilty_access_freight_amount: Option<f64>,
    #[serde(rename = "groupId", skip_serializing_if = "Option::is_none")]
    pub group_id: Option<String>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
}

pub fn to_listed_user(user: &UserRecord) -> ListedUser {
    ListedUser {
        id: user.id.to_hex(),
        name: user.name.clone(),
        phone: user.phone.clone(),
        role: user.role,
        is_active: user.is_active,
        bilty_access_paid_at: to_iso_string(user.bilty_access_paid_at),
        bilty_access_expires_at: to_iso_string(user.bilty_access_expires_at),
        bilty_access_amount: user.bilty_access_amount.unwrap_or(0.0),
        bilty_access_freight_amount: user.bilty_access_freight_amount,
        group_id: user.group_id.map(|id| id.to_hex()),
        created_at: to_iso_string(user.created_at),
    }
}
