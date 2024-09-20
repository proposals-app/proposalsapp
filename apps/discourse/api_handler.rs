use anyhow::{anyhow, Result};
use reqwest::Client;
use serde::de::DeserializeOwned;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, Semaphore};
use tokio::time::sleep;
use tracing::warn;

#[derive(Clone)]
pub struct ApiHandler {
    client: Client,
    max_retries: usize,
    semaphore: Arc<Semaphore>,
    sender: mpsc::Sender<Job>,
}

struct Job {
    url: String,
    response_sender: oneshot::Sender<Result<String>>,
}

impl ApiHandler {
    pub fn new(max_retries: usize) -> Self {
        let client = Client::new();
        let semaphore = Arc::new(Semaphore::new(5));
        let (sender, receiver) = mpsc::channel(100);

        let api_handler = Self {
            client,
            max_retries,
            semaphore: semaphore.clone(),
            sender,
        };

        tokio::spawn(api_handler.clone().run_queue(receiver));

        api_handler
    }

    pub async fn fetch<T>(&self, url: &str) -> Result<T>
    where
        T: DeserializeOwned,
    {
        let (response_sender, response_receiver) = oneshot::channel();
        let job = Job {
            url: url.to_string(),
            response_sender,
        };

        self.sender
            .send(job)
            .await
            .map_err(|e| anyhow!("Failed to send job: {}", e))?;

        let response = response_receiver
            .await
            .map_err(|e| anyhow!("Failed to receive response: {}", e))??;
        serde_json::from_str(&response).map_err(|e| anyhow!("Failed to parse response: {}", e))
    }

    async fn run_queue(self, mut receiver: mpsc::Receiver<Job>) {
        while let Some(job) = receiver.recv().await {
            let permit = self.semaphore.clone().acquire_owned().await.unwrap();
            let client = self.client.clone();
            let max_retries = self.max_retries;

            tokio::spawn(async move {
                let result = Self::execute_request(&client, &job.url, max_retries).await;
                let _ = job.response_sender.send(result);
                drop(permit);
            });
        }
    }

    async fn execute_request(client: &Client, url: &str, max_retries: usize) -> Result<String> {
        let mut attempt = 0;
        let mut delay = Duration::from_secs(2);

        loop {
            match client.get(url).send().await {
                Ok(response) => {
                    if response.status().is_success() {
                        return response
                            .text()
                            .await
                            .map_err(|e| anyhow!("Failed to get response text: {}", e));
                    } else if response.status().is_server_error()
                        || response.status().as_u16() == 429
                    {
                        attempt += 1;
                        if attempt > max_retries {
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
                    if attempt > max_retries {
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
