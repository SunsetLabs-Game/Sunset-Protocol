use std::sync::Arc;
use std::time::Duration;

use ethers::abi::{AbiParser, RawLog, Token};
use ethers::providers::{Http, Middleware, Provider};
use ethers::types::{Address, BlockNumber, Filter, Log, H256, U64, U256, ValueOrArray};
use tokio::time::sleep;

use crate::error::AspError;
use crate::AppState;

const LAST_SYNCED_BLOCK_KEY: &str = "conflux:last_synced_block";
const BLOCK_BATCH_SIZE: u64 = 500;

pub const SYNC_CURSOR_KEY: &str = LAST_SYNCED_BLOCK_KEY;

pub async fn start_event_sync(state: Arc<AppState>, poll_interval_secs: u64) {
    tracing::info!(
        interval_secs = poll_interval_secs,
        coordinator = %state.config.coordinator_address,
        "Starting Conflux eSpace event sync"
    );

    let provider = match Provider::<Http>::try_from(state.config.rpc_url.as_str()) {
        Ok(provider) => provider,
        Err(err) => {
            tracing::error!("Failed to initialize Conflux sync provider: {err}");
            return;
        }
    };

    loop {
        if let Err(err) = sync_once(&state, &provider).await {
            tracing::error!("Conflux event sync iteration failed: {err}");
        }

        sleep(Duration::from_secs(poll_interval_secs)).await;
    }
}

async fn sync_once(state: &Arc<AppState>, provider: &Provider<Http>) -> Result<(), AspError> {
    let coordinator = parse_address(&state.config.coordinator_address)?;
    let current_block = provider
        .get_block_number()
        .await
        .map_err(|e| AspError::RpcError(format!("Failed to fetch current block: {e}")))?;

    let from_block = match state.db.get_sync_state(LAST_SYNCED_BLOCK_KEY)? {
        Some(value) => value
            .parse::<u64>()
            .map_err(|e| AspError::Internal(format!("Invalid sync state '{value}': {e}")))?,
        None => 0,
    };

    let current_block_u64 = current_block.as_u64();
    if from_block > current_block_u64 {
        return Ok(());
    }

    let to_block = (from_block + BLOCK_BATCH_SIZE - 1).min(current_block_u64);
    let commitment_logs = fetch_event_logs(
        provider,
        coordinator,
        "event CommitmentDeposited(bytes32 indexed commitment, uint32 indexed leafIndex)",
        from_block,
        to_block,
    )
    .await?;

    for log in commitment_logs {
        sync_commitment_log(state, log).await?;
    }

    let root_logs = fetch_event_logs(
        provider,
        coordinator,
        "event MerkleRootAccepted(bytes32 indexed root)",
        from_block,
        to_block,
    )
    .await?;

    for log in root_logs {
        sync_root_log(state, log)?;
    }

    let nullifier_logs = fetch_event_logs(
        provider,
        coordinator,
        "event NullifierSpent(bytes32 indexed nullifierHash)",
        from_block,
        to_block,
    )
    .await?;

    for log in nullifier_logs {
        sync_nullifier_log(state, log)?;
    }

    state
        .db
        .set_sync_state(LAST_SYNCED_BLOCK_KEY, &(to_block + 1).to_string())?;

    if from_block <= to_block {
        tracing::debug!(
            from_block,
            to_block,
            current_block = current_block_u64,
            "Conflux event sync completed range"
        );
    }

    Ok(())
}

async fn fetch_event_logs(
    provider: &Provider<Http>,
    coordinator: Address,
    event_signature: &str,
    from_block: u64,
    to_block: u64,
) -> Result<Vec<Log>, AspError> {
    let event = AbiParser::default()
        .parse_event(event_signature)
        .map_err(|e| AspError::Internal(format!("Invalid event signature '{event_signature}': {e}")))?;

    let filter = Filter::new()
        .address(ValueOrArray::Value(coordinator))
        .topic0(ValueOrArray::Value(event.signature()))
        .from_block(BlockNumber::Number(U64::from(from_block)))
        .to_block(BlockNumber::Number(U64::from(to_block)));

    provider
        .get_logs(&filter)
        .await
        .map_err(|e| AspError::RpcError(format!("Failed to fetch logs for '{event_signature}': {e}")))
}

async fn sync_commitment_log(state: &Arc<AppState>, log: Log) -> Result<(), AspError> {
    let event = AbiParser::default()
        .parse_event("event CommitmentDeposited(bytes32 indexed commitment, uint32 indexed leafIndex)")
        .map_err(|e| AspError::Internal(format!("Invalid commitment event ABI: {e}")))?;

    let parsed = event
        .parse_log(RawLog {
            topics: log.topics.clone(),
            data: log.data.to_vec(),
        })
        .map_err(|e| AspError::Internal(format!("Failed to parse CommitmentDeposited log: {e}")))?;

    let mut commitment = None;
    let mut leaf_index = None;

    for param in parsed.params {
        match (param.name.as_str(), param.value) {
            ("commitment", Token::FixedBytes(bytes)) => {
                commitment = Some(bytes32_to_decimal(&bytes));
            }
            ("leafIndex", Token::Uint(value)) => {
                leaf_index = Some(
                    u32::try_from(value.as_u64())
                        .map_err(|_| AspError::Internal("leafIndex exceeds u32 range".into()))?,
                );
            }
            _ => {}
        }
    }

    let commitment =
        commitment.ok_or_else(|| AspError::Internal("CommitmentDeposited missing commitment".into()))?;
    let leaf_index =
        leaf_index.ok_or_else(|| AspError::Internal("CommitmentDeposited missing leafIndex".into()))?;

    if state.db.get_commitment(leaf_index)?.is_some() {
        return Ok(());
    }

    let tx_hash = log.transaction_hash.map(format_h256);
    state
        .db
        .insert_commitment(leaf_index, &commitment, tx_hash.as_deref())?;

    let mut worker = state.worker.lock().await;
    let rebuilt_root = worker.insert_leaf(&commitment).await?;
    tracing::info!(
        leaf_index,
        commitment = %commitment,
        root = %rebuilt_root,
        tx_hash = tx_hash.as_deref().unwrap_or_default(),
        "Synced commitment from Conflux coordinator"
    );

    Ok(())
}

fn sync_root_log(state: &Arc<AppState>, log: Log) -> Result<(), AspError> {
    let event = AbiParser::default()
        .parse_event("event MerkleRootAccepted(bytes32 indexed root)")
        .map_err(|e| AspError::Internal(format!("Invalid root event ABI: {e}")))?;

    let parsed = event
        .parse_log(RawLog {
            topics: log.topics.clone(),
            data: log.data.to_vec(),
        })
        .map_err(|e| AspError::Internal(format!("Failed to parse MerkleRootAccepted log: {e}")))?;

    let root = parsed
        .params
        .into_iter()
        .find_map(|param| match param.value {
            Token::FixedBytes(bytes) if param.name == "root" => Some(bytes32_to_decimal(&bytes)),
            _ => None,
        })
        .ok_or_else(|| AspError::Internal("MerkleRootAccepted missing root".into()))?;

    let latest_root = state.db.get_latest_root()?;
    if latest_root.as_deref() == Some(root.as_str()) {
        return Ok(());
    }

    let leaf_count = state.db.get_leaf_count()?;
    let tx_hash = log.transaction_hash.map(format_h256);
    state.db.insert_root(&root, leaf_count, tx_hash.as_deref())?;

    tracing::info!(
        root = %root,
        leaf_count,
        tx_hash = tx_hash.as_deref().unwrap_or_default(),
        "Synced Merkle root from Conflux coordinator"
    );

    Ok(())
}

fn sync_nullifier_log(state: &Arc<AppState>, log: Log) -> Result<(), AspError> {
    let event = AbiParser::default()
        .parse_event("event NullifierSpent(bytes32 indexed nullifierHash)")
        .map_err(|e| AspError::Internal(format!("Invalid nullifier event ABI: {e}")))?;

    let parsed = event
        .parse_log(RawLog {
            topics: log.topics.clone(),
            data: log.data.to_vec(),
        })
        .map_err(|e| AspError::Internal(format!("Failed to parse NullifierSpent log: {e}")))?;

    let nullifier_hash = parsed
        .params
        .into_iter()
        .find_map(|param| match param.value {
            Token::FixedBytes(bytes) if param.name == "nullifierHash" => Some(bytes32_to_decimal(&bytes)),
            _ => None,
        })
        .ok_or_else(|| AspError::Internal("NullifierSpent missing nullifierHash".into()))?;

    if state.db.is_nullifier_spent(&nullifier_hash)? {
        return Ok(());
    }

    let tx_hash = log.transaction_hash.map(format_h256);
    state
        .db
        .insert_nullifier(&nullifier_hash, "chain_sync", tx_hash.as_deref())?;

    tracing::info!(
        nullifier_hash = %nullifier_hash,
        tx_hash = tx_hash.as_deref().unwrap_or_default(),
        "Synced spent nullifier from Conflux coordinator"
    );

    Ok(())
}

fn parse_address(value: &str) -> Result<Address, AspError> {
    value
        .parse::<Address>()
        .map_err(|e| AspError::Config(format!("Invalid EVM address '{value}': {e}")))
}

fn bytes32_to_decimal(bytes: &[u8]) -> String {
    U256::from_big_endian(bytes).to_string()
}

fn format_h256(hash: H256) -> String {
    format!("{:#x}", hash)
}
