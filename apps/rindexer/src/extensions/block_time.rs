use crate::rindexer_lib::typings::networks::{get_arbitrum_provider_cache, get_avalanche_provider_cache, get_ethereum_provider_cache, get_optimism_provider_cache, get_polygon_provider_cache};
use anyhow::{Context, Result};
use chrono::{DateTime, NaiveDateTime, Utc};
use ethers::{providers::Middleware, types::BlockId};
use lazy_static::lazy_static;
use reqwest_middleware::ClientBuilder;
use reqwest_retry::{policies::ExponentialBackoff, RetryTransientMiddleware};
use rindexer::provider::JsonRpcCachedProvider;
use serde::Deserialize;
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tokio::time::sleep;
use tracing::{event, Level};

#[derive(Clone)]
struct ChainConfig {
    provider: Arc<JsonRpcCachedProvider>,
    scan_api_url: Option<String>,
    scan_api_key: Option<String>,
}

lazy_static! {
    static ref CHAIN_CONFIG_MAP: HashMap<&'static str, ChainConfig> = vec![
        (
            "ethereum",
            ChainConfig {
                provider: get_ethereum_provider_cache(),
                scan_api_url: Some("https://api.etherscan.io/api".to_string()),
                scan_api_key: std::env::var("ETHERSCAN_API_KEY").ok(),
            }
        ),
        (
            "arbitrum",
            ChainConfig {
                provider: get_arbitrum_provider_cache(),
                scan_api_url: Some("https://api.arbiscan.io/api".to_string()),
                scan_api_key: std::env::var("ARBISCAN_API_KEY").ok(),
            }
        ),
        (
            "optimism",
            ChainConfig {
                provider: get_optimism_provider_cache(),
                scan_api_url: Some("https://api-optimistic.etherscan.io/api".to_string()),
                scan_api_key: std::env::var("OPTIMISTIC_SCAN_API_KEY").ok(),
            }
        ),
        (
            "polygon",
            ChainConfig {
                provider: get_polygon_provider_cache(),
                scan_api_url: None,
                scan_api_key: None,
            }
        ),
        (
            "avalanche",
            ChainConfig {
                provider: get_avalanche_provider_cache(),
                scan_api_url: None,
                scan_api_key: None,
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

#[derive(Deserialize, PartialEq, Debug)]
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

#[derive(Deserialize, PartialEq, Debug)]
struct EstimateTimestamp {
    status: String,
    message: String,
    result: Option<EstimateTimestampResult>, // result can be None if status is not "1"
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
        let current_block = provider.get_block_number().await?.as_u64();

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

    if block_number < current_block {
        let block = provider
            .get_block(BlockId::Number(block_number.into()))
            .await?
            .ok_or_else(|| anyhow::anyhow!("Block not found"))?;

        return Ok(
            DateTime::<Utc>::from_timestamp(block.timestamp.as_u64() as i64, 0)
                .expect("Failed to create DateTime")
                .naive_utc(),
        );
    }

    // Attempt to get estimated timestamp from block explorer API.
    match retry_request(
        config
            .scan_api_url
            .as_ref()
            .context("Scan API URL is missing")?,
        &config.scan_api_key.context("Scan API key is missing")?,
        block_number,
    )
    .await
    {
        Ok(Some(response)) => {
            if response.status != "1" {
                event!(
                    Level::WARN,
                    network = network,
                    block_number = block_number,
                    message = response.message,
                    "Scanner API returned status != 1"
                );
                return Ok(NaiveDateTime::UNIX_EPOCH); // Return epoch if API status is not success
            }

            let result = response.result.context("API result is missing")?; // Check if result exists
            let estimated_time_in_sec_str = &result.estimate_time_in_sec;
            event!(Level::DEBUG, network = network, block_number = block_number, estimate_time_in_sec = %estimated_time_in_sec_str, "Parsing estimate_time_in_sec");

            let estimated_time_in_sec_f64: f64 = estimated_time_in_sec_str.parse().context(format!(
                "Failed to parse estimate_time_in_sec to f64: '{}'",
                estimated_time_in_sec_str
            ))?;
            let estimated_time_in_sec = estimated_time_in_sec_f64 as i64; // Truncate to integer

            let estimated_naive_datetime = Utc::now()
                .checked_add_signed(chrono::Duration::seconds(estimated_time_in_sec))
                .context("Failed to add duration to current time")?
                .naive_utc();
            Ok(estimated_naive_datetime)
        }
        Ok(None) => {
            event!(
                Level::WARN,
                network = network,
                block_number = block_number,
                "Failed to estimate timestamp from API after retries, returning epoch 0"
            );
            // Return epoch 0 timestamp if API request fails after retries.
            Ok(NaiveDateTime::UNIX_EPOCH)
        }
        Err(e) => {
            event!(Level::ERROR, network = network, block_number = block_number, error = %e, "Error estimating timestamp, returning epoch 0");
            // Return epoch 0 timestamp if there's an error during the API request.
            Ok(NaiveDateTime::UNIX_EPOCH)
        }
    }
}

async fn retry_request(api_url: &str, api_key: &str, param: u64) -> Result<Option<EstimateTimestamp>> {
    let client = ClientBuilder::new(reqwest::Client::new())
        .with(RetryTransientMiddleware::new_with_policy(
            ExponentialBackoff::builder().build_with_max_retries(5),
        ))
        .build();

    for attempt in 1..=5 {
        let response = client
            .get(format!(
                "{}?module=block&action=getblockcountdown&blockno={}&apikey={}",
                api_url, param, api_key
            ))
            .timeout(Duration::from_secs(5))
            .send()
            .await;

        match response {
            Ok(res) => {
                let status = res.status();

                // Check if status code indicates an error
                if !status.is_success() {
                    event!(
                        Level::WARN,
                        status = %status,
                        "Received error status code from API, retrying..."
                    );
                    if attempt < 5 {
                        sleep(Duration::from_millis(2u64.pow(attempt) * 1000)).await;
                        continue;
                    }
                    return Ok(None);
                }

                // Check content type
                let content_type = res
                    .headers()
                    .get(reqwest::header::CONTENT_TYPE)
                    .and_then(|h| h.to_str().ok())
                    .unwrap_or("");

                if !content_type.contains("application/json") {
                    event!(
                        Level::WARN,
                        content_type = %content_type,
                        "Unexpected content type from API, expected application/json, retrying..."
                    );
                    if attempt < 5 {
                        sleep(Duration::from_millis(2u64.pow(attempt) * 1000)).await;
                        continue;
                    }
                    return Ok(None);
                }

                // Try to parse the JSON response
                match res.json::<EstimateTimestamp>().await {
                    Ok(parsed_response) => {
                        if parsed_response.status != "1" {
                            event!(
                                Level::WARN,
                                status = parsed_response.status,
                                message = parsed_response.message,
                                "Scanner API returned status != 1, retrying..."
                            );
                            if attempt < 5 {
                                sleep(Duration::from_millis(2u64.pow(attempt) * 1000)).await;
                                continue;
                            }
                        }
                        return Ok(Some(parsed_response));
                    }
                    Err(e) => {
                        event!(
                            Level::WARN,
                            error = %e,
                            "Failed to deserialize scanner response, retrying..."
                        );
                        if attempt < 5 {
                            sleep(Duration::from_millis(2u64.pow(attempt) * 1000)).await;
                            continue;
                        }
                        return Ok(None);
                    }
                }
            }
            Err(e) if attempt < 5 => {
                event!(
                    Level::WARN,
                    error = %e,
                    "Request failed, retrying... Attempt: {}",
                    attempt
                );
                sleep(Duration::from_millis(2u64.pow(attempt) * 1000)).await;
            }
            Err(e) => {
                event!(
                    Level::ERROR,
                    error = %e,
                    "Request failed after all retries"
                );
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
