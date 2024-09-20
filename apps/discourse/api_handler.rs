use anyhow::{anyhow, Result};
use reqwest::Client;
use serde::de::DeserializeOwned;
use std::time::Duration;
use tokio::time::sleep;
use tracing::warn;

#[derive(Clone)]

pub struct ApiHandler {
    client: Client,
    max_retries: usize,
}

impl ApiHandler {
    pub fn new(max_retries: usize) -> Self {
        let client = Client::new();
        Self {
            client,
            max_retries,
        }
    }

    pub async fn fetch<T>(&self, url: &str) -> Result<T>
    where
        T: DeserializeOwned,
    {
        let mut attempt = 0;
        let mut delay = Duration::from_secs(2);

        loop {
            match self.client.get(url).send().await {
                Ok(response) => {
                    if response.status().is_success() {
                        let resp_json = response.json::<T>().await?;
                        return Ok(resp_json);
                    } else if response.status().is_server_error()
                        || response.status().as_u16() == 429
                    {
                        attempt += 1;
                        if attempt > self.max_retries {
                            return Err(anyhow!(
                                "Max retries reached. Last error: HTTP {}",
                                response.status()
                            ));
                        }

                        if response.status().as_u16() == 429 {
                            let retry_after = response
                                .headers()
                                .get("Retry-After")
                                .and_then(|h| h.to_str().ok())
                                .and_then(|s| s.parse::<u64>().ok())
                                .map(Duration::from_secs)
                                .unwrap_or(Duration::from_secs(60));

                            warn!(
                                "Rate limited. Waiting for {:?} before retrying...",
                                retry_after
                            );
                            sleep(retry_after).await;
                        } else {
                            warn!(
                                "Server error {}. Retrying in {:?}...",
                                response.status(),
                                delay
                            );
                            sleep(delay).await;
                            delay *= 2;
                        }
                    } else {
                        let status = response.status();
                        let body = response.text().await.unwrap_or_default();
                        return Err(anyhow!("Request failed with status {}: {}", status, body));
                    }
                }
                Err(e) => {
                    attempt += 1;
                    if attempt > self.max_retries {
                        return Err(anyhow!("Max retries reached. Last error: {}", e));
                    }
                    warn!("Request error: {}. Retrying in {:?}...", e, delay);
                    sleep(delay).await;
                    delay *= 2; // Exponential backoff
                }
            }
        }
    }
}
