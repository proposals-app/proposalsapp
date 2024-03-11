use anyhow::{bail, Context, Result};
use chrono::{NaiveDateTime, Utc};
use ethers::providers::{Http, Middleware, Provider};
use reqwest_middleware::ClientBuilder;
use reqwest_retry::{policies::ExponentialBackoff, RetryTransientMiddleware};
use serde::Deserialize;
use tracing::{event, Level};

#[allow(dead_code, non_snake_case)]
#[derive(Deserialize, PartialEq, Debug)]
pub struct EstimateTimestampResult {
    CurrentBlock: String,
    CountdownBlock: String,
    RemainingBlock: String,
    EstimateTimeInSec: String,
}

#[allow(dead_code, non_snake_case)]
#[derive(Deserialize, PartialEq, Debug)]
pub struct EstimateTimestamp {
    status: String,
    message: String,
    result: EstimateTimestampResult,
}

pub async fn estimate_timestamp(block_number: u64) -> Result<NaiveDateTime> {
    let arbiscan_api_key = std::env::var("ARBISCAN_API_KEY").expect("Etherscan key not set!");
    let arb_url = std::env::var("ARBITRUM_NODE_URL").expect("Ethereum node not set!");

    let provider = Provider::<Http>::try_from(arb_url)?;

    let current_block = provider.get_block_number().await?;

    if block_number < current_block.as_u64() {
        let block = provider.get_block(block_number).await?;

        let result: NaiveDateTime =
            NaiveDateTime::from_timestamp_millis(block.unwrap().timestamp.as_u64() as i64 * 1000)
                .context("bad timestamp")?;

        return Ok(result);
    }

    let mut retries = 0;

    let retry_policy = ExponentialBackoff::builder().build_with_max_retries(5);
    let http_client = ClientBuilder::new(reqwest::Client::new())
        .with(RetryTransientMiddleware::new_with_policy(retry_policy))
        .build();

    loop {
        let response = http_client
            .get(format!(
                "https://api.arbiscan.io/api?module=block&action=getblockcountdown&blockno={}&apikey={}",
                block_number, arbiscan_api_key
            ))
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await;

        match response {
            Ok(res) => {
                let contents = res.text().await?;
                let data = match serde_json::from_str::<EstimateTimestamp>(&contents) {
                    Ok(d) => NaiveDateTime::from_timestamp_millis(
                        Utc::now().timestamp() * 1000
                            + d.result.EstimateTimeInSec.parse::<f64>()? as i64 * 1000,
                    )
                    .context("bad timestamp")?,

                    Err(_) => bail!("Unable to deserialize etherscan response."),
                };

                return Ok(data);
            }

            _ if retries < 15 => {
                retries += 1;
                let backoff_duration = std::time::Duration::from_millis(2u64.pow(retries as u32));
                tokio::time::sleep(backoff_duration).await;
            }
            _ => {
                return NaiveDateTime::from_timestamp_millis(Utc::now().timestamp() * 1000)
                    .context("bad timestamp");
            }
        }
    }
}

#[allow(dead_code, non_snake_case)]
#[derive(Deserialize, PartialEq, Debug)]
pub struct EstimateBlock {
    status: String,
    message: String,
    result: String,
}

pub async fn _estimate_block(timestamp: u64) -> Result<u64> {
    let arbiscan_api_key = std::env::var("ARBISCAN_API_KEY").expect("Etherscan key not set!");

    let mut retries = 0;

    let retry_policy = ExponentialBackoff::builder().build_with_max_retries(5);
    let http_client = ClientBuilder::new(reqwest::Client::new())
        .with(RetryTransientMiddleware::new_with_policy(retry_policy))
        .build();

    loop {
        let response = http_client
            .get(format!(
                "https://api.arbiscan.io/api?module=block&action=getblocknobytime&timestamp={}&closest=before&apikey={}",
                timestamp, arbiscan_api_key
            ))
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await;

        match response {
            Ok(res) => {
                let contents = res.text().await?;
                let data = match serde_json::from_str::<EstimateBlock>(&contents) {
                    Ok(d) => d.result.parse::<u64>().unwrap_or(0),
                    Err(_) => {
                        event!(
                            Level::ERROR,
                            timestamp = timestamp,
                            url = format!(
                                "https://api.arbiscan.io/api?module=block&action=getblocknobytime&timestamp={}&closest=before&apikey={}",
                                timestamp, arbiscan_api_key
                            ),
                            "estimate_block"
                        );

                        0
                    }
                };

                return Ok(data);
            }

            _ if retries < 5 => {
                retries += 1;
                let backoff_duration = std::time::Duration::from_millis(2u64.pow(retries as u32));
                tokio::time::sleep(backoff_duration).await;
            }
            _ => {
                return Ok(0);
            }
        }
    }
}

// #[cfg(test)]
// mod tests {
//     use crate::utils::etherscan::{estimate_block, estimate_timestamp};
//     use chrono::{DateTime, NaiveDateTime, Utc};
//     use dotenv::dotenv;

//     #[tokio::test]
//     async fn get_block_timestamp() {
//         dotenv().ok();

//         let result = estimate_timestamp(18000000).await.unwrap();

//         assert_eq!(
//             result,
//             DateTime::<Utc>::from_utc(
//                 NaiveDateTime::from_timestamp_millis(Utc::now().timestamp() * 1000)
//                     .context("bad timestamp"),
//                 Utc,
//             ),
//         );
//     }

//     #[tokio::test]
//     async fn get_block() {
//         dotenv().ok();

//         let result = estimate_block(1681908547).await.unwrap();

//         assert_eq!(result, 17080747);
//     }
// }
