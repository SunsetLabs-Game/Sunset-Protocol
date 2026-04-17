use num_bigint::BigUint;
use num_traits::Num;

use crate::error::AspError;

/// Max valid tick in the CLMM (before offset).
const MAX_TICK: i32 = 887272;

/// Validate a hex string is a valid u256 (0x-prefixed, valid hex, fits in 256 bits).
pub fn validate_hex_u256(value: &str, field_name: &str) -> Result<(), AspError> {
    if value.is_empty() {
        return Err(AspError::InvalidInput(format!("{field_name} is required")));
    }

    let stripped = value
        .strip_prefix("0x")
        .or_else(|| value.strip_prefix("0X"))
        .ok_or_else(|| {
            AspError::InvalidInput(format!("{field_name} must be hex-prefixed (0x...)"))
        })?;

    if stripped.is_empty() {
        return Err(AspError::InvalidInput(format!(
            "{field_name} has empty hex value"
        )));
    }

    let big = BigUint::from_str_radix(stripped, 16)
        .map_err(|_| AspError::InvalidInput(format!("{field_name} is not valid hex")))?;

    let max_u256 = (BigUint::from(1u64) << 256) - BigUint::from(1u64);
    if big > max_u256 {
        return Err(AspError::InvalidInput(format!(
            "{field_name} exceeds u256 range"
        )));
    }

    Ok(())
}

/// Validate a decimal string is a valid non-negative integer.
pub fn validate_decimal(value: &str, field_name: &str) -> Result<(), AspError> {
    if value.is_empty() {
        return Err(AspError::InvalidInput(format!("{field_name} is required")));
    }
    BigUint::from_str_radix(value, 10).map_err(|_| {
        AspError::InvalidInput(format!("{field_name} must be a valid decimal number"))
    })?;
    Ok(())
}

/// Validate an EVM address (0x-prefixed, 20 bytes).
pub fn validate_address(value: &str, field_name: &str) -> Result<(), AspError> {
    if value.is_empty() {
        return Err(AspError::InvalidInput(format!("{field_name} is required")));
    }

    let stripped = value
        .strip_prefix("0x")
        .or_else(|| value.strip_prefix("0X"))
        .ok_or_else(|| {
            AspError::InvalidInput(format!("{field_name} must be hex-prefixed (0x...)"))
        })?;

    if stripped.len() != 40 {
        return Err(AspError::InvalidInput(format!(
            "{field_name} must be a 20-byte EVM address"
        )));
    }

    BigUint::from_str_radix(stripped, 16)
        .map_err(|_| AspError::InvalidInput(format!("{field_name} is not valid hex")))?;

    Ok(())
}

/// Validate a tick value is within the valid CLMM range.
pub fn validate_tick(tick: i32, field_name: &str) -> Result<(), AspError> {
    if !(-MAX_TICK..=MAX_TICK).contains(&tick) {
        return Err(AspError::InvalidInput(format!(
            "{field_name} must be between {} and {}",
            -MAX_TICK, MAX_TICK
        )));
    }
    Ok(())
}

/// Validate tick_lower < tick_upper.
pub fn validate_tick_range(tick_lower: i32, tick_upper: i32) -> Result<(), AspError> {
    validate_tick(tick_lower, "tick_lower")?;
    validate_tick(tick_upper, "tick_upper")?;
    if tick_lower >= tick_upper {
        return Err(AspError::InvalidInput(
            "tick_lower must be less than tick_upper".into(),
        ));
    }
    Ok(())
}

/// Validate a non-empty secret field (only check presence, not content).
pub fn validate_secret(value: &str, field_name: &str) -> Result<(), AspError> {
    if value.is_empty() {
        return Err(AspError::InvalidInput(format!("{field_name} is required")));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_hex_u256_valid() {
        assert!(validate_hex_u256("0x1234abcdef", "test").is_ok());
    }

    #[test]
    fn validate_hex_u256_empty() {
        assert!(validate_hex_u256("", "test").is_err());
    }

    #[test]
    fn validate_hex_u256_no_prefix() {
        assert!(validate_hex_u256("1234", "test").is_err());
    }

    #[test]
    fn validate_hex_u256_overflow() {
        // 2^256 = 1 followed by 64 zeros in hex
        let overflow = format!("0x1{}", "0".repeat(64));
        assert!(validate_hex_u256(&overflow, "test").is_err());
    }

    #[test]
    fn validate_hex_u256_max_valid() {
        // 2^256 - 1 = ff...f (64 f's)
        let max = format!("0x{}", "f".repeat(64));
        assert!(validate_hex_u256(&max, "test").is_ok());
    }

    #[test]
    fn validate_hex_u256_case_insensitive() {
        assert!(validate_hex_u256("0XaBcDeF", "test").is_ok());
    }

    #[test]
    fn validate_address_valid() {
        assert!(validate_address("0x1111111111111111111111111111111111111111", "test").is_ok());
    }

    #[test]
    fn validate_address_invalid_length() {
        let too_large = format!("0x{}", "f".repeat(64));
        assert!(validate_address(&too_large, "test").is_err());
    }

    #[test]
    fn validate_tick_range_valid() {
        assert!(validate_tick_range(-100, 100).is_ok());
    }

    #[test]
    fn validate_tick_range_lower_gte_upper() {
        assert!(validate_tick_range(100, 100).is_err());
        assert!(validate_tick_range(200, 100).is_err());
    }
}
