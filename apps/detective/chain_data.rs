use alloy::providers::{Provider, ProviderBuilder, ReqwestProvider};
use anyhow::{Context, Result};
use chrono::{DateTime, NaiveDateTime, Utc};
use lazy_static::lazy_static;
use reqwest_middleware::ClientBuilder;
use reqwest_retry::{policies::ExponentialBackoff, RetryTransientMiddleware};
use serde::Deserialize;
use std::{collections::HashMap, fmt, sync::Arc, time::Duration};
use tokio::time::sleep;
use tracing::{event, Level};

// Chain-specific provider and scanner configuration
#[derive(Clone)]
pub struct ChainConfig {
    pub provider: Arc<ReqwestProvider>,
    pub scan_api_url: Option<String>,
    pub scan_api_key: Option<String>,
}

// Chain-specific provider and scanner configuration
#[derive(Clone, Copy, Eq, Hash, PartialEq)]
pub enum Chain {
    Ethereum,
    Arbitrum,
    Optimism,
    Polygon,
    Avalanche,
}

impl fmt::Display for Chain {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            Chain::Ethereum => write!(f, "Ethereum"),
            Chain::Arbitrum => write!(f, "Arbitrum"),
            Chain::Optimism => write!(f, "Optimism"),
            Chain::Polygon => write!(f, "Polygon"),
            Chain::Avalanche => write!(f, "Avalanche"),
        }
    }
}

lazy_static! {
    static ref CHAIN_CONFIG_MAP: HashMap<Chain, ChainConfig> = vec![
        (
            Chain::Ethereum,
            ChainConfig {
                provider: create_provider("ETHEREUM_NODE_URL"),
                scan_api_url: Some("https://api.etherscan.io/api".to_string()),
                scan_api_key: std::env::var("ETHERSCAN_API_KEY").ok(),
            }
        ),
        (
            Chain::Arbitrum,
            ChainConfig {
                provider: create_provider("ARBITRUM_NODE_URL"),
                scan_api_url: Some("https://api.arbiscan.io/api".to_string()),
                scan_api_key: std::env::var("ARBISCAN_API_KEY").ok(),
            }
        ),
        (
            Chain::Optimism,
            ChainConfig {
                provider: create_provider("OPTIMISM_NODE_URL"),
                scan_api_url: Some("https://api-optimistic.etherscan.io/api".to_string()),
                scan_api_key: std::env::var("OPTIMISTIC_SCAN_API_KEY").ok(),
            }
        ),
        (
            Chain::Polygon,
            ChainConfig {
                provider: create_provider("POLYGON_NODE_URL"),
                scan_api_url: None,
                scan_api_key: None,
            }
        ),
        (
            Chain::Avalanche,
            ChainConfig {
                provider: create_provider("AVALANCHE_NODE_URL"),
                scan_api_url: None,
                scan_api_key: None,
            }
        ),
    ]
    .into_iter()
    .collect();
}

fn create_provider(env_var: &str) -> Arc<ReqwestProvider> {
    let rpc_url = std::env::var(env_var).unwrap_or_else(|_| panic!("{} not set!", env_var));
    Arc::new(ProviderBuilder::new().on_http(rpc_url.parse().unwrap()))
}

pub fn get_chain_config(network: Chain) -> Result<ChainConfig> {
    CHAIN_CONFIG_MAP
        .get(&network)
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

// Blockchain scanner API functions
pub async fn estimate_timestamp(network: Chain, block_number: u64) -> Result<NaiveDateTime> {
    let config = get_chain_config(network)?;
    let provider = config.provider.clone();

    let current_block = provider.get_block_number().await?;

    if block_number < current_block {
        let block = provider
            .get_block_by_number(
                block_number.into(),
                alloy::rpc::types::BlockTransactionsKind::Hashes,
            )
            .await?
            .ok_or_else(|| anyhow::anyhow!("Block not found"))?;

        return Ok(DateTime::from_timestamp(block.header.timestamp as i64, 0)
            .expect("Invalid timestamp")
            .naive_utc());
    }

    let response = retry_request(
        config
            .scan_api_url
            .as_ref()
            .context("Scan API URL is missing")?,
        &config.scan_api_key.context("Scan API key is missing")?,
        block_number,
    )
    .await?;

    let estimated_time =
        Utc::now().timestamp() + response.result.estimate_time_in_sec.parse::<f64>()? as i64;

    Ok(DateTime::from_timestamp(estimated_time, 0)
        .expect("Invalid timestamp")
        .naive_utc())
}

#[allow(dead_code)]
pub async fn estimate_block(network: Chain, timestamp: u64) -> Result<u64> {
    let config = get_chain_config(network)?;

    let response = retry_request_estimate_block(
        config
            .scan_api_url
            .as_ref()
            .context("Scan API URL is missing")?,
        &config.scan_api_key.context("Scan API key is missing")?,
        timestamp,
    )
    .await?;

    response
        .result
        .parse::<u64>()
        .context("Failed to parse block number")
}

#[allow(dead_code)]
async fn retry_request_estimate_block(
    api_url: &str,
    api_key: &str,
    param: u64,
) -> Result<EstimateBlock> {
    let client = ClientBuilder::new(reqwest::Client::new())
        .with(RetryTransientMiddleware::new_with_policy(
            ExponentialBackoff::builder().build_with_max_retries(5),
        ))
        .build();

    for attempt in 1..=5 {
        let response = client
            .get(format!(
                "{}?module=block&action=getblocknobytime&timestamp={}&closest=before&apikey={}",
                api_url, param, api_key
            ))
            .timeout(Duration::from_secs(5))
            .send()
            .await;

        match response {
            Ok(res) => {
                let contents = res.text().await?;
                return serde_json::from_str(&contents)
                    .context("Failed to deserialize scanner response");
            }
            Err(_) if attempt < 5 => {
                event!(
                    Level::WARN,
                    "Request failed, retrying... Attempt: {}",
                    attempt
                );
                sleep(Duration::from_millis(2u64.pow(attempt))).await;
            }
            Err(e) => {
                event!(Level::ERROR, "Request failed after retries: {:?}", e);
                return Err(anyhow::anyhow!(
                    "Failed to estimate block number after retries"
                ));
            }
        }
    }

    unreachable!() // We should never reach here due to the loop structure
}

async fn retry_request(api_url: &str, api_key: &str, param: u64) -> Result<EstimateTimestamp> {
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
                return serde_json::from_str(&contents)
                    .context("Failed to deserialize scanner response");
            }
            Err(_) if attempt < 5 => {
                event!(
                    Level::WARN,
                    "Request failed, retrying... Attempt: {}",
                    attempt
                );
                sleep(Duration::from_millis(2u64.pow(attempt))).await;
            }
            Err(e) => {
                event!(Level::ERROR, "Request failed after retries: {:?}", e);
                return Err(anyhow::anyhow!(
                    "Failed to estimate timestamp after retries"
                ));
            }
        }
    }

    unreachable!() // We should never reach here due to the loop structure
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use dotenv::dotenv;

    #[tokio::test]
    async fn test_estimate_timestamp_past_block() {
        dotenv().ok();

        let block_number = 12000000;
        let result = estimate_timestamp(Chain::Ethereum, block_number)
            .await
            .unwrap();

        assert!(
            result < Utc::now().naive_utc(),
            "Timestamp should be in the past"
        );
    }

    #[tokio::test]
    async fn test_estimate_timestamp_future_block() {
        dotenv().ok();

        let config = get_chain_config(Chain::Ethereum).unwrap();
        let current_block = config.provider.get_block_number().await.unwrap();
        let block_number = current_block + 100;

        let result = estimate_timestamp(Chain::Ethereum, block_number)
            .await
            .unwrap();

        assert!(
            result > Utc::now().naive_utc(),
            "Timestamp should be in the future"
        );
    }

    #[tokio::test]
    async fn test_estimate_block() {
        dotenv().ok();

        let timestamp = 1681908547;
        let result = estimate_block(Chain::Ethereum, timestamp).await.unwrap();

        assert!(result > 0, "Block number should be non-zero");
    }
}