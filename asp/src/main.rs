use std::sync::Arc;
use tokio::sync::Mutex;
use tracing_subscriber::EnvFilter;

use sunset_asp::config::Config;
use sunset_asp::db::Database;
use sunset_asp::prover::Worker;
use sunset_asp::relayer::ConfluxRelayer;
use sunset_asp::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    tracing::info!("Starting Sunset ASP server...");

    // Load configuration
    let config = Config::load()?;
    tracing::info!(
        coordinator = %config.coordinator_address,
        pool = %config.pool_address,
        "Configuration loaded"
    );

    // Initialize database
    let db = Database::new(&config.database_path)?;
    db.run_migrations()?;
    tracing::info!(path = %config.database_path, "Database initialized");

    // Spawn Node.js worker
    let mut worker = Worker::spawn(&config.worker_path).await?;
    tracing::info!("Node.js worker spawned");

    // Rebuild tree from existing commitments
    let commitments = db.get_all_commitments()?;
    if !commitments.is_empty() {
        let leaves: Vec<String> = commitments.iter().map(|c| c.commitment.clone()).collect();
        let root = worker.build_tree(&leaves).await?;
        tracing::info!(leaf_count = leaves.len(), root = %root, "Merkle tree rebuilt");
    }

    // Initialize relayer for on-chain transaction submission
    let relayer = if config.enable_relayer {
        match ConfluxRelayer::new(&config).await {
            Ok(r) => {
                tracing::info!("Conflux relayer initialized");
                Some(Mutex::new(
                    Box::new(r) as Box<dyn sunset_asp::relayer::Relayer>
                ))
            }
            Err(e) => {
                tracing::warn!("Relayer not available: {e} — running in proof-only mode");
                None
            }
        }
    } else {
        tracing::info!("Conflux relayer disabled; running in proof-only mode");
        None
    };

    // Build shared state
    let state = Arc::new(AppState {
        config: config.clone(),
        db,
        worker: Mutex::new(worker),
        relayer,
    });

    // Spawn event sync background task
    if config.enable_event_sync {
        let sync_state = state.clone();
        let poll_interval = config.sync_poll_interval_secs;
        tokio::spawn(async move {
            sunset_asp::sync::conflux::start_event_sync(sync_state, poll_interval).await;
        });
    } else {
        tracing::info!("Conflux event sync disabled");
    }

    // Build router
    let app = sunset_asp::api::routes::create_router(state.clone());

    // Start server
    let addr = format!("{}:{}", config.host, config.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!(addr = %addr, "Server listening");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    tracing::info!("Server shut down gracefully");
    Ok(())
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("Failed to install CTRL+C handler");
    tracing::info!("Shutdown signal received");
}
