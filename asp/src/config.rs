use serde::Deserialize;
use std::path::PathBuf;
use std::str::FromStr;

use ethers::signers::{LocalWallet, Signer};

use crate::error::AspError;

#[derive(Clone, Debug)]
pub struct Config {
    // Server
    pub host: String,
    pub port: u16,

    // Conflux RPC
    pub rpc_url: String,

    // Relayer account
    pub admin_address: String,
    pub admin_private_key: Option<String>,

    // Contract addresses
    pub coordinator_address: String,
    pub pool_address: String,

    // Database
    pub database_path: String,

    // Worker
    pub worker_path: String,

    // Sync
    pub sync_poll_interval_secs: u64,
    pub enable_relayer: bool,
    pub enable_event_sync: bool,
}

#[derive(Deserialize)]
struct DeployedAddresses {
    coordinator: String,
    pool: String,
}

impl Config {
    pub fn load() -> Result<Self, AspError> {
        // Load .env file (optional, won't fail if missing)
        dotenvy::dotenv().ok();

        let host = std::env::var("ASP_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
        let port: u16 = std::env::var("ASP_PORT")
            .unwrap_or_else(|_| "3000".to_string())
            .parse()
            .map_err(|_| AspError::Config("ASP_PORT must be a valid port number".into()))?;

        let rpc_url = std::env::var("CONFLUX_RPC_URL")
            .or_else(|_| std::env::var("RPC_URL"))
            .map_err(|_| AspError::Config("CONFLUX_RPC_URL is required".into()))?;

        let admin_private_key = std::env::var("ADMIN_PRIVATE_KEY").ok();

        // Try to load deployed addresses from file
        let addresses_path = std::env::var("DEPLOYED_ADDRESSES_PATH").unwrap_or_else(|_| {
            let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
            path.push("../contracts/solidity/deployments/contracts.json");
            path.to_string_lossy().to_string()
        });

        let (coordinator_address, pool_address) = if let Ok(content) =
            std::fs::read_to_string(&addresses_path)
        {
            let addrs: DeployedAddresses = serde_json::from_str(&content)
                .map_err(|e| AspError::Config(format!("Invalid deployed_addresses.json: {e}")))?;
            (addrs.coordinator, addrs.pool)
        } else {
            // Fall back to env vars
            let coordinator = std::env::var("COORDINATOR_ADDRESS")
                .map_err(|_| AspError::Config("COORDINATOR_ADDRESS is required".into()))?;
            let pool = std::env::var("POOL_ADDRESS")
                .map_err(|_| AspError::Config("POOL_ADDRESS is required".into()))?;
            (coordinator, pool)
        };

        let database_path =
            std::env::var("DATABASE_PATH").unwrap_or_else(|_| "sunset_asp.db".to_string());

        let worker_path = std::env::var("WORKER_PATH").unwrap_or_else(|_| {
            let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
            path.push("worker/worker.mjs");
            path.to_string_lossy().to_string()
        });

        let sync_poll_interval_secs: u64 = std::env::var("SYNC_POLL_INTERVAL_SECS")
            .unwrap_or_else(|_| "5".to_string())
            .parse()
            .unwrap_or(5);

        let enable_relayer = std::env::var("RELAYER_ENABLED")
            .unwrap_or_else(|_| "false".to_string())
            .parse()
            .unwrap_or(false);

        let admin_address = match std::env::var("ADMIN_ADDRESS") {
            Ok(value) => value,
            Err(_) if enable_relayer => {
                let private_key = admin_private_key.as_deref().ok_or_else(|| {
                    AspError::Config(
                        "ADMIN_ADDRESS is required when RELAYER_ENABLED=true and ADMIN_PRIVATE_KEY is not set".into(),
                    )
                })?;

                let wallet = LocalWallet::from_str(private_key).map_err(|e| {
                    AspError::Config(format!(
                        "Failed to derive ADMIN_ADDRESS from ADMIN_PRIVATE_KEY: {e}"
                    ))
                })?;

                format!("{:#x}", wallet.address())
            }
            Err(_) => String::new(),
        };

        let enable_event_sync = std::env::var("EVENT_SYNC_ENABLED")
            .unwrap_or_else(|_| "false".to_string())
            .parse()
            .unwrap_or(false);

        Ok(Config {
            host,
            port,
            rpc_url,
            admin_address,
            admin_private_key,
            coordinator_address,
            pool_address,
            database_path,
            worker_path,
            sync_poll_interval_secs,
            enable_relayer,
            enable_event_sync,
        })
    }
}
