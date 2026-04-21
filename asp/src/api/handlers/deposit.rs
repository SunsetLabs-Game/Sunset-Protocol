use std::sync::Arc;

use axum::extract::State;
use axum::Json;

use crate::api::types::{DepositRequest, DepositResponse};
use crate::api::validation::validate_hex_u256;
use crate::error::AspError;
use crate::AppState;

pub async fn deposit(
    State(state): State<Arc<AppState>>,
    Json(req): Json<DepositRequest>,
) -> Result<Json<DepositResponse>, AspError> {
    validate_hex_u256(&req.commitment, "commitment")?;

    tracing::info!("Processing deposit");

    let commitment_decimal = hex_to_decimal(&req.commitment)?;

    let leaf_index = state.db.get_leaf_count()?;
    let root = predict_root(&state, std::slice::from_ref(&commitment_decimal)).await?;
    let root_hex = decimal_to_hex(&root);

    tracing::info!(
        leaf_index = leaf_index,
        root = %root_hex,
        "Deposit prepared for direct wallet submission"
    );

    Ok(Json(DepositResponse {
        status: "prepared".to_string(),
        leaf_index,
        calldata: vec![],
        root: root_hex,
    }))
}

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

/// Convert a hex string (0x...) to decimal string for the worker.
pub fn hex_to_decimal(hex: &str) -> Result<String, AspError> {
    use num_bigint::BigUint;
    use num_traits::Num;

    let stripped = hex
        .strip_prefix("0x")
        .or_else(|| hex.strip_prefix("0X"))
        .unwrap_or(hex);
    let big = BigUint::from_str_radix(stripped, 16)
        .map_err(|e| AspError::InvalidInput(format!("Invalid hex value: {e}")))?;
    Ok(big.to_str_radix(10))
}

/// Convert a decimal string to a 0x-prefixed, 32-byte zero-padded hex string.
/// This ensures the value is a valid `bytes32` as expected by ethers.js v6.
pub fn decimal_to_hex(dec: &str) -> String {
    use num_bigint::BigUint;
    use num_traits::Num;

    match BigUint::from_str_radix(dec, 10) {
        Ok(big) => {
            let hex = big.to_str_radix(16);
            // Pad to 64 hex chars (32 bytes) for bytes32 compatibility
            format!("0x{:0>64}", hex)
        }
        Err(_) => dec.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hex_to_decimal_zero() {
        assert_eq!(hex_to_decimal("0x0").unwrap(), "0");
    }

    #[test]
    fn hex_to_decimal_small() {
        assert_eq!(hex_to_decimal("0xff").unwrap(), "255");
    }

    #[test]
    fn hex_to_decimal_large() {
        // 0x100 = 256
        assert_eq!(hex_to_decimal("0x100").unwrap(), "256");
    }

    #[test]
    fn decimal_to_hex_roundtrip() {
        let hex = "0xdeadbeef";
        let dec = hex_to_decimal(hex).unwrap();
        assert_eq!(decimal_to_hex(&dec), hex);
    }

    #[test]
    fn decimal_to_hex_zero() {
        assert_eq!(decimal_to_hex("0"), "0x0");
    }

    #[test]
    fn decimal_to_hex_invalid_fallback() {
        assert_eq!(decimal_to_hex("not_a_number"), "not_a_number");
    }
}
