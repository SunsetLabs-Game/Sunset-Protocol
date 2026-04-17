use std::str::FromStr;
use std::sync::Arc;
use std::time::Duration;

use ethers::abi::{AbiParser, Token};
use ethers::middleware::SignerMiddleware;
use ethers::providers::{Http, Middleware, Provider};
use ethers::signers::{LocalWallet, Signer};
use ethers::types::{Address, Bytes, TransactionReceipt, TransactionRequest, H256, U256, U64};

use crate::config::Config;
use crate::error::AspError;

use super::Relayer;

const MAX_ATTEMPTS: usize = 60;
const POLL_INTERVAL: Duration = Duration::from_secs(2);

#[derive(Debug, Clone, serde::Deserialize)]
pub struct PoolKeyParams {
    pub token_0: String,
    pub token_1: String,
    pub fee: u64,
    pub tick_spacing: u64,
}

pub struct ConfluxRelayer {
    client: Arc<SignerMiddleware<Provider<Http>, LocalWallet>>,
    coordinator_address: Address,
    pool_address: Address,
}

impl ConfluxRelayer {
    pub async fn new(config: &Config) -> Result<Self, AspError> {
        if !config.enable_relayer {
            return Err(AspError::Config(
                "Conflux relayer is disabled; enable RELAYER_ENABLED to provide on-chain submission".into(),
            ));
        }

        let rpc = Provider::<Http>::try_from(config.rpc_url.as_str())
            .map_err(|e| AspError::Config(format!("Invalid CONFLUX_RPC_URL: {e}")))?;

        let private_key = config
            .admin_private_key
            .as_deref()
            .ok_or_else(|| AspError::Config("ADMIN_PRIVATE_KEY is required".into()))?;

        let wallet = LocalWallet::from_str(private_key)
            .map_err(|e| AspError::Config(format!("Invalid ADMIN_PRIVATE_KEY: {e}")))?;

        let chain_id = rpc
            .get_chainid()
            .await
            .map_err(|e| AspError::RpcError(format!("Failed to read chain ID: {e}")))?;

        let wallet = wallet.with_chain_id(chain_id.as_u64());

        if !config.admin_address.is_empty() {
            let configured = parse_address(&config.admin_address)?;
            if configured != wallet.address() {
                return Err(AspError::Config(format!(
                    "ADMIN_ADDRESS does not match ADMIN_PRIVATE_KEY (expected {}, derived {})",
                    config.admin_address,
                    format_address(wallet.address()),
                )));
            }
        }

        let coordinator_address = parse_address(&config.coordinator_address)?;
        let pool_address = parse_address(&config.pool_address)?;

        let client = Arc::new(SignerMiddleware::new(rpc, wallet));

        Ok(Self {
            client,
            coordinator_address,
            pool_address,
        })
    }

    async fn send_transaction(
        &self,
        to: Address,
        signature: &str,
        tokens: &[Token],
    ) -> Result<String, AspError> {
        let function = AbiParser::default()
            .parse_function(signature)
            .map_err(|e| AspError::Internal(format!("Invalid ABI signature '{signature}': {e}")))?;

        let calldata = function.encode_input(tokens).map_err(|e| {
            AspError::Internal(format!("Failed to encode calldata for '{signature}': {e}"))
        })?;

        let tx = TransactionRequest::new().to(to).data(Bytes::from(calldata));

        let pending = self
            .client
            .send_transaction(tx, None)
            .await
            .map_err(|e| AspError::TransactionFailed(format!("{e}")))?;

        let tx_hash: H256 = pending.tx_hash();
        let receipt = wait_for_receipt(self.client.provider(), tx_hash).await?;

        if receipt.status != Some(U64::from(1u64)) {
            return Err(AspError::TransactionReverted(format!(
                "Transaction {:#x} reverted",
                tx_hash
            )));
        }

        Ok(format!("{:#x}", tx_hash))
    }
}

#[async_trait::async_trait]
impl Relayer for ConfluxRelayer {
    async fn deposit(&self, commitment: &str) -> Result<String, AspError> {
        let commitment = bytes32_from_u256_string(commitment)?;
        self.send_transaction(
            self.coordinator_address,
            "depositCommitment(bytes32 commitment)",
            &[Token::FixedBytes(commitment.to_vec())],
        )
        .await
    }

    async fn submit_merkle_root(&self, root: &str) -> Result<String, AspError> {
        let root = bytes32_from_u256_string(root)?;
        self.send_transaction(
            self.coordinator_address,
            "submitMerkleRoot(bytes32 root)",
            &[Token::FixedBytes(root.to_vec())],
        )
        .await
    }

    async fn verify_membership(&self, calldata: &[String]) -> Result<String, AspError> {
        let proof_data = encode_garaga_calldata(calldata)?;
        self.send_transaction(
            self.pool_address,
            "shieldedWithdraw(bytes proofData)",
            &[Token::Bytes(proof_data.to_vec())],
        )
        .await
    }

    async fn shielded_swap(
        &self,
        _pool_key: &PoolKeyParams,
        calldata: &[String],
        sqrt_price_limit: &str,
    ) -> Result<String, AspError> {
        let proof_data = encode_garaga_calldata(calldata)?;
        let sqrt_price_limit = parse_u160(sqrt_price_limit)?;

        self.send_transaction(
            self.pool_address,
            "shieldedSwap(bytes proofData, uint160 sqrtPriceLimitX96)",
            &[
                Token::Bytes(proof_data.to_vec()),
                Token::Uint(sqrt_price_limit),
            ],
        )
        .await
    }

    async fn shielded_mint(
        &self,
        _pool_key: &PoolKeyParams,
        calldata: &[String],
        liquidity: u128,
    ) -> Result<String, AspError> {
        let proof_data = encode_garaga_calldata(calldata)?;
        self.send_transaction(
            self.pool_address,
            "shieldedMint(bytes proofData, uint128 liquidityDelta)",
            &[
                Token::Bytes(proof_data.to_vec()),
                Token::Uint(U256::from(liquidity)),
            ],
        )
        .await
    }

    async fn shielded_burn(
        &self,
        _pool_key: &PoolKeyParams,
        calldata: &[String],
        position_commitment: &str,
        liquidity: u128,
    ) -> Result<String, AspError> {
        let proof_data = encode_garaga_calldata(calldata)?;
        let position_commitment = bytes32_from_u256_string(position_commitment)?;
        self.send_transaction(
            self.pool_address,
            "shieldedBurn(bytes proofData, bytes32 positionCommitment, uint128 liquidityDelta)",
            &[
                Token::Bytes(proof_data.to_vec()),
                Token::FixedBytes(position_commitment.to_vec()),
                Token::Uint(U256::from(liquidity)),
            ],
        )
        .await
    }
}

fn parse_address(value: &str) -> Result<Address, AspError> {
    Address::from_str(value)
        .map_err(|e| AspError::Config(format!("Invalid EVM address '{value}': {e}")))
}

fn format_address(address: Address) -> String {
    format!("{:#x}", address)
}

fn parse_u256(value: &str) -> Result<U256, AspError> {
    if value.starts_with("0x") || value.starts_with("0X") {
        U256::from_str_radix(value.trim_start_matches("0x").trim_start_matches("0X"), 16)
            .map_err(|e| AspError::InvalidInput(format!("Invalid hex u256 '{value}': {e}")))
    } else {
        U256::from_dec_str(value)
            .map_err(|e| AspError::InvalidInput(format!("Invalid decimal u256 '{value}': {e}")))
    }
}

fn parse_u160(value: &str) -> Result<U256, AspError> {
    let parsed = parse_u256(value)?;
    if parsed
        > U256::from_str_radix("ffffffffffffffffffffffffffffffffffffffff", 16)
            .expect("valid u160 max")
    {
        return Err(AspError::InvalidInput(format!(
            "sqrt_price_limit exceeds uint160 range: {value}"
        )));
    }
    Ok(parsed)
}

fn bytes32_from_u256_string(value: &str) -> Result<[u8; 32], AspError> {
    let parsed = parse_u256(value)?;
    let mut bytes = [0u8; 32];
    parsed.to_big_endian(&mut bytes);
    Ok(bytes)
}

fn encode_garaga_calldata(words: &[String]) -> Result<Bytes, AspError> {
    let mut encoded = Vec::with_capacity(words.len() * 32);

    for word in words {
        let value = parse_u256(word)?;
        let mut bytes = [0u8; 32];
        value.to_big_endian(&mut bytes);
        encoded.extend_from_slice(&bytes);
    }

    Ok(Bytes::from(encoded))
}

async fn wait_for_receipt(
    provider: &Provider<Http>,
    tx_hash: H256,
) -> Result<TransactionReceipt, AspError> {
    for attempt in 0..MAX_ATTEMPTS {
        match provider.get_transaction_receipt(tx_hash).await {
            Ok(Some(receipt)) => return Ok(receipt),
            Ok(None) => {
                if attempt + 1 == MAX_ATTEMPTS {
                    break;
                }
                tokio::time::sleep(POLL_INTERVAL).await;
            }
            Err(e) => {
                return Err(AspError::RpcError(format!(
                    "Failed while waiting for receipt {:#x}: {e}",
                    tx_hash
                )));
            }
        }
    }

    Err(AspError::TransactionFailed(format!(
        "Transaction {:#x} was not confirmed after {} attempts",
        tx_hash, MAX_ATTEMPTS
    )))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_u256_decimal() {
        assert_eq!(parse_u256("42").unwrap(), U256::from(42u64));
    }

    #[test]
    fn parse_u256_hex() {
        assert_eq!(parse_u256("0x2a").unwrap(), U256::from(42u64));
    }

    #[test]
    fn parse_u160_rejects_overflow() {
        let overflow = format!("0x1{}", "0".repeat(40));
        assert!(parse_u160(&overflow).is_err());
    }

    #[test]
    fn bytes32_from_u256_string_roundtrip() {
        let bytes = bytes32_from_u256_string("0x1234").unwrap();
        assert_eq!(&bytes[30..], &[0x12, 0x34]);
    }

    #[test]
    fn encode_garaga_calldata_packs_words_as_32_byte_chunks() {
        let encoded = encode_garaga_calldata(&["0x01".into(), "2".into()]).unwrap();
        assert_eq!(encoded.len(), 64);
        assert_eq!(&encoded[31..32], &[1]);
        assert_eq!(&encoded[63..64], &[2]);
    }
}
