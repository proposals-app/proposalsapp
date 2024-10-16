use anyhow::{anyhow, Result};
use reqwest::header::{HeaderMap, HeaderValue, RETRY_AFTER, USER_AGENT};
use reqwest::{Client, StatusCode};
use serde::de::DeserializeOwned;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::sleep;
use tracing::{debug, error, warn};

const DEFAULT_QUEUE_SIZE: usize = 1000;
const DEFAULT_MAX_RETRIES: usize = 10;
const DEFAULT_INITIAL_BACKOFF: Duration = Duration::from_secs(2);

#[derive(Clone)]
pub struct ApiHandler {
    client: Client,
    max_retries: usize,
    sender: mpsc::Sender<Job>,
    base_url: String,
}

struct Job {
    url: String,
    response_sender: oneshot::Sender<Result<String>>,
}

impl ApiHandler {
    pub fn new(base_url: String) -> Self {
        Self::new_with_config(base_url, DEFAULT_QUEUE_SIZE, DEFAULT_MAX_RETRIES)
    }

    pub fn new_with_config(base_url: String, queue_size: usize, max_retries: usize) -> Self {
        let client = Client::builder()
            .default_headers(Self::default_headers())
            .build()
            .expect("Failed to build HTTP client");

        let (sender, receiver) = mpsc::channel(queue_size);

        let api_handler = Self {
            client,
            max_retries,
            sender,
            base_url,
        };

        tokio::spawn(api_handler.clone().run_queue(receiver));

        api_handler
    }

    fn default_headers() -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(USER_AGENT, HeaderValue::from_static("proposals.app Discourse Indexer/1.0 (https://proposals.app; contact@proposals.app) reqwest/0.12"));
        headers.insert("Referer", HeaderValue::from_static("https://proposals.app"));
        headers
    }

    pub async fn fetch<T>(&self, endpoint: &str) -> Result<T>
    where
        T: DeserializeOwned,
    {
        let (response_sender, response_receiver) = oneshot::channel();
        let url = format!("{}{}", self.base_url, endpoint);
        let job = Job {
            url,
            response_sender,
        };

        self.sender
            .send(job)
            .await
            .map_err(|e| anyhow!("Failed to send job: {}", e))?;

        debug!("Job added to queue: {}", endpoint);

        let response = response_receiver
            .await
            .map_err(|e| anyhow!("Failed to receive response: {}", e))??;
        serde_json::from_str(&response).map_err(|e| anyhow!("Failed to parse response: {}", e))
    }

    async fn run_queue(self, mut receiver: mpsc::Receiver<Job>) {
        while let Some(job) = receiver.recv().await {
            let result = self.execute_request(&job.url).await;
            if let Err(e) = &result {
                error!("Request failed: {}", e);
            }
            let _ = job.response_sender.send(result);
        }
    }

    async fn execute_request(&self, url: &str) -> Result<String> {
        let mut attempt = 0;
        let mut delay = DEFAULT_INITIAL_BACKOFF;

        loop {
            match self.client.get(url).send().await {
                Ok(response) => match response.status() {
                    StatusCode::OK => {
                        return response
                            .text()
                            .await
                            .map_err(|e| anyhow!("Failed to get response text: {}", e));
                    }
                    StatusCode::TOO_MANY_REQUESTS => {
                        attempt += 1;
                        if attempt > self.max_retries {
                            return Err(anyhow!(
                                "Max retries reached. Last error: HTTP {}",
                                response.status()
                            ));
                        }

                        let retry_after = Self::get_retry_after(&response, delay);
                        warn!(
                            "Rate limited (429). Waiting for {:?} before retrying...",
                            retry_after
                        );
                        sleep(retry_after).await;
                        delay = delay.max(retry_after) * 2;
                    }
                    status if status.is_server_error() => {
                        attempt += 1;
                        if attempt > self.max_retries {
                            return Err(anyhow!(
                                "Max retries reached. Last error: HTTP {}",
                                status
                            ));
                        }

                        warn!(
                            "Server error {}. Waiting for {:?} before retrying...",
                            status, delay
                        );
                        sleep(delay).await;
                        delay *= 2;
                    }
                    status => {
                        let body = response.text().await.unwrap_or_default();
                        return Err(anyhow!("Request failed with status {}: {}", status, body));
                    }
                },
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

    fn get_retry_after(response: &reqwest::Response, default: Duration) -> Duration {
        response
            .headers()
            .get(RETRY_AFTER)
            .and_then(|h| h.to_str().ok())
            .and_then(|s| s.parse::<u64>().ok())
            .map(Duration::from_secs)
            .unwrap_or(default)
    }
}
