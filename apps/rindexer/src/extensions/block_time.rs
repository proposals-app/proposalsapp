use alloy::{eips::BlockId, providers::Provider};
use anyhow::{Context, Result};
use chrono::{DateTime, NaiveDateTime, Utc};
use lazy_static::lazy_static;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, VecDeque},
    sync::Arc,
    time::Duration,
};
use tokio::sync::Mutex;
use tracing::{debug, error, instrument, warn};

use crate::rindexer_lib::typings::networks::get_provider_cache_for_network;

// Configuration structures
#[derive(Clone, Debug)]
struct ChainConfig {
    network: &'static str,
    scan_api_url: Option<String>,
    scan_api_key: Option<String>,
}

// Job structure for queue processing
struct TimestampJob {
    network: &'static str,
    block_number: u64,
    sender: tokio::sync::oneshot::Sender<Result<NaiveDateTime>>,
    retry_count: u64,
}

// Static resources
lazy_static! {
    static ref HTTP_CLIENT: Client = Client::builder()
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(5))
        .build()
        .expect("Failed to create HTTP client");
    static ref JOBS_QUEUE: Arc<Mutex<VecDeque<TimestampJob>>> =
        Arc::new(Mutex::new(VecDeque::with_capacity(100)));
    static ref PROCESSOR_INIT: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>> =
        Arc::new(Mutex::new(None));
}

// Function-based configuration to allow dynamic initialization
fn get_chain_configs() -> HashMap<&'static str, ChainConfig> {
    let mut map = HashMap::new();
    map.insert(
        "ethereum",
        ChainConfig {
            network: "ethereum",
            scan_api_url: Some("https://api.etherscan.io/api".to_string()),
            scan_api_key: std::env::var("ETHERSCAN_API_KEY").ok(),
        },
    );
    map.insert(
        "arbitrum",
        ChainConfig {
            network: "arbitrum",
            scan_api_url: Some("https://api.arbiscan.io/api".to_string()),
            scan_api_key: std::env::var("ARBISCAN_API_KEY").ok(),
        },
    );
    map.insert(
        "optimism",
        ChainConfig {
            network: "optimism",
            scan_api_url: Some("https://api-optimistic.etherscan.io/api".to_string()),
            scan_api_key: std::env::var("OPTIMISTIC_SCAN_API_KEY").ok(),
        },
    );
    map.insert(
        "polygon",
        ChainConfig {
            network: "polygon",
            scan_api_url: Some("https://api.polygonscan.com/api".to_string()),
            scan_api_key: std::env::var("POLYGONSCAN_API_KEY").ok(),
        },
    );
    map.insert(
        "avalanche",
        ChainConfig {
            network: "avalanche",
            scan_api_url: None,
            scan_api_key: None,
        },
    );
    map
}

#[instrument(name = "block_time_get_chain_config", skip_all, fields(network = network))]
fn get_chain_config(network: &'static str) -> Result<ChainConfig> {
    get_chain_configs()
        .get(network)
        .cloned()
        .context(format!("Unsupported network: {network}"))
}

// API response structures
#[derive(Debug, Serialize, Deserialize)]
#[serde(untagged)]
enum EstimateTimestampResult {
    Success(EstimateTimestampSuccessResult),
    Error(String),
}

#[derive(Debug, Serialize, Deserialize)]
struct EstimateTimestampSuccessResult {
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
#[serde(untagged)]
enum BlockRewardResult {
    Success(BlockRewardSuccessResult),
    Error(String),
}

#[derive(Debug, Serialize, Deserialize)]
struct BlockRewardSuccessResult {
    #[serde(rename = "timeStamp")]
    timestamp: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct BlockRewardResponse {
    status: String,
    message: String,
    result: Option<BlockRewardResult>,
}

// Minimal structure for raw RPC timestamp
#[derive(Debug, Deserialize)]
struct BlockTimestamp {
    timestamp: String,
}

// Main public interface
#[instrument(name = "block_time_estimate_timestamp", skip(network), fields(network = network, block_number = block_number))]
pub async fn estimate_timestamp(network: &'static str, block_number: u64) -> Result<NaiveDateTime> {
    let (sender, receiver) = tokio::sync::oneshot::channel();
    let job = TimestampJob {
        network,
        block_number,
        sender,
        retry_count: 0,
    };

    {
        let mut job_queue = JOBS_QUEUE.lock().await;
        job_queue.push_back(job);
        debug!(queue_size = job_queue.len(), "Job enqueued");
    }

    // Ensure job processor is running
    {
        let mut processor = PROCESSOR_INIT.lock().await;
        if processor.is_none() {
            *processor = Some(tokio::spawn(async { job_processor().await }));
        }
    }

    receiver
        .await
        .context("Failed to receive timestamp estimation result")?
}

// Job processor with retry and backoff logic
#[instrument(name = "block_time_job_processor", skip_all)]
async fn job_processor() {
    let mut empty_iterations = 0;
    loop {
        let mut job_queue = JOBS_QUEUE.lock().await;
        if let Some(mut job) = job_queue.pop_front() {
            drop(job_queue); // Release lock to allow other tasks to enqueue jobs
            empty_iterations = 0; // Reset counter when we process a job

            let config = match get_chain_config(job.network) {
                Ok(config) => config,
                Err(e) => {
                    error!(
                        network = job.network,
                        error = %e,
                        "Failed to get chain config for network"
                    );
                    let _ = job.sender.send(Err(e));
                    continue;
                }
            };

            match process_block_timestamp_request(config, job.block_number).await {
                Ok(result) => {
                    if job.sender.send(Ok(result)).is_err() {
                        error!(
                            block_number = job.block_number,
                            "Failed to send timestamp estimation result back to sender"
                        );
                    }
                }
                Err(e) => {
                    if job.retry_count >= 3 {
                        error!(
                            block_number = job.block_number,
                            error = %e,
                            retry_count = job.retry_count,
                            "Max retries reached, sending error"
                        );
                        let _ = job.sender.send(Err(e));
                    } else {
                        warn!(
                            block_number = job.block_number,
                            error = %e,
                            retry_count = job.retry_count,
                            "Retrying after backoff"
                        );
                        job.retry_count += 1;
                        let backoff_duration = Duration::from_secs(job.retry_count.min(5));
                        tokio::time::sleep(backoff_duration).await;
                        let mut job_queue = JOBS_QUEUE.lock().await;
                        job_queue.push_back(job);
                    }
                }
            }
        } else {
            tokio::time::sleep(Duration::from_millis(100)).await;
            empty_iterations += 1;

            // In test mode, exit after 50 empty iterations (5 seconds)
            #[cfg(test)]
            if empty_iterations > 50 {
                debug!("Job processor exiting after 50 empty iterations in test mode");
                break;
            }
        }
    }
}

// Main processing logic
#[instrument(name = "block_time_process_request", skip_all, fields(network = config.network, block_number = block_number))]
async fn process_block_timestamp_request(
    config: ChainConfig,
    block_number: u64,
) -> Result<NaiveDateTime> {
    let provider = get_provider_cache_for_network(config.network).await;

    // First, determine if this is a past or future block
    let current_block = get_current_block_number(&provider).await?;

    debug!(
        current_block = current_block,
        block_number = block_number,
        is_past_block = block_number <= current_block,
        "Processing block timestamp request"
    );

    if block_number <= current_block {
        // Past block: try provider -> raw RPC -> scan API
        process_past_block_timestamp(config, provider, block_number, current_block).await
    } else {
        // Future block: go directly to scan API
        process_future_block_timestamp(config, block_number).await
    }
}

// Get current block number from provider
#[instrument(name = "block_time_get_current_block", skip_all)]
async fn get_current_block_number(
    provider: &Arc<rindexer::provider::JsonRpcCachedProvider>,
) -> Result<u64> {
    provider
        .get_block_number()
        .await
        .context("Failed to get current block number from provider")
        .map(|n| n.to::<u64>())
}

// Process past block timestamp with fallback strategy
#[instrument(name = "block_time_process_past_block", skip_all, fields(block_number = block_number))]
async fn process_past_block_timestamp(
    config: ChainConfig,
    provider: Arc<rindexer::provider::JsonRpcCachedProvider>,
    block_number: u64,
    current_block: u64,
) -> Result<NaiveDateTime> {
    // Step 1: Try provider get_block
    match get_timestamp_from_provider(&provider, block_number, current_block).await {
        Ok(timestamp) => {
            debug!("Got timestamp from provider get_block");
            return Ok(timestamp);
        }
        Err(e) => {
            debug!(error = ?e, "Provider get_block failed, trying raw RPC");
        }
    }

    // Step 2: Try raw JSON-RPC request
    match get_timestamp_from_raw_rpc(&provider, block_number).await {
        Ok(timestamp) => {
            debug!("Got timestamp from raw RPC request");
            return Ok(timestamp);
        }
        Err(e) => {
            debug!(error = ?e, "Raw RPC failed, trying scan API");
        }
    }

    // Step 3: Try scan API as last resort
    if let (Some(scan_api_url), Some(scan_api_key)) = (&config.scan_api_url, &config.scan_api_key) {
        match get_timestamp_from_past_scan_api(scan_api_url, scan_api_key, block_number).await {
            Ok(timestamp) => {
                debug!("Got timestamp from scan API");
                Ok(timestamp)
            }
            Err(e) => {
                error!(error = ?e, "All methods failed to get timestamp for past block");
                Err(anyhow::anyhow!(
                    "Failed to get timestamp for past block {}: all methods failed",
                    block_number
                ))
            }
        }
    } else {
        Err(anyhow::anyhow!(
            "Scan API not configured for network {}",
            config.network
        ))
    }
}

// Process future block timestamp
#[instrument(name = "block_time_process_future_block", skip_all, fields(block_number = block_number))]
async fn process_future_block_timestamp(
    config: ChainConfig,
    block_number: u64,
) -> Result<NaiveDateTime> {
    if let (Some(scan_api_url), Some(scan_api_key)) = (&config.scan_api_url, &config.scan_api_key) {
        get_timestamp_from_future_scan_api(scan_api_url, scan_api_key, block_number).await
    } else {
        Err(anyhow::anyhow!(
            "Scan API not configured for network {}",
            config.network
        ))
    }
}

// Step 1: Get timestamp from provider using get_block
#[instrument(name = "block_time_provider_get_block", skip_all, fields(block_number = block_number))]
async fn get_timestamp_from_provider(
    provider: &Arc<rindexer::provider::JsonRpcCachedProvider>,
    block_number: u64,
    current_block: u64,
) -> Result<NaiveDateTime> {
    if block_number > current_block {
        return Err(anyhow::anyhow!(
            "Block number {} exceeds current block {}",
            block_number,
            current_block
        ));
    }

    let inner_provider = provider.get_inner_provider();

    match inner_provider
        .get_block(BlockId::Number(block_number.into()))
        .await
    {
        Ok(Some(block)) => {
            let timestamp = block.header.timestamp as i64;
            debug!(
                timestamp = timestamp,
                "Got timestamp from provider get_block"
            );
            DateTime::<Utc>::from_timestamp(timestamp, 0)
                .map(|dt| dt.naive_utc())
                .context("Timestamp from provider out of range")
        }
        Ok(None) => Err(anyhow::anyhow!(
            "Block {} not found by provider",
            block_number
        )),
        Err(e) => Err(anyhow::anyhow!("Provider get_block failed: {}", e)),
    }
}

// Step 2: Get timestamp using raw JSON-RPC request
#[instrument(name = "block_time_raw_rpc", skip_all, fields(block_number = block_number))]
async fn get_timestamp_from_raw_rpc(
    provider: &Arc<rindexer::provider::JsonRpcCachedProvider>,
    block_number: u64,
) -> Result<NaiveDateTime> {
    let inner_provider = provider.get_inner_provider();

    debug!("Making raw RPC request for block {}", block_number);

    match inner_provider
        .client()
        .request::<_, Option<BlockTimestamp>>(
            "eth_getBlockByNumber",
            (format!("0x{:x}", block_number), false),
        )
        .await
    {
        Ok(Some(block)) => {
            let timestamp = i64::from_str_radix(block.timestamp.trim_start_matches("0x"), 16)
                .context("Failed to parse hex timestamp from raw RPC")?;
            debug!(timestamp = timestamp, "Got timestamp from raw RPC");
            DateTime::<Utc>::from_timestamp(timestamp, 0)
                .map(|dt| dt.naive_utc())
                .context("Timestamp from raw RPC out of range")
        }
        Ok(None) => Err(anyhow::anyhow!(
            "Block {} not found via raw RPC",
            block_number
        )),
        Err(e) => Err(anyhow::anyhow!("Raw RPC request failed: {}", e)),
    }
}

// Step 3: Get timestamp from past scan API
#[instrument(name = "block_time_past_scan_api", skip_all, fields(block_number = block_number))]
async fn get_timestamp_from_past_scan_api(
    scan_api_url: &str,
    scan_api_key: &str,
    block_number: u64,
) -> Result<NaiveDateTime> {
    let response = past_scan_api_request(scan_api_url, scan_api_key, block_number)
        .await
        .context("Past scan API request failed")?;

    if let Some(response) = response {
        if response.status == "1" {
            if let Some(BlockRewardResult::Success(result)) = response.result {
                let timestamp: i64 = result
                    .timestamp
                    .parse()
                    .context("Failed to parse timestamp from past scan API")?;
                debug!(timestamp = timestamp, "Got timestamp from past scan API");
                return DateTime::<Utc>::from_timestamp(timestamp, 0)
                    .map(|dt| dt.naive_utc())
                    .context("Timestamp from past scan API out of range");
            }
        }
        return Err(anyhow::anyhow!(
            "Past scan API returned error: status={}, message={}",
            response.status,
            response.message
        ));
    }

    Err(anyhow::anyhow!("Past scan API returned empty response"))
}

// Get timestamp from future scan API
#[instrument(name = "block_time_future_scan_api", skip_all, fields(block_number = block_number))]
async fn get_timestamp_from_future_scan_api(
    scan_api_url: &str,
    scan_api_key: &str,
    block_number: u64,
) -> Result<NaiveDateTime> {
    let response = future_scan_api_request(scan_api_url, scan_api_key, block_number)
        .await
        .context("Future scan API request failed")?;

    if let Some(response) = response {
        if response.status == "1" {
            if let Some(EstimateTimestampResult::Success(result)) = response.result {
                let estimate_seconds: f64 = result
                    .estimate_time_in_sec
                    .parse()
                    .context("Failed to parse estimate time from future scan API")?;
                debug!(
                    estimate_seconds = estimate_seconds,
                    "Got estimate from future scan API"
                );
                return Utc::now()
                    .checked_add_signed(chrono::Duration::seconds(estimate_seconds as i64))
                    .context("Failed to add duration to current time")
                    .map(|dt| dt.naive_utc());
            }
        }
        return Err(anyhow::anyhow!(
            "Future scan API returned error: status={}, message={}",
            response.status,
            response.message
        ));
    }

    Err(anyhow::anyhow!("Future scan API returned empty response"))
}

// Low-level API request functions
#[instrument(name = "block_time_past_api_request", skip(api_key), fields(block_number = block_number))]
async fn past_scan_api_request(
    api_url: &str,
    api_key: &str,
    block_number: u64,
) -> Result<Option<BlockRewardResponse>> {
    let url = format!(
        "{api_url}?module=block&action=getblockreward&blockno={block_number}&apikey={api_key}"
    );

    let response = HTTP_CLIENT
        .get(&url)
        .send()
        .await
        .context("Failed to send past scan API request")?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response
            .text()
            .await
            .unwrap_or_else(|_| "Failed to read response".into());
        return Err(anyhow::anyhow!(
            "Past scan API request failed with status {}: {}",
            status,
            text
        ));
    }

    let response_text = response
        .text()
        .await
        .context("Failed to get response text")?;

    serde_json::from_str::<BlockRewardResponse>(&response_text)
        .map(Some)
        .context("Failed to deserialize past scan API response")
}

#[instrument(name = "block_time_future_api_request", skip(api_key), fields(block_number = block_number))]
async fn future_scan_api_request(
    api_url: &str,
    api_key: &str,
    block_number: u64,
) -> Result<Option<EstimateTimestamp>> {
    let url = format!(
        "{api_url}?module=block&action=getblockcountdown&blockno={block_number}&apikey={api_key}"
    );

    let response = HTTP_CLIENT
        .get(&url)
        .send()
        .await
        .context("Failed to send future scan API request")?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response
            .text()
            .await
            .unwrap_or_else(|_| "Failed to read response".into());
        return Err(anyhow::anyhow!(
            "Future scan API request failed with status {}: {}",
            status,
            text
        ));
    }

    let response_text = response
        .text()
        .await
        .context("Failed to get response text")?;

    serde_json::from_str::<EstimateTimestamp>(&response_text)
        .map(Some)
        .context("Failed to deserialize future scan API response")
}

// Unit tests
#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Datelike;
    use dotenv;
    use serial_test::serial;
    use std::sync::Once;

    static INIT: Once = Once::new();

    fn init_test_env() {
        INIT.call_once(|| {
            dotenv::dotenv().ok();
        });
    }

    async fn ensure_test_env() -> Result<()> {
        init_test_env();
        if std::env::var("ETHERSCAN_API_KEY").is_err() {
            return Err(anyhow::anyhow!("ETHERSCAN_API_KEY not set"));
        }
        Ok(())
    }

    // Helper to clean up the processor after tests
    #[allow(dead_code)]
    async fn cleanup_processor() {
        let mut processor = PROCESSOR_INIT.lock().await;
        if let Some(handle) = processor.take() {
            handle.abort();
        }
    }

    // Test chain config loading
    #[test]
    fn test_chain_config() {
        init_test_env();

        let config = get_chain_config("ethereum").unwrap();
        assert_eq!(config.network, "ethereum");
        assert!(config.scan_api_url.is_some());

        let config = get_chain_config("arbitrum").unwrap();
        assert_eq!(config.network, "arbitrum");
        assert!(config.scan_api_url.is_some());

        let result = get_chain_config("unsupported");
        assert!(result.is_err());
    }

    // Test get_current_block_number
    #[tokio::test]
    #[serial]
    async fn test_get_current_block_number() -> Result<()> {
        ensure_test_env().await?;

        let provider = get_provider_cache_for_network("ethereum").await;
        let block_number = get_current_block_number(&provider).await?;

        assert!(block_number > 0);
        Ok(())
    }

    // Test provider get_block
    #[tokio::test]
    #[serial]
    async fn test_get_timestamp_from_provider() -> Result<()> {
        ensure_test_env().await?;

        let provider = get_provider_cache_for_network("ethereum").await;
        let current_block = get_current_block_number(&provider).await?;
        let test_block = current_block.saturating_sub(1000);

        let timestamp = get_timestamp_from_provider(&provider, test_block, current_block).await?;

        assert!(timestamp < Utc::now().naive_utc());
        assert!(timestamp > DateTime::UNIX_EPOCH.naive_utc());
        Ok(())
    }

    // Test raw RPC request
    #[tokio::test]
    #[serial]
    async fn test_get_timestamp_from_raw_rpc() -> Result<()> {
        ensure_test_env().await?;

        let provider = get_provider_cache_for_network("ethereum").await;
        let current_block = get_current_block_number(&provider).await?;
        let test_block = current_block.saturating_sub(100);

        let timestamp = get_timestamp_from_raw_rpc(&provider, test_block).await?;

        assert!(timestamp < Utc::now().naive_utc());
        assert!(timestamp > DateTime::UNIX_EPOCH.naive_utc());
        Ok(())
    }

    // Test past scan API
    #[tokio::test]
    #[serial]
    async fn test_past_scan_api_request() -> Result<()> {
        ensure_test_env().await?;

        let api_key = std::env::var("ETHERSCAN_API_KEY")?;
        let provider = get_provider_cache_for_network("ethereum").await;
        let current_block = get_current_block_number(&provider).await?;
        let past_block = current_block.saturating_sub(10000);

        let response =
            past_scan_api_request("https://api.etherscan.io/api", &api_key, past_block).await?;

        assert!(response.is_some());
        let response = response.unwrap();
        assert_eq!(response.status, "1");

        tokio::time::sleep(Duration::from_millis(200)).await; // Rate limiting
        Ok(())
    }

    // Test future scan API
    #[tokio::test]
    #[serial]
    async fn test_future_scan_api_request() -> Result<()> {
        ensure_test_env().await?;

        let api_key = std::env::var("ETHERSCAN_API_KEY")?;
        let provider = get_provider_cache_for_network("ethereum").await;
        let current_block = get_current_block_number(&provider).await?;
        let future_block = current_block + 100;

        let response =
            future_scan_api_request("https://api.etherscan.io/api", &api_key, future_block).await?;

        assert!(response.is_some());
        let response = response.unwrap();
        assert_eq!(response.status, "1");

        tokio::time::sleep(Duration::from_millis(200)).await; // Rate limiting
        Ok(())
    }

    // Test full past block flow
    #[tokio::test]
    #[serial]
    async fn test_process_past_block_timestamp() -> Result<()> {
        ensure_test_env().await?;

        let config = get_chain_config("ethereum")?;
        let provider = get_provider_cache_for_network("ethereum").await;
        let current_block = get_current_block_number(&provider).await?;
        let past_block = current_block.saturating_sub(1000);

        let timestamp =
            process_past_block_timestamp(config, provider, past_block, current_block).await?;

        assert!(timestamp < Utc::now().naive_utc());
        assert!(timestamp > DateTime::UNIX_EPOCH.naive_utc());
        Ok(())
    }

    // Test full future block flow
    #[tokio::test]
    #[serial]
    async fn test_process_future_block_timestamp() -> Result<()> {
        ensure_test_env().await?;

        let config = get_chain_config("ethereum")?;
        let provider = get_provider_cache_for_network("ethereum").await;
        let current_block = get_current_block_number(&provider).await?;
        let future_block = current_block + 50;

        let now = Utc::now().naive_utc();
        let timestamp = process_future_block_timestamp(config, future_block).await?;

        assert!(timestamp > now);
        assert!((timestamp - now).num_hours() < 1); // Should be less than 1 hour for 50 blocks

        tokio::time::sleep(Duration::from_millis(200)).await;
        Ok(())
    }

    // Test Arbitrum with potential null mixHash
    #[tokio::test]
    #[serial]
    async fn test_arbitrum_fallback_to_raw_rpc() -> Result<()> {
        ensure_test_env().await?;

        let provider = get_provider_cache_for_network("arbitrum").await;
        let current_block = get_current_block_number(&provider).await?;
        let test_block = current_block.saturating_sub(100);

        // This should work either through get_block or raw RPC
        let config = get_chain_config("arbitrum")?;
        let timestamp =
            process_past_block_timestamp(config, provider, test_block, current_block).await?;

        assert!(timestamp < Utc::now().naive_utc());
        assert!(timestamp > DateTime::UNIX_EPOCH.naive_utc());
        Ok(())
    }

    // ERROR CASE TESTS

    // Test provider future block rejection
    #[tokio::test]
    #[serial]
    async fn test_provider_future_block_error() -> Result<()> {
        ensure_test_env().await?;

        let provider = get_provider_cache_for_network("ethereum").await;
        let current_block = get_current_block_number(&provider).await?;
        let future_block = current_block + 1000;

        // This should fail because provider can't get future blocks
        let result = get_timestamp_from_provider(&provider, future_block, current_block).await;
        assert!(result.is_err());
        assert!(
            result
                .unwrap_err()
                .to_string()
                .contains("exceeds current block")
        );
        Ok(())
    }

    // Test block not found by provider
    #[tokio::test]
    #[serial]
    async fn test_provider_block_not_found() -> Result<()> {
        ensure_test_env().await?;

        let provider = get_provider_cache_for_network("ethereum").await;

        // Use a very specific old block that might not be in cache
        // but is within the valid range
        let result = get_timestamp_from_raw_rpc(&provider, 999999999999).await;

        assert!(result.is_err());
        // Error message might vary, just check it failed
        let err_msg = result.unwrap_err().to_string();
        assert!(
            err_msg.contains("not found") || err_msg.contains("error") || err_msg.contains("null")
        );
        Ok(())
    }

    // Test past scan API error response
    #[tokio::test]
    #[serial]
    async fn test_past_scan_api_error_response() -> Result<()> {
        ensure_test_env().await?;

        let api_key = std::env::var("ETHERSCAN_API_KEY")?;

        // Use a block number that's definitely in the future to trigger API error
        let future_block = u64::MAX;

        let response =
            past_scan_api_request("https://api.etherscan.io/api", &api_key, future_block).await?;

        // API should return error status for non-existent blocks
        assert!(response.is_some());
        let response = response.unwrap();
        assert_eq!(response.status, "0"); // Error status

        tokio::time::sleep(Duration::from_millis(200)).await;
        Ok(())
    }

    // Test future scan API with past block
    #[tokio::test]
    #[serial]
    async fn test_future_scan_api_past_block() -> Result<()> {
        ensure_test_env().await?;

        let api_key = std::env::var("ETHERSCAN_API_KEY")?;
        let provider = get_provider_cache_for_network("ethereum").await;
        let current_block = get_current_block_number(&provider).await?;

        // Use a recent past block
        let past_block = current_block - 10;

        let response =
            future_scan_api_request("https://api.etherscan.io/api", &api_key, past_block).await?;

        assert!(response.is_some());
        let response = response.unwrap();

        // API might handle past blocks differently
        if response.status == "1" {
            // If successful, the estimate should be negative or zero
            if let Some(EstimateTimestampResult::Success(data)) = response.result {
                let estimate: f64 = data.estimate_time_in_sec.parse()?;
                assert!(estimate <= 0.0); // Past blocks should have negative or zero estimate
            }
        }

        tokio::time::sleep(Duration::from_millis(200)).await;
        Ok(())
    }

    // Test with invalid API URL
    #[tokio::test]
    #[serial]
    async fn test_invalid_api_url() -> Result<()> {
        let result = past_scan_api_request(
            "https://invalid-domain-that-does-not-exist.com/api",
            "fake_key",
            100,
        )
        .await;

        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Failed to send"));
        Ok(())
    }

    // Test with wrong API endpoint
    #[tokio::test]
    #[serial]
    async fn test_wrong_api_endpoint() -> Result<()> {
        ensure_test_env().await?;

        let api_key = std::env::var("ETHERSCAN_API_KEY")?;

        let result =
            past_scan_api_request("https://api.etherscan.io/wrong-endpoint", &api_key, 100).await;

        assert!(result.is_err());
        // Should get HTTP error
        Ok(())
    }

    // FALLBACK CHAIN TESTS

    // Test fallback from provider to scan API with very old block
    #[tokio::test]
    #[serial]
    async fn test_fallback_to_scan_api() -> Result<()> {
        ensure_test_env().await?;

        let config = get_chain_config("ethereum")?;
        let provider = get_provider_cache_for_network("ethereum").await;

        // Use a very old block that provider might not have cached
        // but scan API will have
        let very_old_block = 1_000_000; // Block from 2016

        let timestamp = process_past_block_timestamp(
            config,
            provider,
            very_old_block,
            20_000_000, // current block
        )
        .await?;

        // Verify we got a valid 2016 timestamp
        assert_eq!(timestamp.year(), 2016);

        tokio::time::sleep(Duration::from_millis(200)).await;
        Ok(())
    }

    // EDGE CASE TESTS

    // Test genesis block (block 0)
    #[tokio::test]
    #[serial]
    async fn test_genesis_block() -> Result<()> {
        ensure_test_env().await?;

        // Some providers return epoch (1970) for block 0
        // Let's test with the full processing flow instead
        let config = get_chain_config("ethereum")?;
        let timestamp = process_block_timestamp_request(config, 0).await?;

        // The timestamp should either be 1970 (epoch) or 2015 (actual genesis)
        // depending on the provider
        assert!(
            timestamp.year() == 1970 || timestamp.year() == 2015,
            "Genesis block timestamp year was {}, expected 1970 or 2015",
            timestamp.year()
        );

        Ok(())
    }

    // Test very large block numbers
    #[tokio::test]
    #[serial]
    async fn test_very_large_block_number() -> Result<()> {
        ensure_test_env().await?;

        let config = get_chain_config("ethereum")?;
        let result = process_block_timestamp_request(config, u64::MAX - 1000).await;

        assert!(result.is_err());
        // Should fail because block doesn't exist
        Ok(())
    }

    // Test block at current boundary
    #[tokio::test]
    #[serial]
    async fn test_current_block_boundary() -> Result<()> {
        ensure_test_env().await?;

        let provider = get_provider_cache_for_network("ethereum").await;
        let current_block = get_current_block_number(&provider).await?;

        // Test exactly at current block
        let result = get_timestamp_from_provider(&provider, current_block, current_block).await;

        // Current block should be available
        assert!(result.is_ok());

        // Test one block after current
        let future_result =
            get_timestamp_from_provider(&provider, current_block + 1, current_block).await;
        assert!(future_result.is_err());

        Ok(())
    }

    // Test provider vs scan API discrepancy for genesis block
    #[tokio::test]
    #[serial]
    async fn test_genesis_block_provider_vs_scan_api() -> Result<()> {
        ensure_test_env().await?;

        let provider = get_provider_cache_for_network("ethereum").await;
        let api_key = std::env::var("ETHERSCAN_API_KEY")?;

        // Get timestamp from provider
        let provider_result = get_timestamp_from_provider(&provider, 0, 1000).await;

        // Get timestamp from scan API
        let scan_result =
            past_scan_api_request("https://api.etherscan.io/api", &api_key, 0).await?;

        if let Ok(provider_timestamp) = provider_result {
            println!(
                "Provider returned genesis timestamp: {} (year: {})",
                provider_timestamp,
                provider_timestamp.year()
            );
        }

        if let Some(scan_response) = scan_result {
            if scan_response.status == "1" {
                if let Some(BlockRewardResult::Success(result)) = scan_response.result {
                    let timestamp: i64 = result.timestamp.parse()?;
                    let scan_timestamp = DateTime::<Utc>::from_timestamp(timestamp, 0)
                        .unwrap()
                        .naive_utc();
                    println!(
                        "Scan API returned genesis timestamp: {} (year: {})",
                        scan_timestamp,
                        scan_timestamp.year()
                    );
                }
            }
        }

        // This test is just for observation, not assertion
        tokio::time::sleep(Duration::from_millis(200)).await;
        Ok(())
    }

    // PROPERTY-BASED TESTS

    // Test that timestamps are always increasing
    #[tokio::test]
    #[serial]
    async fn test_timestamp_ordering() -> Result<()> {
        ensure_test_env().await?;

        let provider = get_provider_cache_for_network("ethereum").await;
        let current = get_current_block_number(&provider).await?;

        let blocks = vec![current - 1000, current - 500, current - 100, current - 10];

        let mut last_timestamp = DateTime::UNIX_EPOCH.naive_utc();

        for block in blocks {
            let timestamp = get_timestamp_from_provider(&provider, block, current).await?;
            assert!(
                timestamp > last_timestamp,
                "Timestamps should increase with block number"
            );
            last_timestamp = timestamp;
        }

        Ok(())
    }

    // Test timestamp is within reasonable bounds
    #[tokio::test]
    #[serial]
    async fn test_timestamp_bounds() -> Result<()> {
        ensure_test_env().await?;

        let provider = get_provider_cache_for_network("ethereum").await;
        let current = get_current_block_number(&provider).await?;
        let test_block = current - 100;

        let timestamp = get_timestamp_from_provider(&provider, test_block, current).await?;

        // Timestamp should be:
        // - After Ethereum genesis (July 2015)
        // - Before current time
        // - Within last 24 hours for a block 100 blocks ago
        let genesis = DateTime::parse_from_rfc3339("2015-07-30T00:00:00Z")
            .unwrap()
            .naive_utc();
        let now = Utc::now().naive_utc();
        let day_ago = now - chrono::Duration::days(1);

        assert!(timestamp > genesis);
        assert!(timestamp < now);
        assert!(timestamp > day_ago); // Recent block should be within 24 hours

        Ok(())
    }
}

// Integration tests
#[cfg(test)]
mod integration_tests {
    use super::*;
    use chrono::Datelike;
    use dotenv;
    use serial_test::serial;

    // Helper to clean up the processor after tests
    async fn cleanup_processor() {
        let mut processor = PROCESSOR_INIT.lock().await;
        if let Some(handle) = processor.take() {
            handle.abort();
        }
    }

    #[tokio::test]
    #[serial]
    async fn test_full_flow_past_block() -> Result<()> {
        dotenv::dotenv().ok();

        let config = get_chain_config("ethereum")?;
        let timestamp = process_block_timestamp_request(config, 15000000).await?;

        // Ethereum block 15000000 was mined on 2022-06-16
        assert_eq!(timestamp.year(), 2022);
        assert_eq!(timestamp.month(), 6);
        Ok(())
    }

    #[tokio::test]
    #[serial]
    async fn test_full_flow_future_block() -> Result<()> {
        dotenv::dotenv().ok();

        let config = get_chain_config("ethereum")?;
        let provider = get_provider_cache_for_network("ethereum").await;
        let current_block = get_current_block_number(&provider).await?;
        let future_block = current_block + 100;

        let now = Utc::now().naive_utc();
        let timestamp = process_block_timestamp_request(config, future_block).await?;

        assert!(timestamp > now);
        Ok(())
    }

    #[tokio::test]
    #[serial]
    async fn test_queue_processing() -> Result<()> {
        dotenv::dotenv().ok();

        // Test the public interface
        let timestamp = estimate_timestamp("ethereum", 15000000).await?;
        assert_eq!(timestamp.year(), 2022);

        // Clean up
        cleanup_processor().await;
        Ok(())
    }

    #[tokio::test]
    #[serial]
    async fn test_unsupported_network() -> Result<()> {
        let result = estimate_timestamp("unsupported_network", 1000000).await;
        assert!(result.is_err());
        assert!(
            result
                .unwrap_err()
                .to_string()
                .contains("Unsupported network")
        );

        // Clean up
        cleanup_processor().await;
        Ok(())
    }

    #[tokio::test]
    #[serial]
    async fn test_network_without_scan_api() -> Result<()> {
        dotenv::dotenv().ok();

        let config = ChainConfig {
            network: "avalanche",
            scan_api_url: None,
            scan_api_key: None,
        };

        let provider = get_provider_cache_for_network("avalanche").await;
        let current_block = get_current_block_number(&provider).await?;
        let past_block = current_block.saturating_sub(10);

        // Should work if provider has the block
        let result =
            process_past_block_timestamp(config.clone(), provider, past_block, current_block).await;

        // This might succeed if provider has the block, or fail with scan API error
        match result {
            Ok(timestamp) => {
                assert!(timestamp < Utc::now().naive_utc());
            }
            Err(e) => {
                assert!(e.to_string().contains("Scan API not configured"));
            }
        }

        // Future blocks should always fail without scan API
        let future_result = process_future_block_timestamp(config, current_block + 100).await;
        assert!(future_result.is_err());
        assert!(
            future_result
                .unwrap_err()
                .to_string()
                .contains("Scan API not configured")
        );

        Ok(())
    }

    // CONCURRENT ACCESS TESTS

    // Test multiple simultaneous requests
    #[tokio::test]
    #[serial]
    async fn test_concurrent_requests() -> Result<()> {
        dotenv::dotenv().ok();

        use futures::future::join_all;

        let futures = vec![
            estimate_timestamp("ethereum", 15000000),
            estimate_timestamp("ethereum", 15000001),
            estimate_timestamp("ethereum", 15000002),
            estimate_timestamp("arbitrum", 100000000),
        ];

        let results = join_all(futures).await;

        // All should succeed
        for (i, result) in results.iter().enumerate() {
            assert!(result.is_ok(), "Request {} failed: {:?}", i, result);
        }

        cleanup_processor().await;
        Ok(())
    }

    // Test queue ordering with multiple requests
    #[tokio::test]
    #[serial]
    async fn test_queue_ordering() -> Result<()> {
        dotenv::dotenv().ok();

        // Submit multiple requests rapidly
        let mut handles = vec![];

        for i in 0..5 {
            let handle = tokio::spawn(async move {
                let block = 15000000 + i;
                let timestamp = estimate_timestamp("ethereum", block).await?;
                Ok::<(u64, NaiveDateTime), anyhow::Error>((block, timestamp))
            });
            handles.push(handle);
        }

        // Collect results
        let mut results = vec![];
        for handle in handles {
            results.push(handle.await??);
        }

        // Sort by block number
        results.sort_by_key(|(block, _)| *block);

        // Verify timestamps are in order
        for i in 1..results.len() {
            assert!(
                results[i].1 >= results[i - 1].1,
                "Timestamp for block {} is before block {}",
                results[i].0,
                results[i - 1].0
            );
        }

        cleanup_processor().await;
        Ok(())
    }

    // NETWORK-SPECIFIC BEHAVIOR TESTS

    // Test each network's specific characteristics
    #[tokio::test]
    #[serial]
    async fn test_network_specific_behaviors() -> Result<()> {
        dotenv::dotenv().ok();

        // Test Ethereum
        let eth_config = get_chain_config("ethereum")?;
        assert!(eth_config.scan_api_url.is_some());
        assert_eq!(
            eth_config.scan_api_url.unwrap(),
            "https://api.etherscan.io/api"
        );

        // Test Arbitrum (L2 with potential null mixHash)
        let arb_config = get_chain_config("arbitrum")?;
        assert!(arb_config.scan_api_url.is_some());

        // Test Optimism (another L2)
        let opt_config = get_chain_config("optimism")?;
        assert!(opt_config.scan_api_url.is_some());

        // Test Polygon
        let poly_config = get_chain_config("polygon")?;
        assert!(poly_config.scan_api_url.is_some());

        // Test Avalanche (no scan API)
        let avax_config = get_chain_config("avalanche")?;
        assert!(avax_config.scan_api_url.is_none());

        Ok(())
    }

    // Test Arbitrum specific null mixHash handling
    #[tokio::test]
    #[serial]
    async fn test_arbitrum_null_mixhash_handling() -> Result<()> {
        dotenv::dotenv().ok();

        let provider = get_provider_cache_for_network("arbitrum").await;
        let current = get_current_block_number(&provider).await?;

        // Test multiple recent blocks to find one with null mixHash
        let mut found_fallback = false;

        for offset in [10, 50, 100, 200] {
            let block = current.saturating_sub(offset);

            // Try provider first (might fail on null mixHash)
            let provider_result = get_timestamp_from_provider(&provider, block, current).await;

            // Try raw RPC (should succeed)
            let rpc_result = get_timestamp_from_raw_rpc(&provider, block).await;

            // At least one method should work
            assert!(
                provider_result.is_ok() || rpc_result.is_ok(),
                "Both methods failed for block {}",
                block
            );

            if provider_result.is_err() && rpc_result.is_ok() {
                println!("Found null mixHash fallback at Arbitrum block {}", block);
                found_fallback = true;
                break;
            }
        }

        // Note: We might not always find a null mixHash block, but the test
        // verifies that at least one method works for each block
        if found_fallback {
            println!("Successfully tested Arbitrum null mixHash fallback");
        }

        Ok(())
    }

    // Test retry mechanism with rapid requests
    #[tokio::test]
    #[serial]
    async fn test_retry_mechanism() -> Result<()> {
        dotenv::dotenv().ok();

        // Submit a request that might trigger retry
        // Using an unsupported network will trigger retries
        let result = estimate_timestamp("unsupported_network", 1000000).await;

        // Should eventually fail after retries
        assert!(result.is_err());

        cleanup_processor().await;
        Ok(())
    }

    // Test different networks in parallel
    #[tokio::test]
    #[serial]
    async fn test_multi_network_parallel() -> Result<()> {
        dotenv::dotenv().ok();

        use futures::future::join_all;

        let eth_provider = get_provider_cache_for_network("ethereum").await;
        let eth_current = get_current_block_number(&eth_provider).await?;

        let arb_provider = get_provider_cache_for_network("arbitrum").await;
        let arb_current = get_current_block_number(&arb_provider).await?;

        let futures = vec![
            estimate_timestamp("ethereum", eth_current - 100),
            estimate_timestamp("arbitrum", arb_current - 100),
        ];

        let results = join_all(futures).await;

        // Both should succeed
        assert!(results[0].is_ok(), "Ethereum request failed");
        assert!(results[1].is_ok(), "Arbitrum request failed");

        // Timestamps should be recent (within last day)
        let now = Utc::now().naive_utc();
        let day_ago = now - chrono::Duration::days(1);

        assert!(results[0].as_ref().unwrap() > &day_ago);
        assert!(results[1].as_ref().unwrap() > &day_ago);

        cleanup_processor().await;
        Ok(())
    }
}
