use crate::rindexer_lib::typings::networks::{get_arbitrum_provider_cache, get_avalanche_provider_cache, get_ethereum_provider_cache, get_optimism_provider_cache, get_polygon_provider_cache};
use anyhow::{Context, Result};
use chrono::{DateTime, NaiveDateTime, Utc};
use ethers::{providers::Middleware, types::BlockId};
use lazy_static::lazy_static;
use reqwest::Client;
use rindexer::provider::JsonRpcCachedProvider;
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, VecDeque},
    sync::Arc,
    time::Duration,
};
use tokio::sync::{Mutex, OnceCell};
use tracing::{debug, error, instrument, warn};

#[derive(Clone)]
struct ChainConfig {
    provider: Arc<JsonRpcCachedProvider>,
    scan_api_url: Option<String>,
    scan_api_key: Option<String>,
}

lazy_static! {
    static ref CHAIN_CONFIG_MAP: HashMap<&'static str, ChainConfig> = {
        let mut map = HashMap::new();
        map.insert(
            "ethereum",
            ChainConfig {
                provider: get_ethereum_provider_cache(),
                scan_api_url: Some("https://api.etherscan.io/api".to_string()),
                scan_api_key: std::env::var("ETHERSCAN_API_KEY").ok(),
            },
        );
        map.insert(
            "arbitrum",
            ChainConfig {
                provider: get_arbitrum_provider_cache(),
                scan_api_url: Some("https://api.arbiscan.io/api".to_string()),
                scan_api_key: std::env::var("ARBISCAN_API_KEY").ok(),
            },
        );
        map.insert(
            "optimism",
            ChainConfig {
                provider: get_optimism_provider_cache(),
                scan_api_url: Some("https://api-optimistic.etherscan.io/api".to_string()),
                scan_api_key: std::env::var("OPTIMISTIC_SCAN_API_KEY").ok(),
            },
        );
        map.insert(
            "polygon",
            ChainConfig {
                provider: get_polygon_provider_cache(),
                scan_api_url: Some("https://api.polygonscan.com/api".to_string()),
                scan_api_key: std::env::var("POLYGONSCAN_API_KEY").ok(),
            },
        );
        map.insert(
            "avalanche",
            ChainConfig {
                provider: get_avalanche_provider_cache(),
                scan_api_url: None,
                scan_api_key: None,
            },
        );
        map
    };
    static ref HTTP_CLIENT: Client = match Client::builder()
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(5))
        .build()
    {
        Ok(client) => client,
        Err(e) => {
            panic!("Failed to create HTTP client: {}", e);
        }
    };
    static ref JOBS_QUEUE: Arc<Mutex<VecDeque<TimestampJob>>> = Arc::new(Mutex::new(VecDeque::with_capacity(100)));
    static ref PROCESSOR_INIT: OnceCell<tokio::task::JoinHandle<()>> = OnceCell::const_new();
}

struct TimestampJob {
    network: &'static str,
    block_number: u64,
    sender: tokio::sync::oneshot::Sender<Result<NaiveDateTime>>,
    retry_count: u64,
}

#[instrument(name = "block_time_job_processor", skip_all)]
async fn job_processor() {
    loop {
        let mut job_queue = JOBS_QUEUE.lock().await;
        if let Some(mut job) = job_queue.pop_front() {
            drop(job_queue); // Release lock to allow other tasks to enqueue jobs

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

            match process_request_inner(config, job.block_number).await {
                Ok(result) => {
                    if job.sender.send(Ok(result)).is_err() {
                        error!(
                            block_number = job.block_number,
                            "Failed to send timestamp estimation result back to sender"
                        );
                    }
                }
                Err(e) => {
                    warn!(
                        block_number = job.block_number,
                        error = %e,
                        retry_count = job.retry_count,
                        "Pushing back to queue. Failed to process timestamp estimation"
                    );
                    // Re-enqueue the job for retry with backoff
                    job.retry_count += 1;
                    let backoff_duration = Duration::from_secs(job.retry_count.min(5)); // Linear backoff, max 5 seconds
                    tokio::time::sleep(backoff_duration).await; // Introduce backoff sleep
                    let mut job_queue = JOBS_QUEUE.lock().await;
                    job_queue.push_back(job);
                }
            }
        } else {
            // Queue is empty, sleep for a short duration before checking again
            tokio::time::sleep(Duration::from_millis(100)).await;
            debug!("Job queue is empty, checking again.");
        }
    }
}

#[instrument(name = "block_time_process_request_inner", skip_all, fields(block_number = block_number))]
async fn process_request_inner(config: ChainConfig, block_number: u64) -> Result<NaiveDateTime> {
    let provider_result = async {
        let provider = config.provider.clone();
        let inner_provider = provider.get_inner_provider();

        let current_block = provider
            .get_block_number()
            .await
            .context("Failed to get current block number from provider")?;
        debug!(
            current_block = current_block.as_u64(),
            "Current block number from provider"
        );

        if block_number <= current_block.as_u64() {
            let block = inner_provider
                .get_block(BlockId::Number(block_number.into()))
                .await
                .context(format!(
                    "Failed to get block {} from provider",
                    block_number
                ))?;

            if let Some(block) = block {
                let timestamp = block.timestamp.as_u64() as i64;
                debug!(block_timestamp = timestamp, block_hash = ?block.hash, "Block found from provider");
                return DateTime::<Utc>::from_timestamp(timestamp, 0)
                    .map(|dt| dt.naive_utc())
                    .context("Timestamp from provider out of range");
            }
        }
        error!("Block not found by provider or block number exceeds current block");
        Err(anyhow::anyhow!(
            "Block not found by provider or block number exceeds current block"
        ))
    }
    .await;

    if let Ok(timestamp) = provider_result {
        debug!("Timestamp obtained from provider");
        return Ok(timestamp);
    } else {
        warn!(error = ?provider_result.as_ref().err(), "Failed to get timestamp from provider, trying scan API");
    }

    let past_scan_api_result = async {
        if let (Some(scan_api_url), Some(scan_api_key)) = (config.scan_api_url.clone(), config.scan_api_key.clone()) {
            let response = past_scan_api_request(&scan_api_url, &scan_api_key, block_number)
                .await
                .context("Past scan API request failed")?;
            if let Some(response) = response {
                if response.status == "1" {
                    if let Some(BlockRewardResult::Success(result)) = response.result {
                        let timestamp: i64 = result
                            .timestamp
                            .parse()
                            .context("Failed to parse timestamp from past scan API response")?;
                        debug!(scan_api = %scan_api_url, block_number = block_number, timestamp = timestamp, "Timestamp obtained from past scan API");
                        return DateTime::<Utc>::from_timestamp(timestamp, 0)
                            .map(|dt| dt.naive_utc())
                            .context("Timestamp from past scan api out of range");
                    } else if let Some(BlockRewardResult::Error(err_msg)) = response.result {
                        error!(scan_api = %scan_api_url, block_number = block_number, error_message = err_msg, "Past scan API returned an error");
                        return Err(anyhow::anyhow!("Past scan API error: {}", err_msg));
                    } else {
                        error!(scan_api = %scan_api_url, block_number = block_number, response_status = response.status, "Past scan API response result is None but status is success");
                        return Err(anyhow::anyhow!(
                            "Past scan API response result is None but status is success"
                        ));
                    }
                } else {
                    error!(scan_api = %scan_api_url, block_number = block_number, response_status = response.status, response_message = response.message, "Past scan API request failed with status");
                    return Err(anyhow::anyhow!(
                        "Past scan API request failed with status: {}, message: {}",
                        response.status,
                        response.message
                    ));
                }
            } else {
                error!(scan_api = %scan_api_url, block_number = block_number, "Past scan API request returned None");
                return Err(anyhow::anyhow!("Past scan API request returned None"));
            }
        }
        warn!("Past scan API not configured for this chain");
        Err(anyhow::anyhow!(
            "Past scan API not configured for this chain"
        ))
    }
    .await;

    if let Ok(timestamp) = past_scan_api_result {
        debug!("Timestamp obtained from past scan API");
        return Ok(timestamp);
    } else {
        warn!(error = ?past_scan_api_result.as_ref().err(), "Failed to get timestamp from past scan API, trying future scan API");
    }

    let future_scan_api_result = async {
        if let (Some(scan_api_url), Some(scan_api_key)) = (config.scan_api_url.clone(), config.scan_api_key.clone()) {
            let response = future_scan_api_request(&scan_api_url, &scan_api_key, block_number)
                .await
                .context("Future scan API request failed")?;
            if let Some(response) = response {
                if response.status == "1" {
                    if let Some(EstimateTimestampResult::Success(result)) = response.result {
                        let estimate_time_in_sec: f64 = result
                            .estimate_time_in_sec
                            .parse()
                            .context("Failed to parse estimate_time_in_sec from future scan API response")?;
                        debug!(scan_api = %scan_api_url, block_number = block_number, estimate_seconds = estimate_time_in_sec, "Timestamp estimated from future scan API");
                        return Utc::now()
                            .checked_add_signed(chrono::Duration::seconds(estimate_time_in_sec as i64))
                            .context("Failed to add duration to current time from future scan api")
                            .map(|dt| dt.naive_utc());
                    } else if let Some(EstimateTimestampResult::Error(err_msg)) = response.result {
                        error!(scan_api = %scan_api_url, block_number = block_number, error_message = err_msg, "Future scan API returned an error");
                        return Err(anyhow::anyhow!("Future scan API error: {}", err_msg));
                    } else {
                        error!(scan_api = %scan_api_url, block_number = block_number, response_status = response.status, "Future scan API response result is None but status is success");
                        return Err(anyhow::anyhow!(
                            "Future scan API response result is None but status is success"
                        ));
                    }
                } else {
                    error!(scan_api = %scan_api_url, block_number = block_number, response_status = response.status, response_message = response.message, "Future scan API request failed with status");
                    return Err(anyhow::anyhow!(
                        "Future scan API request failed with status: {}, message: {}",
                        response.status,
                        response.message
                    ));
                }
            } else {
                error!(scan_api = %scan_api_url, block_number = block_number, "Future scan API request returned None");
                return Err(anyhow::anyhow!("Future scan API request returned None"));
            }
        }
        warn!("Future scan API not configured for this chain");
        Err(anyhow::anyhow!(
            "Future scan API not configured for this chain"
        ))
    }
    .await;

    if let Ok(timestamp) = future_scan_api_result {
        debug!("Timestamp obtained from future scan API");
        return Ok(timestamp);
    } else {
        warn!(error = ?future_scan_api_result.as_ref().err(), "Failed to get timestamp from future scan API");
    }

    error!(
        provider_error = ?provider_result.as_ref().err(),
        past_scan_api_error = ?past_scan_api_result.as_ref().err(),
        future_scan_api_error = ?future_scan_api_result.as_ref().err(),
        block_number = block_number,
        "All methods failed to estimate timestamp."
    );
    Err(anyhow::anyhow!(
        "All methods failed to estimate timestamp. \nProvider error: {:?}\nPast scan API error: {:?}\nFuture scan API error: {:?}",
        provider_result.err(),
        past_scan_api_result.err(),
        future_scan_api_result.err()
    ))
}

#[instrument(name = "block_time_get_chain_config", skip_all, fields(network = network))]
fn get_chain_config(network: &'static str) -> Result<ChainConfig> {
    CHAIN_CONFIG_MAP
        .get(network)
        .cloned()
        .context(format!("Unsupported network: {}", network))
}

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

    // Ensure job processor is running as a singleton using OnceCell
    PROCESSOR_INIT
        .get_or_init(|| async { tokio::spawn(async { job_processor().await }) })
        .await;

    receiver
        .await
        .context("Failed to receive timestamp estimation result")?
}

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

#[instrument(name = "block_time_future_scan_api_request", skip(api_url, api_key), fields(api_url = api_url, block_number = block_number))]
async fn future_scan_api_request(api_url: &str, api_key: &str, block_number: u64) -> Result<Option<EstimateTimestamp>> {
    let url = format!(
        "{}?module=block&action=getblockcountdown&blockno={}&apikey={}",
        api_url, block_number, api_key
    );
    debug!(request_url = %url, "Sending future scan API request");

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
        error!(status_code = status.as_u16(), response_body = %text, "Future scan API request failed");
        return Err(anyhow::anyhow!(
            "API request failed with status {}: {}",
            status,
            text
        ));
    }
    let status = response.status();
    let response_text = response
        .text()
        .await
        .context("Failed to get response text from future scan API request")?;
    debug!(
        response_status = status.as_u16(),
        response_body_len = response_text.len(),
        "Future scan API request successful"
    );

    serde_json::from_str::<EstimateTimestamp>(&response_text)
        .map(Some)
        .map_err(|e| anyhow::anyhow!(e).context("Failed to deserialize future scan API response"))
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

#[instrument(name = "block_time_past_scan_api_request", skip(api_url, api_key), fields(api_url = api_url, block_number = block_number))]
async fn past_scan_api_request(api_url: &str, api_key: &str, block_number: u64) -> Result<Option<BlockRewardResponse>> {
    let url = format!(
        "{}?module=block&action=getblockreward&blockno={}&apikey={}",
        api_url, block_number, api_key
    );
    debug!(request_url = %url, "Sending past scan API request");

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
        error!(status_code = status.as_u16(), response_body = %text, "Past scan API request failed");
        return Err(anyhow::anyhow!(
            "Block reward API request failed with status {}: {}",
            status,
            text
        ));
    }

    let status = response.status();
    let response_text = response
        .text()
        .await
        .context("Failed to get response text from past scan API request")?;

    debug!(
        response_status = status.as_u16(),
        response_body_len = response_text.len(),
        "Past scan API request successful"
    );
    serde_json::from_str::<BlockRewardResponse>(&response_text)
        .map(Some)
        .map_err(|e| anyhow::anyhow!(e).context("Failed to deserialize past scan API response"))
}

// Unit tests
#[cfg(test)]
mod request_tests {
    use super::*;
    use chrono::{Duration, NaiveDate, NaiveTime};
    use rand::prelude::*;
    use serial_test::serial;
    use std::time::Instant;
    use tokio::task::JoinSet;

    #[tokio::test]
    #[serial]
    async fn test_estimate_timestamp_scenario_tracing() -> Result<()> {
        test_estimate_timestamp_scenario("ethereum", 100).await
    }

    async fn test_estimate_timestamp_scenario(
        network: &'static str,
        block_offset: i64, // Positive for future, negative for past
    ) -> Result<()> {
        let current_block = match network {
            "ethereum" => get_ethereum_provider_cache().get_block_number().await,
            "arbitrum" => get_arbitrum_provider_cache().get_block_number().await,
            "optimism" => get_optimism_provider_cache().get_block_number().await,
            "polygon" => get_polygon_provider_cache().get_block_number().await,
            "avalanche" => get_avalanche_provider_cache().get_block_number().await,
            _ => panic!("Unsupported network for testing"),
        }
        .context(format!(
            "Failed to get current block number for network: {}",
            network
        ))?
        .as_u64();

        let target_block_number = if block_offset >= 0 {
            current_block.checked_add(block_offset as u64)
        } else {
            current_block.checked_sub(block_offset.unsigned_abs())
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
    #[serial]
    async fn test_estimate_timestamp_ethereum_future() -> Result<()> {
        test_estimate_timestamp_scenario("ethereum", 100).await
    }

    #[tokio::test]
    #[serial]
    async fn test_estimate_timestamp_ethereum_past() -> Result<()> {
        test_estimate_timestamp_scenario("ethereum", -1000).await
    }

    #[tokio::test]
    #[serial]
    async fn test_estimate_timestamp_arbitrum_future() -> Result<()> {
        test_estimate_timestamp_scenario("arbitrum", 100).await
    }

    #[tokio::test]
    #[serial]
    async fn test_estimate_timestamp_arbitrum_past() -> Result<()> {
        test_estimate_timestamp_scenario("arbitrum", -1000).await
    }

    #[tokio::test]
    #[serial]
    async fn test_estimate_timestamp_optimism_future() -> Result<()> {
        test_estimate_timestamp_scenario("optimism", 100).await
    }

    #[tokio::test]
    #[serial]
    async fn test_estimate_timestamp_optimism_past() -> Result<()> {
        test_estimate_timestamp_scenario("optimism", -1000).await
    }

    #[tokio::test]
    #[serial]
    async fn test_estimate_timestamp_polygon_future() -> Result<()> {
        test_estimate_timestamp_scenario("polygon", 100).await
    }

    #[tokio::test]
    #[serial]
    async fn test_estimate_timestamp_polygon_past() -> Result<()> {
        test_estimate_timestamp_scenario("polygon", -1000).await
    }

    #[tokio::test]
    #[serial]
    async fn test_estimate_timestamp_unsupported_network() -> Result<()> {
        let result = estimate_timestamp("unsupported_network", 1000000).await;
        assert!(result.is_err(), "Expected error for unsupported network");
        if let Err(e) = result {
            assert_eq!(e.to_string(), "Unsupported network: unsupported_network");
        }
        Ok(())
    }

    #[tokio::test]
    #[serial]
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
            "Arbitrum past block estimation off.  Expected: {}, Estimated: {}, Difference: {}",
            expected_time,
            estimated_time,
            (estimated_time - expected_time).num_seconds()
        );
        Ok(())
    }

    #[tokio::test]
    #[serial]
    #[ignore = "too long"]
    async fn test_concurrency() -> Result<()> {
        let mut tasks = JoinSet::new();
        let networks = ["ethereum", "arbitrum", "optimism", "polygon"];
        let offsets = [-100, 100, -1000, 1000, 0]; // Test past, future, and current blocks

        for &network in &networks {
            for &offset in &offsets {
                tasks.spawn(async move { test_estimate_timestamp_scenario(network, offset).await });
            }
        }

        while let Some(res) = tasks.join_next().await {
            res??; // Propagate any errors from the tasks, and explicitly unwrap Result in JoinError
        }
        Ok(())
    }

    #[tokio::test]
    #[serial]
    #[ignore = "too long"]
    async fn test_intensive_concurrency_all_networks_sequential() -> Result<()> {
        let networks = ["ethereum", "arbitrum", "optimism", "polygon"]; // Include all networks for more comprehensive test
        let num_tasks_per_network = 100;
        let mut rng = rand::thread_rng();

        for network in networks {
            println!("Starting intensive test for network: {}", network);
            let current_block = match network {
                "ethereum" => get_ethereum_provider_cache().get_block_number().await,
                "arbitrum" => get_arbitrum_provider_cache().get_block_number().await,
                "optimism" => get_optimism_provider_cache().get_block_number().await,
                "polygon" => get_polygon_provider_cache().get_block_number().await,
                "avalanche" => get_avalanche_provider_cache().get_block_number().await,
                _ => panic!("Unsupported network for testing"),
            }
            .context(format!(
                "Failed to get current block number for network: {}",
                network
            ))?
            .as_u64();

            let mut tasks = JoinSet::new();
            let network_start_time = Instant::now();

            for i in 0..num_tasks_per_network {
                let offset: i64 = rng.gen_range(-100_000..=100_000);

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

#[cfg(test)]
mod api_tests {
    use super::*;
    use dotenv;
    use serial_test::serial;
    use std::env;
    use tokio::time::sleep;

    async fn ensure_api_keys() -> Result<(String, String)> {
        dotenv::dotenv().ok();
        let etherscan_key = env::var("ETHERSCAN_API_KEY").context("ETHERSCAN_API_KEY must be set for tests")?;
        let arbiscan_key = env::var("ARBISCAN_API_KEY").context("ARBISCAN_API_KEY must be set for tests")?;
        Ok((etherscan_key, arbiscan_key))
    }

    #[tokio::test]
    #[serial]
    async fn test_block_reward_request_success_ethereum() -> Result<()> {
        let (etherscan_key, _) = ensure_api_keys().await?;

        let block_number = 10000000;
        let api_url = "https://api.etherscan.io/api";

        let response = past_scan_api_request(api_url, &etherscan_key, block_number).await?;

        assert!(response.is_some());
        let response = response.context("Expected some response")?;
        assert_eq!(response.status, "1");
        assert!(response.result.is_some());

        sleep(Duration::from_secs(1)).await;
        Ok(())
    }

    #[tokio::test]
    #[serial]
    async fn test_block_reward_request_success_arbitrum() -> Result<()> {
        let (_, arbiscan_key) = ensure_api_keys().await?;

        let block_number = 10000000;
        let api_url = "https://api.arbiscan.io/api";

        let response = past_scan_api_request(api_url, &arbiscan_key, block_number).await?;

        assert!(response.is_some());
        let response = response.context("Expected some response")?;
        assert_eq!(response.status, "1");
        assert!(response.result.is_some());

        sleep(Duration::from_secs(1)).await;
        Ok(())
    }

    #[tokio::test]
    #[serial]
    async fn test_block_reward_request_invalid_block() -> Result<()> {
        let (etherscan_key, _) = ensure_api_keys().await?;

        // Use a future block that doesn't exist yet
        let block_number = u64::MAX;
        let api_url = "https://api.etherscan.io/api";

        let response = past_scan_api_request(api_url, &etherscan_key, block_number).await?;

        assert!(response.is_some());
        let response = response.context("Expected some response")?;

        assert_eq!(response.status, "0");
        assert_eq!(response.message, "NOTOK");

        if let Some(BlockRewardResult::Error(error_msg)) = response.result {
            assert!(!error_msg.is_empty());
        }

        sleep(Duration::from_secs(1)).await;
        Ok(())
    }

    #[tokio::test]
    #[serial]
    async fn test_block_reward_request_invalid_api_key() -> Result<()> {
        let block_number = 15000000;
        let api_url = "https://api.etherscan.io/api";
        let invalid_key = "INVALID_KEY";

        let response = past_scan_api_request(api_url, invalid_key, block_number).await?;

        assert!(response.is_some());
        let response = response.context("Expected some response")?;

        assert_eq!(
            response.status, "0",
            "Expected error status for invalid API key"
        );

        assert!(
            response.message.contains("Invalid") || response.message.contains("Error") || response.message.contains("API key") || response.message.contains("NOTOK"),
            "Expected error message for invalid API key, got: {}",
            response.message
        );

        sleep(Duration::from_secs(1)).await;
        Ok(())
    }

    #[tokio::test]
    #[serial]
    async fn test_api_request_success_ethereum() -> Result<()> {
        let (etherscan_key, _) = ensure_api_keys().await?;

        let current_block = get_ethereum_provider_cache().get_block_number().await?;
        let future_block = current_block.as_u64() + 1000;
        let api_url = "https://api.etherscan.io/api";

        let response = future_scan_api_request(api_url, &etherscan_key, future_block).await?;

        assert!(response.is_some());
        let response = response.context("Expected some response")?;
        assert_eq!(response.status, "1");
        assert!(response.result.is_some());

        let result = response.result.context("Expected result in response")?;
        assert!(matches!(result, EstimateTimestampResult::Success(_)));
        if let EstimateTimestampResult::Success(success_result) = result {
            assert!(success_result.estimate_time_in_sec.parse::<f64>().is_ok());
        }

        sleep(Duration::from_secs(1)).await;
        Ok(())
    }

    #[tokio::test]
    #[serial]
    async fn test_api_request_success_arbitrum() -> Result<()> {
        let (_, arbiscan_key) = ensure_api_keys().await?;

        let current_block = get_arbitrum_provider_cache().get_block_number().await?;
        let future_block = current_block.as_u64() + 1000;
        let api_url = "https://api.arbiscan.io/api";

        let response = future_scan_api_request(api_url, &arbiscan_key, future_block).await?;

        assert!(response.is_some());
        let response = response.context("Expected some response")?;
        assert_eq!(response.status, "1");
        assert!(response.result.is_some());

        sleep(Duration::from_secs(1)).await;
        Ok(())
    }

    #[tokio::test]
    #[serial]
    async fn test_api_request_past_block() -> Result<()> {
        let (etherscan_key, _) = ensure_api_keys().await?;

        // Use a past block
        let block_number = 15000000;
        let api_url = "https://api.etherscan.io/api";

        let response = past_scan_api_request(api_url, &etherscan_key, block_number).await?;

        assert!(response.is_some());
        let response = response.context("Expected some response")?;
        assert_eq!(response.status, "1");
        assert!(response.result.is_some());

        sleep(Duration::from_secs(1)).await;
        Ok(())
    }

    #[tokio::test]
    #[serial]
    async fn test_invalid_api_url() -> Result<()> {
        let (etherscan_key, _) = ensure_api_keys().await?;

        let block_number = 15000000;
        let invalid_api_url = "https://invalid.api.url/api";

        let result = future_scan_api_request(invalid_api_url, &etherscan_key, block_number).await;

        assert!(result.is_err());

        sleep(Duration::from_secs(1)).await;
        Ok(())
    }

    #[tokio::test]
    #[serial]
    async fn test_rate_limiting() -> Result<()> {
        let (etherscan_key, _) = ensure_api_keys().await?;
        let api_url = "https://api.etherscan.io/api";
        let block_number = 15000000;

        // Make multiple requests in quick succession
        let mut handles = vec![];
        for _ in 0..5 {
            let api_url = api_url.to_string();
            let api_key = etherscan_key.clone();
            handles.push(tokio::spawn(async move {
                past_scan_api_request(&api_url, &api_key, block_number).await
            }));
        }

        // Wait for all requests to complete
        for handle in handles {
            let result = handle.await?;
            assert!(result.is_ok());
        }

        sleep(Duration::from_secs(1)).await;
        Ok(())
    }
}
