use anyhow::{Context, Result};
use chrono::{NaiveDateTime, Utc};
use ethers::providers::{Http, Middleware, Provider};
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
    let optimisticscan_api_key =
        std::env::var("OPTIMISTIC_SCAN_API_KEY").expect("Optimistic Etherscan key not set!");
    let rpc_url = std::env::var("OPTIMISM_NODE_URL").expect("Optimism node not set!");
    let provider = Provider::<Http>::try_from(rpc_url)?;

    let current_block = provider.get_block_number().await?;

    if block_number < current_block.as_u64() {
        let block = provider
            .get_block(block_number)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Block not found"))?;

        return NaiveDateTime::from_timestamp_millis(block.timestamp.as_u64() as i64 * 1000)
            .context("Invalid timestamp");
    }

    let retry_policy = ExponentialBackoff::builder().build_with_max_retries(5);
    let http_client = ClientBuilder::new(reqwest::Client::new())
        .with(RetryTransientMiddleware::new_with_policy(retry_policy))
        .build();

    let mut retries = 0;
    loop {
        let response = http_client
            .get(format!(
        "https://api-optimistic.etherscan.io/api?module=block&action=getblockcountdown&blockno={}&apikey={}",
        block_number, optimisticscan_api_key
    ))
    .timeout(Duration::from_secs(5))
    .send()
    .await;

        match response {
            Ok(res) => {
                let contents = res.text().await?;
                let data: EstimateTimestamp = serde_json::from_str(&contents)
                    .context("Failed to deserialize etherscan response")?;

                let estimated_time = Utc::now().timestamp() * 1000
                    + data.result.estimate_time_in_sec.parse::<f64>()? as i64 * 1000;

                return NaiveDateTime::from_timestamp_millis(estimated_time)
                    .context("Invalid estimated timestamp");
            }
            Err(_) if retries < 5 => {
                retries += 1;
                let backoff_duration = Duration::from_millis(2u64.pow(retries));
                sleep(backoff_duration).await;
            }
            Err(_) => {
                return NaiveDateTime::from_timestamp_millis(Utc::now().timestamp() * 1000)
                    .context("Failed to estimate timestamp after retries");
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
    let optimisticscan_api_key =
        std::env::var("OPTIMISTIC_SCAN_API_KEY").expect("Optimistic Etherscan key not set!");

    let retry_policy = ExponentialBackoff::builder().build_with_max_retries(5);
    let http_client = ClientBuilder::new(reqwest::Client::new())
        .with(RetryTransientMiddleware::new_with_policy(retry_policy))
        .build();

    let mut retries = 0;
    loop {
        let response = http_client
                .get(format!(
                "https://api-optimistic.etherscan.io/api?module=block&action=getblocknobytime&timestamp={}&closest=before&apikey={}",
                timestamp, optimisticscan_api_key
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
mod tests {
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

        let rpc_url = std::env::var("OPTIMISM_NODE_URL").expect("Optimism node not set!");
        let provider = Provider::<Http>::try_from(rpc_url).unwrap();

        let current_block = provider.get_block_number().await.unwrap();

        let block_number = current_block.as_u64() + 100;
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
        let expected_block_number = 92236867; // Known block number for the given timestamp
        let result = estimate_block(timestamp).await.unwrap();

        println!("Estimated Block Number: {}", result);

        // Ensure we got the expected block number
        assert_eq!(
            result, expected_block_number,
            "Block number should match the expected block number"
        );
    }
}
