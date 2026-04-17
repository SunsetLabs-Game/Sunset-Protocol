use std::sync::Arc;

use axum::extract::State;
use axum::Json;

use crate::api::handlers::deposit::decimal_to_hex;
use crate::api::types::{BurnRequest, BurnResponse};
use crate::api::validation::{
    validate_address, validate_decimal, validate_secret, validate_tick_range,
};
use crate::error::AspError;
use crate::AppState;

const TICK_OFFSET: i32 = 887272;

async fn predict_root(state: &Arc<AppState>, appended_leaves: &[String]) -> Result<String, AspError> {
    let base_leaves: Vec<String> = state
        .db
        .get_all_commitments()?
        .into_iter()
        .map(|row| row.commitment)
        .collect();

    let mut predicted_leaves = base_leaves.clone();
    predicted_leaves.extend_from_slice(appended_leaves);

    let mut worker = state.worker.lock().await;
    let predicted_root = worker.build_tree(&predicted_leaves).await?;
    let _ = worker.build_tree(&base_leaves).await?;

    Ok(predicted_root)
}

fn validate_burn_request(req: &BurnRequest) -> Result<(), AspError> {
    // Position note
    validate_secret(&req.position_note.secret, "position_note.secret")?;
    validate_secret(&req.position_note.nullifier, "position_note.nullifier")?;
    validate_decimal(&req.position_note.liquidity, "position_note.liquidity")?;
    validate_tick_range(req.position_note.tick_lower, req.position_note.tick_upper)?;

    // Output notes
    for (prefix, note) in [
        ("output_note_0", &req.output_note_0),
        ("output_note_1", &req.output_note_1),
    ] {
        validate_secret(&note.secret, &format!("{prefix}.secret"))?;
        validate_secret(&note.nullifier, &format!("{prefix}.nullifier"))?;
        validate_decimal(&note.amount_low, &format!("{prefix}.amount_low"))?;
        validate_decimal(&note.amount_high, &format!("{prefix}.amount_high"))?;
        validate_address(&note.token, &format!("{prefix}.token"))?;
    }

    // Pool key
    validate_address(&req.pool_key.token_0, "pool_key.token_0")?;
    validate_address(&req.pool_key.token_1, "pool_key.token_1")?;

    if req.liquidity == 0 {
        return Err(AspError::InvalidInput("liquidity must be > 0".into()));
    }

    Ok(())
}

pub async fn shielded_burn(
    State(state): State<Arc<AppState>>,
    Json(req): Json<BurnRequest>,
) -> Result<Json<BurnResponse>, AspError> {
    validate_burn_request(&req)?;

    tracing::info!(
        leaf_index = req.position_note.leaf_index,
        "Processing shielded burn"
    );

    let mut worker = state.worker.lock().await;

    // 1. Convert signed ticks to unsigned
    let tick_lower_unsigned = (req.position_note.tick_lower + TICK_OFFSET) as u32;
    let tick_upper_unsigned = (req.position_note.tick_upper + TICK_OFFSET) as u32;

    // 2. Get Merkle proof for position
    let proof = worker.get_proof(req.position_note.leaf_index).await?;

    // 3. Compute output note commitments (for public inputs)
    let output0 = worker
        .compute_commitment(
            &req.output_note_0.secret,
            &req.output_note_0.nullifier,
            &req.output_note_0.amount_low,
            &req.output_note_0.amount_high,
            &req.output_note_0.token,
        )
        .await?;

    let output1 = worker
        .compute_commitment(
            &req.output_note_1.secret,
            &req.output_note_1.nullifier,
            &req.output_note_1.amount_low,
            &req.output_note_1.amount_high,
            &req.output_note_1.token,
        )
        .await?;

    // 4. Compute position commitment and nullifier hash
    let position = worker
        .compute_position_commitment(
            &req.position_note.secret,
            &req.position_note.nullifier,
            tick_lower_unsigned as i32,
            tick_upper_unsigned as i32,
            &req.position_note.liquidity,
        )
        .await?;

    // 5. Build burn circuit inputs
    let inputs = serde_json::json!({
        "root": proof.root,
        "positionNullifierHash": position.nullifier_hash,
        "newCommitment0": output0.commitment,
        "newCommitment1": output1.commitment,
        "tickLower": tick_lower_unsigned.to_string(),
        "tickUpper": tick_upper_unsigned.to_string(),
        // Private - position
        "positionSecret": req.position_note.secret,
        "positionNullifier": req.position_note.nullifier,
        "liquidity": req.position_note.liquidity,
        "pathElements": proof.path_elements,
        "pathIndices": proof.path_indices,
        // Private - output note 0
        "newSecret0": req.output_note_0.secret,
        "newNullifier0": req.output_note_0.nullifier,
        "amount0_low": req.output_note_0.amount_low,
        "amount0_high": req.output_note_0.amount_high,
        "token0": req.output_note_0.token,
        // Private - output note 1
        "newSecret1": req.output_note_1.secret,
        "newNullifier1": req.output_note_1.nullifier,
        "amount1_low": req.output_note_1.amount_low,
        "amount1_high": req.output_note_1.amount_high,
        "token1": req.output_note_1.token,
    });

    // 6. Generate burn proof
    let proof_result = worker.generate_proof("burn", inputs).await?;
    drop(worker);

    let predicted_root = predict_root(
        &state,
        &[output0.commitment.clone(), output1.commitment.clone()],
    )
    .await?;

    tracing::info!("Shielded burn proof prepared for direct wallet submission");

    // Echo back the amounts used in the ZK proof so the SDK can save notes correctly.
    // These are the amounts committed into the output note commitments (private circuit inputs).
    // For all realistic ERC-20 token amounts the high part is 0, so amount == low.
    let amount_0_low: u128 = req.output_note_0.amount_low.parse().unwrap_or(0);
    let amount_0_high: u128 = req.output_note_0.amount_high.parse().unwrap_or(0);
    let amount_0 = if amount_0_high == 0 {
        amount_0_low.to_string()
    } else {
        format!(
            "{}",
            amount_0_high
                .saturating_mul(u128::MAX)
                .saturating_add(amount_0_low)
        )
    };

    let amount_1_low: u128 = req.output_note_1.amount_low.parse().unwrap_or(0);
    let amount_1_high: u128 = req.output_note_1.amount_high.parse().unwrap_or(0);
    let amount_1 = if amount_1_high == 0 {
        amount_1_low.to_string()
    } else {
        format!(
            "{}",
            amount_1_high
                .saturating_mul(u128::MAX)
                .saturating_add(amount_1_low)
        )
    };

    Ok(Json(BurnResponse {
        status: "prepared".to_string(),
        calldata: proof_result.calldata,
        final_root: decimal_to_hex(&predicted_root),
        new_commitment_0: output0.commitment.clone(),
        new_commitment_1: output1.commitment.clone(),
        amount_0,
        amount_1,
    }))
}
