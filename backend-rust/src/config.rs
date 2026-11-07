use std::env;

pub struct Config {
    pub port: u16,
    pub mongo_uri: String,
    pub jwt_secret: String,
    pub allowed_origins: Vec<String>,
    pub superadmin_phone: Option<String>,
    pub superadmin_password: Option<String>,
}

impl Config {
    /// Mirrors the Node backend's startup contract: JWT_SECRET is required with
    /// no fallback (see backend/src/utils/tokenUtils.ts), and FRONTEND_URL is a
    /// comma-separated allow-list defaulting to the known production frontend
    /// origin (see backend/src/server.ts).
    pub fn load() -> anyhow::Result<Self> {
        let _ = dotenvy::dotenv();

        let jwt_secret = env::var("JWT_SECRET")
            .map_err(|_| anyhow::anyhow!("JWT_SECRET environment variable is required but was not set."))?;

        let port = env::var("PORT")
            .ok()
            .and_then(|value| value.parse().ok())
            .unwrap_or(5000);

        let mongo_uri = env::var("MONGO_URI")
            .unwrap_or_else(|_| "mongodb://localhost:27017/bilty".to_string());

        let allowed_origins = env::var("FRONTEND_URL")
            .unwrap_or_else(|_| "https://ahm-digital-bility-system.vercel.app".to_string())
            .split(',')
            .map(|origin| origin.trim().to_string())
            .filter(|origin| !origin.is_empty())
            .collect();

        Ok(Self {
            port,
            mongo_uri,
            jwt_secret,
            allowed_origins,
            superadmin_phone: env::var("SUPERADMIN_PHONE").ok(),
            superadmin_password: env::var("SUPERADMIN_PASSWORD").ok(),
        })
    }
}
