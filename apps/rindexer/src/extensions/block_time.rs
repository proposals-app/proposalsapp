use crate::rindexer_lib::typings::networks::{get_arbitrum_provider_cache, get_avalanche_provider_cache, get_ethereum_provider_cache, get_optimism_provider_cache, get_polygon_provider_cache};
use anyhow::{Context, Result};
use chrono::{DateTime, NaiveDateTime, Utc};
use ethers::{providers::Middleware, types::BlockId};
use lazy_static::lazy_static;
use reqwest_middleware::ClientBuilder;
use reqwest_retry::{policies::ExponentialBackoff, RetryTransientMiddleware};
use rindexer::provider::JsonRpcCachedProvider;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Arc, time::Duration};
use tracing::{debug, instrument, warn};

// Configuration for each supported chain.
#[derive(Clone)]
struct ChainConfig {
    provider: Arc<JsonRpcCachedProvider>,
    scan_api_url: Option<String>,
    scan_api_key: Option<String>,
    average_block_time_ms: u64,
}

// Lazily initialized static map of chain configurations.
lazy_static! {
    static ref CHAIN_CONFIG_MAP: HashMap<&'static str, ChainConfig> = {
        let mut map = HashMap::new();
        map.insert(
            "ethereum",
            ChainConfig {
                provider: get_ethereum_provider_cache(),
                scan_api_url: Some("https://api.etherscan.io/api".to_string()),
                scan_api_key: std::env::var("ETHERSCAN_API_KEY").ok(),
                average_block_time_ms: 12000,
            },
        );
        map.insert(
            "arbitrum",
            ChainConfig {
                provider: get_arbitrum_provider_cache(),
                scan_api_url: Some("https://api.arbiscan.io/api".to_string()),
                scan_api_key: std::env::var("ARBISCAN_API_KEY").ok(),
                average_block_time_ms: 250,
            },
        );
        map.insert(
            "optimism",
            ChainConfig {
                provider: get_optimism_provider_cache(),
                scan_api_url: Some("https://api-optimistic.etherscan.io/api".to_string()),
                scan_api_key: std::env::var("OPTIMISTIC_SCAN_API_KEY").ok(),
                average_block_time_ms: 2000,
            },
        );
        map.insert(
            "polygon",
            ChainConfig {
                provider: get_polygon_provider_cache(),
                scan_api_url: None,
                scan_api_key: None,
                average_block_time_ms: 2000,
            },
        );
        map.insert(
            "avalanche",
            ChainConfig {
                provider: get_avalanche_provider_cache(),
                scan_api_url: None,
                scan_api_key: None,
                average_block_time_ms: 2000,
            },
        );
        map
    };
}

// Retrieves the configuration for a given chain.
fn get_chain_config(network: &'static str) -> Result<ChainConfig> {
    CHAIN_CONFIG_MAP
        .get(network)
        .cloned()
        .context(format!("Unsupported network: {}", network))
}

// Structs for deserializing API responses.
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

#[derive(Debug, Serialize, Deserialize)]
struct BlockRewardResult {
    #[serde(rename = "timeStamp")]
    timestamp: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct BlockRewardResponse {
    status: String,
    message: String,
    result: Option<BlockRewardResult>,
}

lazy_static! {
    static ref RETRY_POLICY: ExponentialBackoff = ExponentialBackoff::builder().build_with_max_retries(3);
}

// Estimates the timestamp for a given block number on a specified network.
#[instrument]
pub async fn estimate_timestamp(network: &'static str, block_number: u64) -> Result<NaiveDateTime> {
    let config = get_chain_config(network)?;

    let provider = config.provider.clone();
    let provider = provider.get_inner_provider();

    // Get the current block number (cached).
    let current_block = provider
        .get_block_number()
        .await
        .context("Failed to get current block number")?
        .as_u64();

    // Check if the block is in the past or future.
    if block_number <= current_block {
        // 1. Try to get the timestamp directly from the provider (for past blocks).
        match provider
            .get_block(BlockId::Number(block_number.into()))
            .await
        {
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
                    "Block not found using provider.get_block()"
                );
            }
            Err(e) => {
                warn!(
                    network = network,
                    block_number = block_number,
                    error = %e,
                    "Failed to get block from provider"
                );
            }
        }

        // 2. If provider fails, try getblockreward API (if available).
        if let (Some(scan_api_url), Some(scan_api_key)) = (&config.scan_api_url, &config.scan_api_key) {
            match retry_block_reward_request(scan_api_url, scan_api_key, block_number).await {
                Ok(Some(response)) => {
                    if response.status == "1" {
                        if let Some(result) = response.result {
                            let timestamp: i64 = result
                                .timestamp
                                .parse()
                                .context("Failed to parse timestamp")?;
                            return Ok(DateTime::<Utc>::from_timestamp(timestamp, 0)
                                .context("Failed to create DateTime from timestamp")?
                                .naive_utc());
                        }
                    }
                }
                Ok(None) => {
                    warn!(
                        network = network,
                        block_number = block_number,
                        "Block reward API returned no result"
                    );
                }
                Err(e) => {
                    warn!(
                        network = network,
                        block_number = block_number,
                        error = %e,
                        "Block reward API request failed"
                    );
                }
            }
        }
    } else {
        // 3. If the requested block is in the future, try the block explorer API (getblockcountdown).
        if let (Some(scan_api_url), Some(scan_api_key)) = (&config.scan_api_url, &config.scan_api_key) {
            match retry_api_request(scan_api_url, scan_api_key, block_number).await {
                Ok(Some(response)) => {
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
                Ok(None) => {
                    warn!(
                        network = network,
                        block_number = block_number,
                        "Block explorer API returned no result"
                    );
                }
                Err(e) => {
                    warn!(
                        network = network,
                        block_number = block_number,
                        error = %e,
                        "Block explorer API request failed"
                    );
                }
            }
        }
    }

    // 4. Fallback: Estimate with average block time.
    estimate_with_average_block_time(
        network,
        current_block,
        block_number,
        config.average_block_time_ms,
    )
}

// Estimates timestamp using average block time.
fn estimate_with_average_block_time(network: &'static str, current_block: u64, target_block: u64, average_block_time_ms: u64) -> Result<NaiveDateTime> {
    let now = Utc::now();

    // Calculate the block difference, handling both future and past blocks
    let (blocks_difference, is_future) = if target_block > current_block {
        (target_block - current_block, true)
    } else {
        (current_block - target_block, false)
    };

    let estimated_milliseconds = blocks_difference * average_block_time_ms;

    warn!(
        network = network,
        target_block = target_block,
        method = "simple estimation",
        average_block_time_ms = average_block_time_ms,
        "Using simple block time estimation"
    );

    if is_future {
        now.checked_add_signed(chrono::Duration::milliseconds(
            estimated_milliseconds as i64,
        ))
    } else {
        now.checked_sub_signed(chrono::Duration::milliseconds(
            estimated_milliseconds as i64,
        ))
    }
    .context("Failed to calculate timestamp")
    .map(|dt| dt.naive_utc())
}

// Makes a retrying API request to the block explorer for getblockcountdown.
#[instrument(skip(api_url, api_key))]
async fn retry_api_request(api_url: &str, api_key: &str, block_number: u64) -> Result<Option<EstimateTimestamp>> {
    let client = ClientBuilder::new(reqwest::Client::new())
        .with(RetryTransientMiddleware::new_with_policy(
            RETRY_POLICY.clone(),
        ))
        .build();

    let url = format!(
        "{}?module=block&action=getblockcountdown&blockno={}&apikey={}",
        api_url, block_number, api_key
    );

    let response = client
        .get(&url)
        .timeout(Duration::from_secs(5))
        .send()
        .await;

    match response {
        Ok(response) => {
            if !response.status().is_success() {
                let status = response.status();
                let text = response
                    .text()
                    .await
                    .unwrap_or_else(|_| "Failed to read response body".to_string());
                return Err(anyhow::anyhow!(
                    "Received error status code from API: {}, body: {}",
                    status,
                    text
                ));
            }

            let response_text = response.text().await?;
            debug!(response = %response_text, "Received API response");

            serde_json::from_str::<EstimateTimestamp>(&response_text)
                .map(Some)
                .context("Failed to parse API response")
        }
        Err(e) => {
            println!("Request failed: {:?}", e); // Print the reqwest error
            Err(e).context("Request failed")
        }
    }
}

// Makes a retrying API request to the block explorer for getblockreward.
#[instrument(skip(api_url, api_key))]
async fn retry_block_reward_request(api_url: &str, api_key: &str, block_number: u64) -> Result<Option<BlockRewardResponse>> {
    let client = ClientBuilder::new(reqwest::Client::new())
        .with(RetryTransientMiddleware::new_with_policy(
            RETRY_POLICY.clone(),
        ))
        .build();

    let url = format!(
        "{}?module=block&action=getblockreward&blockno={}&apikey={}",
        api_url, block_number, api_key
    );

    let response = client
        .get(&url)
        .timeout(Duration::from_secs(5))
        .send()
        .await;

    match response {
        Ok(response) => {
            if !response.status().is_success() {
                let status = response.status();
                let text = response
                    .text()
                    .await
                    .unwrap_or_else(|_| "Failed to read response body".to_string());
                return Err(anyhow::anyhow!(
                    "Received error status code from API: {}, body: {}",
                    status,
                    text
                ));
            }

            let response_text = response.text().await?;
            debug!(response = %response_text, "Received API response");

            serde_json::from_str::<BlockRewardResponse>(&response_text)
                .map(Some)
                .context("Failed to parse block reward API response")
        }
        Err(e) => Err(e).context("Block reward request failed"),
    }
}

// Unit tests.
#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration, NaiveDate, NaiveTime};
    use rand::prelude::*;
    use std::time::Instant;
    use tokio::task::JoinSet;

    async fn test_estimate_timestamp_scenario(
        network: &'static str,
        block_offset: i64, // Positive for future, negative for past
    ) -> Result<()> {
        let current_block = match network {
            "ethereum" => get_ethereum_provider_cache().get_block_number().await?,
            "arbitrum" => get_arbitrum_provider_cache().get_block_number().await?,
            "optimism" => get_optimism_provider_cache().get_block_number().await?,
            "polygon" => get_polygon_provider_cache().get_block_number().await?,
            "avalanche" => get_avalanche_provider_cache().get_block_number().await?,
            _ => panic!("Unsupported network for testing"),
        }
        .as_u64();

        let target_block_number = if block_offset >= 0 {
            current_block.checked_add(block_offset as u64)
        } else {
            current_block.checked_sub(block_offset.abs() as u64)
        }
        .context("Invalid block offset")?;

        let estimated_time = estimate_timestamp(network, target_block_number).await?;

        // Basic validation: estimated time should not be epoch.
        assert!(
            estimated_time > NaiveDateTime::UNIX_EPOCH,
            "Estimated time should not be epoch"
        );

        let now = Utc::now().naive_utc();

        if block_offset >= 0 {
            // Future block: should be in the future (within a reasonable bound).
            assert!(
                estimated_time > now - Duration::hours(1), // Allow some leeway for test execution time.
                "Estimated time should be in the future or very recent"
            );
            assert!(
                estimated_time < now + Duration::hours(24),
                "Estimated time should not be too far in the future"
            );
        } else {
            // Past block: should be in the past.
            assert!(
                estimated_time < now,
                "Estimated time for past block should be in the past"
            );
        }

        println!(
            "Estimated time for {} block {}: {:?}",
            network, target_block_number, estimated_time
        );
        Ok(())
    }

    #[tokio::test]
    async fn test_estimate_timestamp_ethereum_future() -> Result<()> {
        test_estimate_timestamp_scenario("ethereum", 100).await
    }

    #[tokio::test]
    async fn test_estimate_timestamp_ethereum_past() -> Result<()> {
        test_estimate_timestamp_scenario("ethereum", -1000).await
    }

    #[tokio::test]
    async fn test_estimate_timestamp_arbitrum_future() -> Result<()> {
        test_estimate_timestamp_scenario("arbitrum", 100).await
    }

    #[tokio::test]
    async fn test_estimate_timestamp_arbitrum_past() -> Result<()> {
        test_estimate_timestamp_scenario("arbitrum", -1000).await
    }

    #[tokio::test]
    async fn test_estimate_timestamp_optimism_future() -> Result<()> {
        test_estimate_timestamp_scenario("optimism", 100).await
    }

    #[tokio::test]
    async fn test_estimate_timestamp_optimism_past() -> Result<()> {
        test_estimate_timestamp_scenario("optimism", -1000).await
    }

    #[tokio::test]
    async fn test_estimate_timestamp_polygon_future() -> Result<()> {
        test_estimate_timestamp_scenario("polygon", 100).await
    }

    #[tokio::test]
    async fn test_estimate_timestamp_polygon_past() -> Result<()> {
        test_estimate_timestamp_scenario("polygon", -1000).await
    }

    #[tokio::test]
    async fn test_estimate_timestamp_avalanche_future() -> Result<()> {
        test_estimate_timestamp_scenario("avalanche", 100).await
    }

    #[tokio::test]
    async fn test_estimate_timestamp_avalanche_past() -> Result<()> {
        test_estimate_timestamp_scenario("avalanche", -1000).await
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
    async fn test_simple_estimation() {
        // Test data
        let current_block = 1000;
        let average_block_time_ms = 2000; // 2 seconds
        let tolerance_ms = 5; // Allow 5ms of difference

        // Test case 1: Future block
        let target_block_future = 1100;
        let now_future = Utc::now().naive_utc(); // Capture current time *before* the call
        let estimated_time_future = estimate_with_average_block_time(
            "test_network",
            current_block,
            target_block_future,
            average_block_time_ms,
        )
        .unwrap();

        // Calculate the expected future time.
        let expected_future_time = now_future + Duration::milliseconds(((target_block_future - current_block) * average_block_time_ms) as i64);

        // Check if the difference is within tolerance (using num_milliseconds).
        assert!(
            (estimated_time_future - expected_future_time)
                .num_milliseconds()
                .abs()
                < tolerance_ms,
            "Estimated future time should be within tolerance. Estimated: {}, Expected: {}, Diff: {}",
            estimated_time_future,
            expected_future_time,
            (estimated_time_future - expected_future_time).num_milliseconds()
        );

        // Test case 2: Past block
        let target_block_past = 900;
        let now_past = Utc::now().naive_utc(); // Capture the current time *before* the call.
        let estimated_time_past = estimate_with_average_block_time(
            "test_network",
            current_block,
            target_block_past,
            average_block_time_ms,
        )
        .unwrap();

        // Calculate the expected past time.
        let expected_past_time = now_past - Duration::milliseconds(((current_block - target_block_past) * average_block_time_ms) as i64);

        println!(
            "Estimated time past: {}, Now: {}",
            estimated_time_past, now_past
        );

        // Check if the difference is within tolerance (using num_milliseconds).
        assert!(
            (estimated_time_past - expected_past_time)
                .num_milliseconds()
                .abs()
                < tolerance_ms,
            "Estimated past time should be within tolerance. Estimated: {}, Expected: {}, Diff: {}",
            estimated_time_past,
            expected_past_time,
            (estimated_time_past - expected_past_time).num_milliseconds()
        );

        // Test case 3: Current block
        let target_block_current = 1000;
        let now_current = Utc::now().naive_utc(); // Capture the current time *before* the call.
        let estimated_time_current = estimate_with_average_block_time(
            "test_network",
            current_block,
            target_block_current,
            average_block_time_ms,
        )
        .unwrap();

        // The expected time is simply the current time.

        // Check if the difference is within tolerance (using num_milliseconds).
        assert!(
            (estimated_time_current - now_current)
                .num_milliseconds()
                .abs()
                < tolerance_ms,
            "Estimated current time should be within tolerance. Estimated: {}, Now: {}, Diff: {}",
            estimated_time_current,
            now_current,
            (estimated_time_current - now_current).num_milliseconds()
        );
    }

    #[tokio::test]
    async fn test_estimate_timestamp_arbitrum_specific_past() -> Result<()> {
        let network = "arbitrum";
        let block_number = 309199011;
        let expected_time = NaiveDateTime::new(
            NaiveDate::from_ymd_opt(2025, 2, 23).unwrap(),
            NaiveTime::from_hms_opt(22, 6, 28).unwrap(),
        );
        let tolerance = Duration::seconds(5); // Reasonable tolerance for past blocks

        let estimated_time = estimate_timestamp(network, block_number).await?;

        println!("Estimated: {}, Expected: {}", estimated_time, expected_time);

        assert!(
            (estimated_time - expected_time).abs() <= tolerance,
            "Arbitrum past block estimation off. Expected: {}, Estimated: {}, Difference: {}",
            expected_time,
            estimated_time,
            (estimated_time - expected_time).num_seconds()
        );
        Ok(())
    }

    #[tokio::test]
    async fn test_concurrency() -> Result<()> {
        let mut tasks = JoinSet::new();
        let networks = ["ethereum", "arbitrum", "optimism", "polygon", "avalanche"];
        let offsets = [-100, 100, -1000, 1000, 0]; // Test past, future, and current blocks

        for &network in &networks {
            for &offset in &offsets {
                tasks.spawn(async move { test_estimate_timestamp_scenario(network, offset).await });
            }
        }

        while let Some(res) = tasks.join_next().await {
            res??; // Propagate any errors from the tasks
        }
        Ok(())
    }

    #[tokio::test]
    async fn test_intensive_concurrency_all_networks_sequential() -> Result<()> {
        let networks = ["ethereum", "arbitrum", "optimism", "polygon", "avalanche"];
        let num_tasks_per_network = 200; // Reduced tasks per network for sequential testing
        let mut rng = rand::thread_rng(); // Initialize a thread-local RNG

        for network in networks {
            println!("Starting intensive test for network: {}", network);
            let current_block = match network {
                "ethereum" => get_ethereum_provider_cache().get_block_number().await?,
                "arbitrum" => get_arbitrum_provider_cache().get_block_number().await?,
                "optimism" => get_optimism_provider_cache().get_block_number().await?,
                "polygon" => get_polygon_provider_cache().get_block_number().await?,
                "avalanche" => get_avalanche_provider_cache().get_block_number().await?,
                _ => panic!("Unsupported network for testing"),
            }
            .as_u64();

            let mut tasks = JoinSet::new();
            let network_start_time = Instant::now(); // Time for this network

            for i in 0..num_tasks_per_network {
                let offset: i64 = rng.gen_range(-1_000_000..=1_000_000);

                let target_block_number = if offset >= 0 {
                    current_block.checked_add(offset as u64)
                } else {
                    current_block.checked_sub(offset.checked_abs().context("offset abs overflow")? as u64)
                }
                .context("Invalid block offset")?;

                tasks.spawn(async move {
                    let task_start_time = Instant::now();
                    let result = estimate_timestamp(network, target_block_number).await;
                    let task_duration = task_start_time.elapsed();

                    match result {
                        Ok(estimated_time) => {
                            assert!(estimated_time > NaiveDateTime::UNIX_EPOCH);
                            println!(
                                "Network: {}, Task {}: Estimated time for block {}: {:?}, took {:?}",
                                network, i, target_block_number, estimated_time, task_duration
                            );
                            Ok(())
                        }
                        Err(e) => {
                            println!(
                                "Network: {}, Task {} (block {}): Error: {}, took {:?}",
                                network, i, target_block_number, e, task_duration
                            );
                            Err(e)
                        }
                    }
                });
            }
            let mut error_count = 0;
            while let Some(res) = tasks.join_next().await {
                if let Err(e) = res? {
                    eprintln!("Task failed: {:?}", e);
                    error_count += 1;
                }
            }

            let network_duration = network_start_time.elapsed();
            println!(
                "Total duration for {} tasks on network {}: {:?}",
                num_tasks_per_network, network, network_duration
            );
            println!(
                "Number of failed tasks for network {}: {}",
                network, error_count
            );
            assert_eq!(
                error_count, 0,
                "There were failing concurrent tasks for network {}.",
                network
            );
        }

        Ok(())
    }
}
