use crate::rindexer_lib::typings::networks::{get_arbitrum_provider_cache, get_avalanche_provider_cache, get_ethereum_provider_cache, get_optimism_provider_cache, get_polygon_provider_cache};
use anyhow::{Context, Result};
use chrono::{DateTime, NaiveDateTime, Utc};
use ethers::{providers::Middleware, types::BlockId};
use lazy_static::lazy_static;
use reqwest_middleware::ClientBuilder;
use reqwest_retry::{policies::ExponentialBackoff, RetryTransientMiddleware};
use rindexer::provider::JsonRpcCachedProvider;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tokio::time::sleep;
use tracing::{debug, warn};

#[derive(Clone)]
struct ChainConfig {
    provider: Arc<JsonRpcCachedProvider>,
    scan_api_url: Option<String>,
    scan_api_key: Option<String>,
    average_block_time_ms: u64,
}

lazy_static! {
    static ref CHAIN_CONFIG_MAP: HashMap<&'static str, ChainConfig> = vec![
        (
            "ethereum",
            ChainConfig {
                provider: get_ethereum_provider_cache(),
                scan_api_url: Some("https://api.etherscan.io/api".to_string()),
                scan_api_key: std::env::var("ETHERSCAN_API_KEY").ok(),
                average_block_time_ms: 12000,
            }
        ),
        (
            "arbitrum",
            ChainConfig {
                provider: get_arbitrum_provider_cache(),
                scan_api_url: Some("https://api.arbiscan.io/api".to_string()),
                scan_api_key: std::env::var("ARBISCAN_API_KEY").ok(),
                average_block_time_ms: 250,
            }
        ),
        (
            "optimism",
            ChainConfig {
                provider: get_optimism_provider_cache(),
                scan_api_url: Some("https://api-optimistic.etherscan.io/api".to_string()),
                scan_api_key: std::env::var("OPTIMISTIC_SCAN_API_KEY").ok(),
                average_block_time_ms: 2000,
            }
        ),
        (
            "polygon",
            ChainConfig {
                provider: get_polygon_provider_cache(),
                scan_api_url: None,
                scan_api_key: None,
                average_block_time_ms: 2000,
            }
        ),
        (
            "avalanche",
            ChainConfig {
                provider: get_avalanche_provider_cache(),
                scan_api_url: None,
                scan_api_key: None,
                average_block_time_ms: 2000,
            }
        ),
    ]
    .into_iter()
    .collect();
}

fn get_chain_config(network: &'static str) -> Result<ChainConfig> {
    CHAIN_CONFIG_MAP
        .get(network)
        .cloned()
        .context(format!("Unsupported network: {}", network))
}

#[derive(Debug, Serialize, Deserialize)]
struct EstimateTimestampResult {
    #[serde(rename = "CurrentBlock")]
    current_block: String,
    #[serde(rename = "CountdownBlock")]
    countdown_block: String,
    #[serde(rename = "RemainingBlock")]
    remaining_block: String,
    #[serde(rename = "EstimateTimeInSec")]
    estimate_time_in_sec: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct EstimateTimestamp {
    status: String,
    message: String,
    result: Option<EstimateTimestampResult>,
}

#[derive(Deserialize, PartialEq, Debug)]
struct EstimateBlock {
    status: String,
    message: String,
    result: String,
}

#[derive(Clone)]
struct BlockNumberCache {
    block_number: u64,
    timestamp: Instant,
}

lazy_static! {
    static ref BLOCK_NUMBER_CACHE: Mutex<HashMap<&'static str, BlockNumberCache>> = Mutex::new(HashMap::new());
}

async fn get_cached_block_number(network: &'static str, provider: &JsonRpcCachedProvider) -> Result<u64> {
    const CACHE_DURATION: Duration = Duration::from_secs(1);

    // Try to get cached value first
    let should_fetch = {
        let cache = BLOCK_NUMBER_CACHE.lock().expect("Failed to acquire lock");
        match cache.get(network) {
            Some(cached) => cached.timestamp.elapsed() >= CACHE_DURATION,
            None => true,
        }
    };

    if should_fetch {
        // Fetch new value
        let current_block_result = provider.get_block_number().await;

        match current_block_result {
            Ok(block_number) => {
                let current_block = block_number.as_u64();
                // Update cache
                let mut cache = BLOCK_NUMBER_CACHE.lock().expect("Failed to acquire lock");
                cache.insert(
                    network,
                    BlockNumberCache {
                        block_number: current_block,
                        timestamp: Instant::now(),
                    },
                );
                Ok(current_block)
            }
            Err(e) => {
                warn!(
                    network = network,
                    error = %e,
                    "Failed to get latest block number from provider, attempting to use cached value"
                );
                let cache = BLOCK_NUMBER_CACHE.lock().expect("Failed to acquire lock");
                if let Some(cached_block) = cache.get(network) {
                    warn!(
                        network = network,
                        cached_block = cached_block.block_number,
                        "Using cached block number"
                    );
                    Ok(cached_block.block_number)
                } else {
                    Err(e).context("Failed to get block number from provider and no cached value available")
                }
            }
        }
    } else {
        // Return cached value
        let cache = BLOCK_NUMBER_CACHE.lock().expect("Failed to acquire lock");
        Ok(cache.get(network).unwrap().block_number)
    }
}

pub async fn estimate_timestamp(network: &'static str, block_number: u64) -> Result<NaiveDateTime> {
    let config = get_chain_config(network)?;
    let provider = config.provider.get_inner_provider();

    let current_block = get_cached_block_number(network, &config.provider).await?;

    // First, try to get the timestamp directly from the provider, it's more reliable for past blocks
    // and a good fallback.
    let provider_block = provider
        .get_block(BlockId::Number(block_number.into()))
        .await;

    match provider_block {
        Ok(Some(block)) => {
            return Ok(
                DateTime::<Utc>::from_timestamp(block.timestamp.as_u64() as i64, 0)
                    .expect("Failed to create DateTime")
                    .naive_utc(),
            );
        }
        Ok(None) => {
            warn!(
                network = network,
                block_number = block_number,
                "Block not found on provider, falling back to API/estimation"
            );
            // Continue to API or estimation fallback
        }
        Err(e) => {
            warn!(network = network, block_number = block_number, error = %e, "Error fetching block from provider, falling back to API/estimation");
            // Continue to API or estimation fallback
        }
    }

    // Attempt to get estimated timestamp from block explorer API for future blocks primarily
    if block_number > current_block {
        if let Some(scan_api_url) = &config.scan_api_url {
            if let Some(scan_api_key) = &config.scan_api_key {
                match retry_request(scan_api_url, scan_api_key, block_number).await? {
                    Some(response) => {
                        if response.status == "1" {
                            if let Some(result) = response.result {
                                let estimate_time_in_sec: f64 = result
                                    .estimate_time_in_sec
                                    .parse()
                                    .context("Failed to parse EstimateTimeInSec")?;

                                return Ok(Utc::now()
                                    .checked_add_signed(chrono::Duration::seconds(estimate_time_in_sec as i64))
                                    .context("Failed to add duration to current time")?
                                    .naive_utc());
                            }
                        }
                    }
                    None => {
                        warn!(
                            network = network,
                            block_number = block_number,
                            "Failed to get estimate from API, falling back to simple estimation"
                        );
                    }
                }
            }
        }
    }

    // Fallback: Use simple estimation based on average block time in milliseconds
    let blocks_in_future = block_number.saturating_sub(current_block);
    let estimated_milliseconds = blocks_in_future * config.average_block_time_ms;

    warn!(
        network = network,
        block_number = block_number,
        method = "simple estimation",
        average_block_time_ms = config.average_block_time_ms,
        "Using simple block time estimation as final fallback"
    );

    Ok(Utc::now()
        .checked_add_signed(chrono::Duration::milliseconds(
            estimated_milliseconds as i64,
        ))
        .context("Failed to add duration to current time")?
        .naive_utc())
}

async fn retry_request(api_url: &str, api_key: &str, param: u64) -> Result<Option<EstimateTimestamp>> {
    let client = ClientBuilder::new(reqwest::Client::new())
        .with(RetryTransientMiddleware::new_with_policy(
            ExponentialBackoff::builder().build_with_max_retries(5),
        ))
        .build();

    for attempt in 1..=5 {
        let url = format!(
            "{}?module=block&action=getblockcountdown&blockno={}&apikey={}",
            api_url, param, api_key
        );

        debug!(url = %url, "Making API request");

        let response = match client
            .get(&url)
            .timeout(Duration::from_secs(5))
            .send()
            .await
        {
            Ok(resp) => resp,
            Err(e) => {
                warn!(
                    error = %e,
                    attempt = attempt,
                    "Request failed, retrying..."
                );
                if attempt < 5 {
                    sleep(Duration::from_millis(2u64.pow(attempt) * 1000)).await;
                    continue;
                }
                return Ok(None);
            }
        };

        let status = response.status();
        if !status.is_success() {
            warn!(
                status = %status,
                "Received error status code from API"
            );
            if attempt < 5 {
                sleep(Duration::from_millis(2u64.pow(attempt) * 1000)).await;
                continue;
            }
            return Ok(None);
        }

        // Log the raw response for debugging
        let response_text = response.text().await?;
        debug!(response = %response_text, "Received API response");

        match serde_json::from_str::<EstimateTimestamp>(&response_text) {
            Ok(parsed_response) => {
                return Ok(Some(parsed_response));
            }
            Err(e) => {
                warn!(
                    error = %e,
                    response = %response_text,
                    "Failed to parse API response"
                );
                if attempt < 5 {
                    sleep(Duration::from_millis(2u64.pow(attempt) * 1000)).await;
                    continue;
                }
                return Ok(None);
            }
        }
    }

    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    #[tokio::test]
    async fn test_estimate_timestamp_ethereum_future_block() -> Result<()> {
        let current_block = get_ethereum_provider_cache()
            .get_block_number()
            .await?
            .as_u64();
        let future_block_number = current_block + 100;
        let estimated_time = estimate_timestamp("ethereum", future_block_number).await?;

        // Check if the estimated time is not epoch and is in the future (within a reasonable bound, e.g., a
        // few hours from now).
        let now = Utc::now().naive_utc();
        assert!(
            estimated_time > NaiveDateTime::UNIX_EPOCH,
            "Estimated time should not be epoch"
        );
        assert!(
            estimated_time > now - Duration::hours(1),
            "Estimated time should be in the future or very recent"
        ); // Relaxed bound
        assert!(
            estimated_time < now + Duration::hours(24),
            "Estimated time should not be too far in the future"
        ); // Set an upper bound to avoid test failures if blocks are very delayed.

        println!(
            "Estimated time for ethereum block {}: {:?}",
            future_block_number, estimated_time
        );
        Ok(())
    }

    #[tokio::test]
    async fn test_estimate_timestamp_ethereum_past_block() -> Result<()> {
        // Choose a block number in the past, but not too old to ensure it's still available on providers.
        let current_block = get_ethereum_provider_cache()
            .get_block_number()
            .await?
            .as_u64();
        let past_block_number = current_block - 1000; // Example past block, 1000 blocks behind
        let estimated_time = estimate_timestamp("ethereum", past_block_number).await?;

        // For past blocks, we expect a valid timestamp fetched directly from the provider, not epoch.
        assert!(
            estimated_time > NaiveDateTime::UNIX_EPOCH,
            "Estimated time for past block should not be epoch"
        );

        // Optionally, we can further assert if the timestamp is indeed in the past.
        let now = Utc::now().naive_utc();
        assert!(
            estimated_time < now,
            "Estimated time for past block should be in the past"
        );

        println!(
            "Estimated time for ethereum block {}: {:?}",
            past_block_number, estimated_time
        );
        Ok(())
    }

    #[tokio::test]
    async fn test_estimate_timestamp_polygon_past_block() -> Result<()> {
        // Polygon doesn't use API key in config, so this tests provider fallback for past blocks.
        let current_block = get_polygon_provider_cache()
            .get_block_number()
            .await?
            .as_u64();
        let past_block_number = current_block - 1000; // Example past block for polygon
        let estimated_time = estimate_timestamp("polygon", past_block_number).await?;

        // Should fetch from provider, so expect valid timestamp, not epoch.
        assert!(
            estimated_time > NaiveDateTime::UNIX_EPOCH,
            "Estimated time for polygon past block should not be epoch"
        );

        println!(
            "Estimated time for polygon block {}: {:?}",
            past_block_number, estimated_time
        );
        Ok(())
    }

    #[tokio::test]
    async fn test_estimate_timestamp_unsupported_network() -> Result<()> {
        let result = estimate_timestamp("unsupported_network", 1000000).await;
        assert!(result.is_err(), "Expected error for unsupported network");
        assert_eq!(
            result.unwrap_err().to_string(),
            "Unsupported network: unsupported_network"
        );
        Ok(())
    }

    #[tokio::test]
    async fn test_estimate_timestamp_arbitrum_future_block() -> Result<()> {
        // Requires ARBISCAN_API_KEY env variable.
        let current_block = get_arbitrum_provider_cache()
            .get_block_number()
            .await?
            .as_u64();
        let future_block_number = current_block + 100; // Example future block for arbitrum
        let estimated_time = estimate_timestamp("arbitrum", future_block_number).await?;

        // Check if the estimated time is not epoch and is in the future.
        let now = Utc::now().naive_utc();
        assert!(
            estimated_time > NaiveDateTime::UNIX_EPOCH,
            "Estimated time should not be epoch"
        );
        assert!(
            estimated_time > now - Duration::hours(1),
            "Estimated time should be in the future or very recent"
        );
        assert!(
            estimated_time < now + Duration::hours(24),
            "Estimated time should not be too far in the future"
        );

        println!(
            "Estimated time for arbitrum block {}: {:?}",
            future_block_number, estimated_time
        );
        Ok(())
    }

    #[tokio::test]
    async fn test_estimate_timestamp_optimism_future_block() -> Result<()> {
        // Requires OPTIMISTIC_SCAN_API_KEY env variable.
        let current_block = get_optimism_provider_cache()
            .get_block_number()
            .await?
            .as_u64();
        let future_block_number = current_block + 100; // Example future block for optimism
        let estimated_time = estimate_timestamp("optimism", future_block_number).await?;

        // Check if the estimated time is not epoch and is in the future.
        let now = Utc::now().naive_utc();
        assert!(
            estimated_time > NaiveDateTime::UNIX_EPOCH,
            "Estimated time should not be epoch"
        );
        assert!(
            estimated_time > now - Duration::hours(1),
            "Estimated time should be in the future or very recent"
        );
        assert!(
            estimated_time < now + Duration::hours(24),
            "Estimated time should not be too far in the future"
        );

        println!(
            "Estimated time for optimism block {}: {:?}",
            future_block_number, estimated_time
        );
        Ok(())
    }
}
