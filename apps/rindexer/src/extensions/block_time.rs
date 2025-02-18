use crate::rindexer_lib::typings::networks::{
    get_arbitrum_provider_cache, get_avalanche_provider_cache, get_ethereum_provider_cache, get_optimism_provider_cache,
    get_polygon_provider_cache,
};
use anyhow::{Context, Result};
use chrono::{DateTime, NaiveDateTime, Utc};
use ethers::{providers::Middleware, types::BlockId};
use lazy_static::lazy_static;
use reqwest_middleware::ClientBuilder;
use reqwest_retry::{policies::ExponentialBackoff, RetryTransientMiddleware};
use rindexer::provider::JsonRpcCachedProvider;
use serde::Deserialize;
use std::{collections::HashMap, sync::Arc, time::Duration};
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
    result: EstimateTimestampResult,
}

#[derive(Deserialize, PartialEq, Debug)]
struct EstimateBlock {
    status: String,
    message: String,
    result: String,
}

pub async fn estimate_timestamp(network: &'static str, block_number: u64) -> Result<NaiveDateTime> {
    let config = get_chain_config(network)?;
    let provider = config.provider.get_inner_provider();

    let current_block = provider.get_block_number().await?.as_u64();

    // If the requested block is already in the past, fetch the block timestamp directly.
    if block_number < current_block {
        let block = provider
            .get_block(BlockId::Number(block_number.into()))
            .await?
            .ok_or_else(|| anyhow::anyhow!("Block not found"))?;

        return Ok(DateTime::<Utc>::from_timestamp(block.timestamp.as_u64() as i64, 0)
            .expect("Failed to create DateTime")
            .naive_utc());
    }

    // Attempt to get estimated timestamp from block explorer API.
    match retry_request(
        config.scan_api_url.as_ref().context("Scan API URL is missing")?,
        &config.scan_api_key.context("Scan API key is missing")?,
        block_number,
    )
    .await
    {
        Ok(Some(response)) => {
            let estimated_time_in_sec: i64 = response.result.estimate_time_in_sec.parse()?;
            let estimated_naive_datetime = Utc::now()
                .checked_add_signed(chrono::Duration::seconds(estimated_time_in_sec))
                .context("Failed to add duration to current time")?
                .naive_utc();
            Ok(estimated_naive_datetime)
        }
        Ok(None) => {
            event!(Level::WARN, network = network, block_number = block_number, "Failed to estimate timestamp from API after retries, returning epoch 0");
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
                let contents = res.text().await?;
                match serde_json::from_str::<EstimateTimestamp>(&contents) {
                    Ok(parsed_response) => return Ok(Some(parsed_response)),
                    Err(e) => {
                        event!(Level::WARN, error = %e, content = %contents, "Failed to deserialize scanner response, retrying...");
                        if attempt < 5 {
                            sleep(Duration::from_millis(2u64.pow(attempt))).await;
                            continue; // Retry if deserialization fails.
                        } else {
                            return Err(anyhow::anyhow!("Failed to deserialize scanner response after retries: {}", e));
                        }
                    }
                }
            }
            Err(e) if attempt < 5 => {
                event!(Level::WARN, error = %e, "Request failed, retrying... Attempt: {}", attempt);
                sleep(Duration::from_millis(2u64.pow(attempt))).await;
            }
            Err(e) => {
                event!(Level::ERROR, error = %e, "Request failed after retries");
                return Ok(None); // Return Ok(None) to indicate failure after retries.
            }
        }
    }

    Ok(None) // Indicate failure if loop completes without returning inside.
}
