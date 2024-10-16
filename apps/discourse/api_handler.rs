use anyhow::{anyhow, Result};
use reqwest::header::{HeaderMap, HeaderValue, RETRY_AFTER, USER_AGENT};
use reqwest::{Client, StatusCode};
use serde::de::DeserializeOwned;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::sleep;
use tracing::{debug, error, warn};

const DEFAULT_QUEUE_SIZE: usize = 100_000;
const DEFAULT_MAX_RETRIES: usize = 5;
const DEFAULT_INITIAL_BACKOFF: Duration = Duration::from_secs(2);

#[derive(Clone)]
pub struct ApiHandler {
    client: Client,
    queue_size: std::sync::Arc<std::sync::atomic::AtomicUsize>,
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

        let queue_size_counter = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));

        let api_handler = Self {
            client,
            max_retries,
            sender,
            base_url,
            queue_size: queue_size_counter.clone(),
        };

        tokio::spawn(api_handler.clone().run_queue(receiver));
        tokio::spawn(api_handler.clone().log_queue_size());

        api_handler
    }

    async fn log_queue_size(self) {
        let mut interval = tokio::time::interval(Duration::from_secs(60));
        loop {
            let size = self.queue_size.load(std::sync::atomic::Ordering::Relaxed);
            debug!(
                "{} - Current API request queue size: {}",
                self.base_url, size
            );
            interval.tick().await;
        }
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

        self.queue_size
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
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
            self.queue_size
                .fetch_sub(1, std::sync::atomic::Ordering::Relaxed);
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
                            error!(url = url, "Max retries reached. Last error: HTTP 429");
                            return Err(anyhow!("Max retries reached. Last error: HTTP 429"));
                        }

                        let retry_after = Self::get_retry_after(&response, delay);
                        warn!(
                            url = url,
                            retry_after = ?retry_after,
                            "Rate limited (429). Waiting before retrying..."
                        );
                        sleep(retry_after).await;
                        delay = delay.max(retry_after) * 2;
                    }
                    status if status.is_server_error() => {
                        attempt += 1;
                        if attempt > self.max_retries {
                            error!(url = url, status = %status, "Max retries reached. Server error");
                            return Err(anyhow!(
                                "Max retries reached. Last error: HTTP {}",
                                status
                            ));
                        }

                        warn!(
                            url = url,
                            status = %status,
                            delay = ?delay,
                            "Server error. Waiting before retrying..."
                        );
                        sleep(delay).await;
                        delay *= 2;
                    }
                    status => {
                        let body = response.text().await.unwrap_or_default();
                        error!(url = url, status = %status, body = body, "Request failed");
                        return Err(anyhow!("Request failed with status {}: {}", status, body));
                    }
                },
                Err(e) => {
                    attempt += 1;
                    if attempt > self.max_retries {
                        error!(url = url, error = %e, "Max retries reached");
                        return Err(anyhow!("Max retries reached. Last error: {}", e));
                    }
                    warn!(url = url, error = %e, delay = ?delay, "Request error. Retrying...");
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
