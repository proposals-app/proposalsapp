//! Per-network eth_getLogs block range limits.
//!
//! The defaults fit the dRPC free plan used directly (at most 100 blocks per
//! eth_getLogs). Behind the eRPC proxy in apps/erpc, which splits ranges into
//! 100-block requests and runs them concurrently, larger ranges index faster;
//! set `ETHEREUM_MAX_BLOCK_RANGE` / `ARBITRUM_MAX_BLOCK_RANGE` to raise them.

use alloy::primitives::U64;

pub const ETHEREUM_MAX_BLOCK_RANGE_ENV: &str = "ETHEREUM_MAX_BLOCK_RANGE";
pub const ARBITRUM_MAX_BLOCK_RANGE_ENV: &str = "ARBITRUM_MAX_BLOCK_RANGE";

pub const DEFAULT_ETHEREUM_MAX_BLOCK_RANGE: u64 = 50;
pub const DEFAULT_ARBITRUM_MAX_BLOCK_RANGE: u64 = 100;

/// The max block range for a network, from `env_name` if set to a positive
/// integer, else `default`.
pub fn max_block_range(env_name: &str, default: u64) -> U64 {
    U64::from(parse_max_block_range(
        std::env::var(env_name).ok().as_deref(),
        default,
    ))
}

fn parse_max_block_range(value: Option<&str>, default: u64) -> u64 {
    value
        .and_then(|value| value.trim().parse::<u64>().ok())
        .filter(|range| *range > 0)
        .unwrap_or(default)
}

#[cfg(test)]
mod tests {
    use super::parse_max_block_range;

    #[test]
    fn uses_positive_overrides_only() {
        assert_eq!(parse_max_block_range(None, 100), 100);
        assert_eq!(parse_max_block_range(Some("2000"), 100), 2000);
        assert_eq!(parse_max_block_range(Some(" 1000 "), 100), 1000);
        assert_eq!(parse_max_block_range(Some("0"), 100), 100);
        assert_eq!(parse_max_block_range(Some("-5"), 100), 100);
        assert_eq!(parse_max_block_range(Some("lots"), 100), 100);
    }
}
