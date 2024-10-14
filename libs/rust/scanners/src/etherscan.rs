use alloy::providers::{Provider, ProviderBuilder};
use anyhow::{Context, Result};
use chrono::{DateTime, NaiveDateTime, Utc};
use reqwest_middleware::ClientBuilder;
use reqwest_retry::{policies::ExponentialBackoff, RetryTransientMiddleware};
use serde::Deserialize;
use std::time::Duration;
use tokio::time::sleep;
use tracing::{event, Level};

#[derive(Deserialize, PartialEq, Debug)]
pub struct EstimateTimestampResult {
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
pub struct EstimateTimestamp {
    status: String,
    message: String,
    result: EstimateTimestampResult,
}

pub async fn estimate_timestamp(block_number: u64) -> Result<NaiveDateTime> {
    let etherscan_api_key = std::env::var("ETHERSCAN_API_KEY").context("Etherscan key not set")?;
    let rpc_url = std::env::var("ETHEREUM_NODE_URL").context("Ethereum node not set")?;

    let provider = ProviderBuilder::new().on_http(rpc_url.parse()?);

    let current_block = provider.get_block_number().await?;

    if block_number < current_block {
        let block = provider
            .get_block_by_number(block_number.into(), true)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Block not found"))?;

        return Ok(DateTime::from_timestamp(block.header.timestamp as i64, 0)
            .expect("Invalid timestamp")
            .naive_utc());
    }

    let retry_policy = ExponentialBackoff::builder().build_with_max_retries(5);
    let http_client = ClientBuilder::new(reqwest::Client::new())
        .with(RetryTransientMiddleware::new_with_policy(retry_policy))
        .build();

    let mut retries = 0;
    loop {
        let response = http_client
            .get(format!(
                "https://api.etherscan.io/api?module=block&action=getblockcountdown&blockno={}&apikey={}",
                block_number, etherscan_api_key
            ))
            .timeout(Duration::from_secs(5))
            .send()
            .await;

        match response {
            Ok(res) => {
                let contents = res.text().await?;
                let data: EstimateTimestamp = serde_json::from_str(&contents)
                    .context("Failed to deserialize etherscan response")?;

                let estimated_time = Utc::now().timestamp()
                    + data.result.estimate_time_in_sec.parse::<f64>()? as i64;

                return Ok(DateTime::from_timestamp(estimated_time, 0)
                    .expect("Invalid timestamp")
                    .naive_utc());
            }
            Err(_) if retries < 5 => {
                retries += 1;
                let backoff_duration = Duration::from_millis(2u64.pow(retries));
                sleep(backoff_duration).await;
            }
            Err(_) => {
                return Ok(DateTime::from_timestamp(Utc::now().timestamp(), 0)
                    .expect("Invalid timestamp")
                    .naive_utc());
            }
        }
    }
}

#[derive(Deserialize, PartialEq, Debug)]
pub struct EstimateBlock {
    status: String,
    message: String,
    result: String,
}

pub async fn estimate_block(timestamp: u64) -> Result<u64> {
    let etherscan_api_key = std::env::var("ETHERSCAN_API_KEY").context("Etherscan key not set")?;

    let retry_policy = ExponentialBackoff::builder().build_with_max_retries(5);
    let http_client = ClientBuilder::new(reqwest::Client::new())
        .with(RetryTransientMiddleware::new_with_policy(retry_policy))
        .build();

    let mut retries = 0;
    loop {
        let response = http_client
            .get(format!(
                "https://api.etherscan.io/api?module=block&action=getblocknobytime&timestamp={}&closest=before&apikey={}",
                timestamp, etherscan_api_key
            ))
            .timeout(Duration::from_secs(5))
            .send()
            .await;

        match response {
            Ok(res) => {
                let contents = res.text().await?;
                let data: EstimateBlock = serde_json::from_str(&contents)
                    .context("Failed to deserialize etherscan response")?;

                return data
                    .result
                    .parse::<u64>()
                    .context("Failed to parse block number");
            }
            Err(_) if retries < 5 => {
                retries += 1;
                let backoff_duration = Duration::from_millis(2u64.pow(retries));
                sleep(backoff_duration).await;
            }
            Err(_) => {
                event!(
                    Level::ERROR,
                    timestamp,
                    "Failed to estimate block number after retries"
                );
                return Ok(0);
            }
        }
    }
}

#[cfg(test)]
mod etherscan_tests {
    use super::*;
    use chrono::Utc;
    use dotenv::dotenv;

    #[tokio::test]
    async fn test_estimate_timestamp_past_block() {
        dotenv().ok();

        // Test with a block number known to be in the past
        let block_number = 12000000;
        let result = estimate_timestamp(block_number).await.unwrap();

        // We can't assert exact equality due to time differences, but we can check if it's in the past
        assert!(
            result < Utc::now().naive_utc(),
            "Timestamp should be in the past"
        );
    }

    #[tokio::test]
    async fn test_estimate_timestamp_future_block() {
        dotenv().ok();

        // Test with a block number likely to be in the future
        let rpc_url = std::env::var("ETHEREUM_NODE_URL").expect("Ethereum node not set!");
        let provider = ProviderBuilder::new().on_http(rpc_url.parse().unwrap());

        let current_block = provider.get_block_number().await.unwrap();

        let block_number = current_block + 100;

        let result = estimate_timestamp(block_number).await.unwrap();

        // Since we can't predict the future block time, just ensure we got a valid result
        assert!(
            result > Utc::now().naive_utc(),
            "Timestamp should be in the future"
        );
    }

    #[tokio::test]
    async fn test_estimate_block() {
        dotenv().ok();

        // Test with a known timestamp
        let timestamp = 1681908547; // Example timestamp
        let result = estimate_block(timestamp).await.unwrap();

        println!("{}", result);

        // We can't assert exact block number, but ensure we got a valid non-zero result
        assert!(result > 0, "Block number should be non-zero");
    }

    #[tokio::test]
    async fn test_estimate_block_2() {
        dotenv().ok();

        // Test with a known timestamp
        let timestamp = 1681908547; // Example timestamp
        let expected_block_number = 17080747; // Known block number for the given timestamp
        let result = estimate_block(timestamp).await.unwrap();

        println!("Estimated Block Number: {}", result);

        // Ensure we got the expected block number
        assert_eq!(
            result, expected_block_number,
            "Block number should match the expected block number"
        );
    }
}
