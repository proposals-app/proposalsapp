use anyhow::{anyhow, Result};
use reqwest::header::{HeaderMap, HeaderValue, RETRY_AFTER, USER_AGENT};
use reqwest::{Client, StatusCode};
use serde::de::DeserializeOwned;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;
use tokio::sync::{mpsc, oneshot};
use tokio::time::sleep;
use tracing::{error, info, instrument, warn};

const DEFAULT_QUEUE_SIZE: usize = 100_000;
const DEFAULT_MAX_RETRIES: usize = 5;
const DEFAULT_INITIAL_BACKOFF: Duration = Duration::from_secs(2);
const MAX_QUEUE_SIZE: usize = 5000;
const NORMAL_JOBS_BATCH_SIZE: usize = 10;

#[derive(Clone)]
pub struct DiscourseApi {
    client: Client,
    total_queue_size: std::sync::Arc<AtomicUsize>,
    priority_queue_size: std::sync::Arc<AtomicUsize>,
    normal_queue_size: std::sync::Arc<AtomicUsize>,
    max_retries: usize,
    sender: mpsc::Sender<Job>,
    pub base_url: String,
}

struct Job {
    url: String,
    priority: bool,
    response_sender: oneshot::Sender<Result<String>>,
}

impl DiscourseApi {
    #[tracing::instrument(level = "info", skip(base_url))]
    pub fn new(base_url: String) -> Self {
        Self::new_with_config(base_url, DEFAULT_QUEUE_SIZE, DEFAULT_MAX_RETRIES)
    }

    pub fn new_with_config(base_url: String, queue_size: usize, max_retries: usize) -> Self {
        let client = Client::builder()
            .default_headers(Self::default_headers())
            .build()
            .expect("Failed to build HTTP client");

        let (sender, receiver) = mpsc::channel(queue_size);

        let total_queue_size = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let priority_queue_size = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let normal_queue_size = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));

        let api_handler = Self {
            client,
            max_retries,
            sender,
            base_url,
            total_queue_size: total_queue_size.clone(),
            priority_queue_size: priority_queue_size.clone(),
            normal_queue_size: normal_queue_size.clone(),
        };

        tokio::spawn(api_handler.clone().run_queue(receiver));
        tokio::spawn(api_handler.clone().log_queue_sizes());

        api_handler
    }

    async fn log_queue_sizes(self) {
        let mut interval = tokio::time::interval(Duration::from_secs(10));
        loop {
            let total_size = self
                .total_queue_size
                .load(std::sync::atomic::Ordering::Relaxed);
            let priority_size = self
                .priority_queue_size
                .load(std::sync::atomic::Ordering::Relaxed);
            let normal_size = self
                .normal_queue_size
                .load(std::sync::atomic::Ordering::Relaxed);

            info!(
                base_url = %self.base_url,
                total_size,
                priority_size,
                normal_size,
                "Queue sizes"
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

    #[instrument(skip(self), fields(endpoint = %endpoint, priority = priority))]
    pub async fn fetch<T>(&self, endpoint: &str, priority: bool) -> Result<T>
    where
        T: DeserializeOwned,
    {
        let total_size = self.total_queue_size.load(Ordering::SeqCst);
        if total_size >= MAX_QUEUE_SIZE {
            warn!(
                self.base_url,
                total_size,
                max_size = MAX_QUEUE_SIZE,
                "Queue is full"
            );
            return Err(anyhow!("Queue is full. Please try again later."));
        }

        let (response_sender, response_receiver) = oneshot::channel();
        let url = format!("{}{}", self.base_url, endpoint);
        let job = Job {
            url,
            priority,
            response_sender,
        };

        self.total_queue_size.fetch_add(1, Ordering::SeqCst);
        if priority {
            self.priority_queue_size.fetch_add(1, Ordering::SeqCst);
        } else {
            self.normal_queue_size.fetch_add(1, Ordering::SeqCst);
        }

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
        let mut priority_queue = Vec::new();
        let mut normal_queue = Vec::new();

        loop {
            // Process all available jobs
            loop {
                match receiver.try_recv() {
                    Ok(job) => {
                        if job.priority {
                            priority_queue.push(job);
                        } else {
                            normal_queue.push(job);
                        }
                    }
                    Err(mpsc::error::TryRecvError::Empty) => break,
                    Err(mpsc::error::TryRecvError::Disconnected) => return,
                }
            }

            // Process all priority jobs
            while let Some(priority_job) = priority_queue.pop() {
                self.process_job(priority_job, true).await;
            }

            // Process a batch of normal jobs
            for _ in 0..NORMAL_JOBS_BATCH_SIZE {
                if let Some(normal_job) = normal_queue.pop() {
                    self.process_job(normal_job, false).await;
                } else {
                    break;
                }
            }

            // If both queues are empty, wait for new jobs
            if priority_queue.is_empty() && normal_queue.is_empty() {
                match receiver.recv().await {
                    Some(job) => {
                        if job.priority {
                            priority_queue.push(job);
                        } else {
                            normal_queue.push(job);
                        }
                    }
                    None => {
                        // Channel closed, exit the loop
                        break;
                    }
                }
            }
        }
    }

    async fn process_job(&self, job: Job, is_priority: bool) {
        let result = self.execute_request(&job.url).await;
        if let Err(e) = &result {
            if is_priority {
                error!(error = %e, url = %job.url, "Priority request failed");
            } else {
                error!(error = %e, url = %job.url, "Request failed");
            }
        } else {
            info!(url = %job.url, priority = is_priority, "Request processed successfully");
        }
        let _ = job.response_sender.send(result);

        self.total_queue_size.fetch_sub(1, Ordering::SeqCst);
        if is_priority {
            self.priority_queue_size.fetch_sub(1, Ordering::SeqCst);
        } else {
            self.normal_queue_size.fetch_sub(1, Ordering::SeqCst);
        }
    }

    #[instrument(skip(self), fields(url = %url))]
    async fn execute_request(&self, url: &str) -> Result<String> {
        let mut attempt = 0;
        let mut delay = DEFAULT_INITIAL_BACKOFF;

        loop {
            match self.client.get(url).send().await {
                Ok(response) => match response.status() {
                    StatusCode::OK => {
                        info!(url, "Request successful");
                        return response
                            .text()
                            .await
                            .map_err(|e| anyhow!("Failed to get response text: {}", e));
                    }
                    StatusCode::TOO_MANY_REQUESTS => {
                        attempt += 1;
                        if attempt > self.max_retries {
                            error!(
                                url,
                                attempt,
                                max_retries = self.max_retries,
                                "Max retries reached. Last error: HTTP 429"
                            );
                            return Err(anyhow!("Max retries reached. Last error: HTTP 429"));
                        }

                        let retry_after = Self::get_retry_after(&response, delay);
                        warn!(url, attempt, retry_after = ?retry_after, "Rate limited, retrying");
                        sleep(retry_after).await;
                        delay = delay.max(retry_after) * 2;
                    }
                    status if status.is_server_error() => {
                        attempt += 1;
                        if attempt > self.max_retries {
                            error!(url, status = %status, attempt, max_retries = self.max_retries, "Max retries reached. Server error");
                            return Err(anyhow!(
                                "Max retries reached. Last error: HTTP {}",
                                status
                            ));
                        }

                        warn!(url, status = %status, attempt, delay = ?delay, "Server error, retrying");
                        sleep(delay).await;
                        delay *= 2;
                    }
                    status => {
                        let body = response.text().await.unwrap_or_default();
                        error!(url, status = %status, body, "Request failed");
                        return Err(anyhow!("Request failed with status {}: {}", status, body));
                    }
                },
                Err(e) => {
                    attempt += 1;
                    if attempt > self.max_retries {
                        error!(url, error = %e, attempt, max_retries = self.max_retries, "Max retries reached");
                        return Err(anyhow!("Max retries reached. Last error: {}", e));
                    }
                    warn!(url, error = %e, attempt, delay = ?delay, "Request error, retrying");
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
