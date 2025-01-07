use anyhow::Result;
use reqwest::Client;
use serde::de::DeserializeOwned;
use std::{
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::{
    sync::{mpsc, oneshot, Semaphore},
    time::sleep,
};
use tracing::{debug, error, info, warn};

use crate::{SNAPSHOT_MAX_CONCURRENT_REQUESTS, SNAPSHOT_MAX_QUEUE, SNAPSHOT_MAX_RETRIES};

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

#[derive(Clone)]
pub struct SnapshotApiConfig {
    pub max_retries: usize,
    pub concurrency: usize,
    pub queue_size: usize,
}

impl Default for SnapshotApiConfig {
    fn default() -> Self {
        Self {
            max_retries: SNAPSHOT_MAX_RETRIES,
            concurrency: SNAPSHOT_MAX_CONCURRENT_REQUESTS,
            queue_size: SNAPSHOT_MAX_QUEUE,
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

        api_handler
    }

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

        debug!("Job added to queue");

        let response = response_receiver.await??;
        Ok(serde_json::from_str(&response)?)
    }

    async fn run_queue(self, mut receiver: mpsc::Receiver<Job>) {
        while let Some(job) = receiver.recv().await {
            let permit = self.semaphore.clone().acquire_owned().await.unwrap();
            let client = self.client.clone();
            let config = self.config.clone();
            let rate_limiter = self.rate_limiter.clone();

            tokio::spawn(async move {
                let result =
                    Self::execute_request(&client, &job.url, &job.query, &config, rate_limiter)
                        .await;
                if let Err(e) = job.response_sender.send(result) {
                    error!("Failed to send response: {:?}", e);
                }
                drop(permit);
            });
        }
    }

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

            match client.get(url)
                .json(&serde_json::json!({"query":query}))
                .header(reqwest::header::USER_AGENT, "proposals.app Detective/1.0 (https://proposals.app; contact@proposals.app) reqwest/0.12")
                .header("Referer", "https://proposals.app")
                .send()
                .await
            {
                Ok(response) => {
                    Self::update_rate_limit_info(&response, &rate_limiter);

                    if response.status().is_success() {
                        return Ok(response.text().await?);
                    } else if response.status().as_u16() == 429 {
                        attempt += 1;
                        if attempt > config.max_retries {
                            return Err(anyhow::anyhow!("Max retries reached"));
                        }

                        let retry_after = response.headers()
                            .get(reqwest::header::RETRY_AFTER)
                            .and_then(|h| h.to_str().ok())
                            .and_then(|s| s.parse::<u64>().ok())
                            .map(Duration::from_secs)
                            .unwrap_or(delay);

                        warn!("Rate limited (429). Waiting for {:?} before retrying...", retry_after);
                        sleep(retry_after).await;
                        delay = retry_after;
                    } else {
                        return Err(anyhow::anyhow!("HTTP error: {}", response.status()));
                    }
                }
                Err(e) => {
                    attempt += 1;
                    if attempt > config.max_retries {
                        return Err(anyhow::anyhow!("Max retries reached"));
                    }
                    warn!("Request error: {}. Retrying in {:?}...", e, delay);
                    sleep(delay).await;
                    delay *= 2;
                }
            }
        }
    }

    fn update_rate_limit_info(response: &reqwest::Response, rate_limiter: &RateLimiter) {
        if let Some(remaining) = response.headers().get("ratelimit-remaining") {
            if let Ok(remaining) = remaining.to_str().unwrap_or("0").parse::<u32>() {
                rate_limiter
                    .remaining
                    .store(remaining, std::sync::atomic::Ordering::SeqCst);
            }
        }

        if let Some(reset) = response.headers().get("ratelimit-reset") {
            if let Ok(reset) = reset.to_str().unwrap_or("0").parse::<u64>() {
                if let Ok(mut reset_time) = rate_limiter.reset.try_lock() {
                    *reset_time = Instant::now() + Duration::from_secs(reset);
                }
            }
        }

        debug!("Rate limit updated");
    }

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
                "Approaching rate limit. Waiting for {:?} before next request",
                wait_time
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
        let config = SnapshotApiConfig::default();
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
        let config = SnapshotApiConfig::default();
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
        let config = SnapshotApiConfig::default();
        let handler = SnapshotApiHandler::new(config);

        let query = "invalid query".to_string();

        let result = handler
            .fetch::<serde_json::Value>("https://hub.snapshot.org/graphql", query)
            .await;
        assert!(result.is_err(), "Should return an error for invalid query");
    }
}
