use anyhow::Result;
use once_cell::sync::OnceCell;
use reqwest::Client;
use serde::de::DeserializeOwned;
use std::{
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::{
    sync::{Semaphore, mpsc, oneshot},
    time::{sleep, timeout},
};
use tracing::{debug, error, info, instrument, warn};

static SNAPSHOT_MAX_RETRIES: usize = 5;
static SNAPSHOT_MAX_CONCURRENT_REQUESTS: usize = 5;
static SNAPSHOT_MAX_QUEUE: usize = 100;
static SNAPSHOT_TIMEOUT: Duration = Duration::from_secs(60 * 5);

struct RateLimiter {
    remaining: std::sync::atomic::AtomicU32,
    reset: tokio::sync::Mutex<Instant>,
}

impl RateLimiter {
    fn new() -> Self {
        Self {
            remaining: std::sync::atomic::AtomicU32::new(100),
            reset: tokio::sync::Mutex::new(Instant::now()),
        }
    }
}

#[derive(Clone, Debug)]
pub struct SnapshotApiConfig {
    pub max_retries: usize,
    pub concurrency: usize,
    pub queue_size: usize,
    pub request_timeout: Duration,
}

impl Default for SnapshotApiConfig {
    fn default() -> Self {
        Self {
            max_retries: SNAPSHOT_MAX_RETRIES,
            concurrency: SNAPSHOT_MAX_CONCURRENT_REQUESTS,
            queue_size: SNAPSHOT_MAX_QUEUE,
            request_timeout: SNAPSHOT_TIMEOUT,
        }
    }
}

pub struct SnapshotApiHandler {
    client: Client,
    config: SnapshotApiConfig,
    semaphore: Arc<Semaphore>,
    sender: mpsc::Sender<Job>,
    rate_limiter: Arc<RateLimiter>,
}

struct Job {
    url: String,
    query: String,
    response_sender: oneshot::Sender<Result<String>>,
}

impl Clone for SnapshotApiHandler {
    fn clone(&self) -> Self {
        Self {
            client: self.client.clone(),
            config: self.config.clone(),
            semaphore: self.semaphore.clone(),
            sender: self.sender.clone(),
            rate_limiter: self.rate_limiter.clone(),
        }
    }
}

pub static SNAPSHOT_API_HANDLER: OnceCell<Arc<SnapshotApiHandler>> = OnceCell::new();

#[instrument(name = "snapshot_api_initialize_snapshot_api", skip_all)]
pub async fn initialize_snapshot_api() -> Result<()> {
    let config = SnapshotApiConfig::default();
    let handler = SnapshotApiHandler::new(config);

    SNAPSHOT_API_HANDLER
        .set(Arc::new(handler))
        .map_err(|_| anyhow::anyhow!("Failed to set snapshot api handler"))?;
    info!("Snapshot API Handler initialized.");
    Ok(())
}

impl SnapshotApiHandler {
    pub fn new(config: SnapshotApiConfig) -> Self {
        let client = Client::new();
        let semaphore = Arc::new(Semaphore::new(config.concurrency));
        let (sender, receiver) = mpsc::channel(config.queue_size);
        let rate_limiter = Arc::new(RateLimiter::new());

        let api_handler = Self {
            client,
            config,
            semaphore: semaphore.clone(),
            sender,
            rate_limiter,
        };

        tokio::spawn(api_handler.clone().run_queue(receiver));
        info!("Snapshot API job queue started.");

        api_handler
    }

    #[instrument(name = "snapshot_api_fetch", skip(self, url), fields(url = url))]
    pub async fn fetch<T>(&self, url: &str, query: String) -> Result<T>
    where
        T: DeserializeOwned,
    {
        let (response_sender, response_receiver) = oneshot::channel();
        let job = Job {
            url: url.to_string(),
            query,
            response_sender,
        };

        self.sender.send(job).await?;
        debug!(
            queue_size = self.sender.capacity() - self.sender.weak_count(),
            "Job sent to snapshot API queue"
        );

        let response = response_receiver.await??;
        Ok(serde_json::from_str(&response)?)
    }

    #[instrument(name = "snapshot_api_run_queue", skip(self, receiver))]
    async fn run_queue(self, mut receiver: mpsc::Receiver<Job>) {
        while let Some(job) = receiver.recv().await {
            debug!(
                url = job.url,
                query_len = job.query.len(),
                "Received job from snapshot API queue"
            );
            let permit = self.semaphore.clone().acquire_owned().await.unwrap();
            let client = self.client.clone();
            let config = self.config.clone();
            let rate_limiter = self.rate_limiter.clone();
            let job_url = job.url.clone();
            let job_query = job.query.clone();

            tokio::spawn(async move {
                let result =
                    Self::execute_request(&client, &job_url, &job_query, &config, rate_limiter)
                        .await;
                if let Err(e) = job.response_sender.send(result) {
                    error!(error = ?e, url = job_url, query_len = job_query.len(), "Failed to send response for snapshot API request");
                } else {
                    debug!(
                        url = job_url,
                        query_len = job_query.len(),
                        "Response sent for snapshot API request"
                    );
                }
                drop(permit);
            });
        }
        info!("Snapshot API job queue receiver closed.");
    }

    #[instrument(name = "snapshot_api_execute_request", skip(client, rate_limiter, config), fields(url = url))]
    async fn execute_request(
        client: &Client,
        url: &str,
        query: &str,
        config: &SnapshotApiConfig,
        rate_limiter: Arc<RateLimiter>,
    ) -> Result<String> {
        let mut attempt = 0;
        let mut delay = Duration::from_secs(1);

        loop {
            Self::wait_for_rate_limit(&rate_limiter).await;

            let request_builder = client
                .get(url)
                .json(&serde_json::json!({"query": query}))
                .header(
                    reqwest::header::USER_AGENT,
                    "proposals.app Detective/1.0 (https://proposals.app; contact@proposals.app) \
                     reqwest/0.12",
                )
                .header("Referer", "https://proposals.app");

            let timeout_fut = timeout(config.request_timeout, request_builder.send());

            match timeout_fut.await {
                Ok(Ok(response)) => {
                    Self::update_rate_limit_info(&response, &rate_limiter);

                    if response.status().is_success() {
                        let status = response.status();
                        let response_text = response.text().await?;
                        debug!(
                            url = url,
                            response_status = status.as_u16(),
                            response_body_len = response_text.len(),
                            "Snapshot API request successful"
                        );
                        return Ok(response_text);
                    } else if response.status().as_u16() == 429 {
                        attempt += 1;
                        if attempt > config.max_retries {
                            return Err(anyhow::anyhow!("Max retries reached for URL: {}", url));
                        }

                        let retry_after = response
                            .headers()
                            .get(reqwest::header::RETRY_AFTER)
                            .and_then(|h| h.to_str().ok())
                            .and_then(|s| s.parse::<u64>().ok())
                            .map(Duration::from_secs)
                            .unwrap_or(delay);

                        warn!(status_code = 429, retry_after = ?retry_after, url = url, "Rate limited. Waiting before retrying...");
                        sleep(retry_after).await;
                        delay = retry_after;
                    } else {
                        let status_code = response.status().as_u16();
                        let response_text = response.text().await?;
                        error!(
                            status_code = status_code,
                            url = url,
                            response_body = response_text,
                            "HTTP error from snapshot API"
                        );
                        return Err(anyhow::anyhow!(
                            "HTTP error: {}, URL: {}, Response: {}",
                            status_code,
                            url,
                            response_text
                        ));
                    }
                }
                Ok(Err(e)) => {
                    attempt += 1;
                    if attempt > config.max_retries {
                        return Err(anyhow::anyhow!(
                            "Max retries reached for URL: {} after error: {}",
                            url,
                            e
                        ));
                    }
                    warn!(error = %e, retry_delay = ?delay, url = url, "Request error. Retrying...");
                    sleep(delay).await;
                    delay *= 2;
                }
                Err(_timeout_err) => {
                    attempt += 1;
                    if attempt > config.max_retries {
                        return Err(anyhow::anyhow!(
                            "Max retries reached - Timeout for URL: {}",
                            url
                        ));
                    }
                    warn!(retry_delay = ?delay, url = url, "Request timed out. Retrying...");
                    sleep(delay).await;
                    delay *= 2;
                }
            }
        }
    }

    #[instrument(name = "snapshot_api_update_rate_limit_info", skip(rate_limiter))]
    fn update_rate_limit_info(response: &reqwest::Response, rate_limiter: &RateLimiter) {
        if let Some(remaining) = response.headers().get("ratelimit-remaining") {
            if let Ok(remaining) = remaining.to_str().unwrap_or("0").parse::<u32>() {
                rate_limiter
                    .remaining
                    .store(remaining, std::sync::atomic::Ordering::SeqCst);
                debug!(
                    remaining_requests = remaining,
                    "Rate limit remaining updated"
                );
            }
        }

        if let Some(reset) = response.headers().get("ratelimit-reset") {
            if let Ok(reset) = reset.to_str().unwrap_or("0").parse::<u64>() {
                if let Ok(mut reset_time) = rate_limiter.reset.try_lock() {
                    *reset_time = Instant::now() + Duration::from_secs(reset);
                    debug!(reset_seconds = reset, "Rate limit reset time updated");
                }
            }
        }
    }

    #[instrument(name = "snapshot_api_wait_for_rate_limit", skip(rate_limiter))]
    async fn wait_for_rate_limit(rate_limiter: &RateLimiter) {
        const RATE_LIMIT_THRESHOLD: u32 = 30;
        const MIN_WAIT_DURATION: Duration = Duration::from_millis(100);

        loop {
            let remaining = rate_limiter
                .remaining
                .load(std::sync::atomic::Ordering::SeqCst);
            if remaining > RATE_LIMIT_THRESHOLD {
                break;
            }

            let reset_time = *rate_limiter.reset.lock().await;
            let mut wait_time = reset_time.saturating_duration_since(Instant::now());

            if wait_time.is_zero() {
                break;
            }

            info!(
                remaining_requests = remaining,
                reset_in = ?wait_time,
                "Approaching rate limit. Waiting before next request"
            );

            // Add a small buffer to avoid hitting the rate limit immediately after reset
            wait_time = wait_time.saturating_add(MIN_WAIT_DURATION);

            sleep(wait_time).await;
        }
    }
}

#[cfg(test)]
mod snapshot_api_tests {
    use super::*;

    #[tokio::test]
    async fn test_fetch_space() {
        let config = SnapshotApiConfig {
            request_timeout: Duration::from_secs(5), // Shorter timeout for testing
            ..Default::default()
        };
        let handler = SnapshotApiHandler::new(config);

        let query = r#"
            query {
                space(id: "yam.eth") {
                    id
                    name
                    about
                    network
                    symbol
                    members
                }
            }
        "#
        .to_string();

        let result: serde_json::Value = handler
            .fetch("https://hub.snapshot.org/graphql", query)
            .await
            .unwrap();

        assert_eq!(result["data"]["space"]["id"], "yam.eth");
        assert_eq!(result["data"]["space"]["name"], String::from("Yam"));
        assert_eq!(result["data"]["space"]["network"], "1");
        assert_eq!(result["data"]["space"]["symbol"], "YAM");
    }

    #[tokio::test]
    async fn test_fetch_proposal() {
        let config = SnapshotApiConfig {
            request_timeout: Duration::from_secs(5), // Shorter timeout for testing
            ..Default::default()
        };
        let handler = SnapshotApiHandler::new(config);

        let query = r#"
            query {
                proposal(id:"QmWbpCtwdLzxuLKnMW4Vv4MPFd2pdPX71YBKPasfZxqLUS") {
                    id
                    title
                    body
                    choices
                    start
                    end
                    snapshot
                    state
                    author
                    space {
                        id
                        name
                    }
                }
            }
        "#
        .to_string();

        let result: serde_json::Value = handler
            .fetch("https://hub.snapshot.org/graphql", query)
            .await
            .unwrap();

        assert_eq!(
            result["data"]["proposal"]["id"],
            "QmWbpCtwdLzxuLKnMW4Vv4MPFd2pdPX71YBKPasfZxqLUS"
        );
        assert_eq!(
            result["data"]["proposal"]["title"],
            "Select Initial Umbrella Metapool"
        );
        assert_eq!(result["data"]["proposal"]["state"], "closed");
        assert_eq!(result["data"]["proposal"]["space"]["id"], "yam.eth");
    }

    #[tokio::test]
    async fn test_error_handling() {
        let config = SnapshotApiConfig {
            request_timeout: Duration::from_secs(5), // Shorter timeout for testing
            ..Default::default()
        };
        let handler = SnapshotApiHandler::new(config);

        let query = "invalid query".to_string();

        let result = handler
            .fetch::<serde_json::Value>("https://hub.snapshot.org/graphql", query)
            .await;
        assert!(result.is_err(), "Should return an error for invalid query");
    }

    #[tokio::test]
    async fn test_timeout() {
        let config = SnapshotApiConfig {
            request_timeout: Duration::from_millis(10), // Very short timeout for testing
            ..Default::default()
        };
        let handler = SnapshotApiHandler::new(config);

        let query = r#"
            query {
                space(id: "yam.eth") {
                    id
                    name
                    about
                    network
                    symbol
                    members
                }
            }
        "#
        .to_string();

        let result = handler
            .fetch::<serde_json::Value>("https://hub.snapshot.org/graphql", query)
            .await;
        assert!(result.is_err(), "Should return an error due to timeout");
    }
}
