use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

/// backend/src/utils/tokenUtils.ts — HS256, `signToken({id}, "7d")` is the
/// only call site in the Node codebase, so 7 days is hardcoded here rather
/// than a general-purpose parameter.
const SEVEN_DAYS_SECS: u64 = 7 * 24 * 60 * 60;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub id: String,
    pub exp: u64,
}

pub fn sign_token(user_id: &str, jwt_secret: &str) -> jsonwebtoken::errors::Result<String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before unix epoch")
        .as_secs();

    let claims = Claims {
        id: user_id.to_string(),
        exp: now + SEVEN_DAYS_SECS,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret.as_bytes()),
    )
}

pub fn verify_token(token: &str, jwt_secret: &str) -> jsonwebtoken::errors::Result<Claims> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret.as_bytes()),
        &Validation::default(),
    )
    .map(|data| data.claims)
}
