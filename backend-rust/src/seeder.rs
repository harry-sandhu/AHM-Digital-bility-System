use crate::{
    models::user::{Role, User},
    utils::phone::normalize_phone,
};
use mongodb::{
    bson::{doc, oid::ObjectId},
    Database,
};

/// backend/src/seeder/seedSuperAdmin.ts — ported from the already-hardened
/// Node version from earlier this session (not the original insecure
/// `0000000000`/`admin123` default): a no-op if a superadmin already
/// exists; otherwise requires both env vars and refuses to boot without
/// them, rather than silently seeding a world-guessable account.
pub async fn seed_superadmin(
    db: &Database,
    superadmin_phone: Option<&str>,
    superadmin_password: Option<&str>,
) -> anyhow::Result<()> {
    let existing = db
        .collection::<User>("users")
        .find_one(doc! { "role": "superadmin" })
        .await?;

    if existing.is_some() {
        return Ok(());
    }

    let (phone, password) = match (superadmin_phone, superadmin_password) {
        (Some(phone), Some(password)) if !phone.is_empty() && !password.is_empty() => (phone, password),
        _ => anyhow::bail!(
            "No superadmin exists yet, and SUPERADMIN_PHONE/SUPERADMIN_PASSWORD are not set. \
             Set both environment variables before starting the server."
        ),
    };

    let normalized_phone = normalize_phone(phone);
    let hashed_password = bcrypt::hash(password, 10)?;

    let superadmin = User {
        id: ObjectId::new(),
        name: "Super Admin".to_string(),
        phone: normalized_phone.clone(),
        password: hashed_password,
        role: Role::Superadmin,
        is_active: true,
        bilty_access_paid_at: None,
        bilty_access_expires_at: None,
        bilty_access_amount: Some(0.0),
        bilty_access_freight_amount: None,
        credit_balance: None,
        group_id: None,
        created_at: Some(mongodb::bson::DateTime::now()),
    };

    db.collection::<User>("users").insert_one(&superadmin).await?;
    tracing::info!(phone = %normalized_phone, "superadmin seeded");

    Ok(())
}
