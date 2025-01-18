use anyhow::{anyhow, Result};
use opentelemetry::{
    metrics::{Counter, Gauge},
    KeyValue,
};
use rand::{seq::SliceRandom, thread_rng};
use reqwest::{
    cookie::Jar,
    header::{HeaderMap, HeaderValue, RETRY_AFTER, USER_AGENT},
    Client, StatusCode,
};
use serde::de::DeserializeOwned;
use std::{
    collections::HashSet,
    sync::{
        atomic::{AtomicI64, Ordering},
        Arc, Mutex,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tokio::{
    sync::{mpsc, oneshot},
    time::sleep,
};
use tracing::{error, info, instrument, warn};
use utils::tracing::get_meter;

const DEFAULT_QUEUE_SIZE: usize = 100_000;
const DEFAULT_MAX_RETRIES: usize = 5;
const DEFAULT_INITIAL_BACKOFF: Duration = Duration::from_secs(2);
const NORMAL_JOBS_BATCH_SIZE: usize = 10;

const USER_AGENTS: [&str; 5] = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
    "Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
];

#[derive(Clone)]
pub struct DiscourseApi {
    client: Client,
    total_queue: Arc<AtomicI64>,
    total_queue_gauge: Gauge<i64>,
    priority_queue: Arc<AtomicI64>,
    priority_queue_gauge: Gauge<i64>,
    normal_queue: Arc<AtomicI64>,
    normal_queue_gauge: Gauge<i64>,
    requests_counter: Counter<u64>,
    max_retries: usize,
    sender: mpsc::Sender<Job>,
    pub base_url: String,
    forbidden_urls: Arc<Mutex<HashSet<(String, u64)>>>,
}

struct Job {
    url: String,
    priority: bool,
    response_sender: oneshot::Sender<Result<String>>,
}

impl DiscourseApi {
    pub fn new(base_url: String, with_user_agent: bool) -> Self {
        Self::new_with_config(
            base_url,
            with_user_agent,
            DEFAULT_QUEUE_SIZE,
            DEFAULT_MAX_RETRIES,
        )
    }

    fn get_random_user_agent() -> &'static str {
        let mut rng = thread_rng();
        USER_AGENTS.choose(&mut rng).unwrap_or(&USER_AGENTS[0])
    }

    fn default_headers_with_cookies(with_user_agent: bool) -> (HeaderMap, Arc<Jar>) {
        let mut headers = HeaderMap::new();
        let cookie_jar = Arc::new(Jar::default());

        if with_user_agent {
            headers.insert(
                USER_AGENT,
                HeaderValue::from_static(Self::get_random_user_agent()),
            );
        } else {
            headers.insert(USER_AGENT, HeaderValue::from_static("proposals.app Discourse Indexer/1.0 (https://proposals.app; contact@proposals.app) reqwest/0.12"));
        }

        headers.insert("Referer", HeaderValue::from_static("https://proposals.app"));
        headers.insert(
            "Accept",
            HeaderValue::from_static(
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            ),
        );
        headers.insert(
            "Accept-Language",
            HeaderValue::from_static("en-US,en;q=0.5"),
        );
        headers.insert("Connection", HeaderValue::from_static("keep-alive"));
        headers.insert("Upgrade-Insecure-Requests", HeaderValue::from_static("1"));

        (headers, cookie_jar)
    }

    pub fn new_with_config(
        base_url: String,
        with_user_agent: bool,
        queue_size: usize,
        max_retries: usize,
    ) -> Self {
        let (headers, cookie_jar) = Self::default_headers_with_cookies(with_user_agent);

        let client = Client::builder()
            .default_headers(headers)
            .cookie_provider(cookie_jar)
            .build()
            .expect("Failed to build HTTP client");

        let (sender, receiver) = mpsc::channel(queue_size);

        let meter = get_meter();

        let total_queue_gauge = meter
            .i64_gauge("discourse_api_total_queue_size")
            .with_description("Total number of jobs in the queue")
            .build();
        let priority_queue_gauge = meter
            .i64_gauge("discourse_api_priority_queue_size")
            .with_description("Number of priority jobs in the queue")
            .build();
        let normal_queue_gauge = meter
            .i64_gauge("discourse_api_normal_queue_size")
            .with_description("Number of normal jobs in the queue")
            .build();
        let requests_counter = meter
            .u64_counter("discourse_api_requests_total")
            .with_description("Total number of requests made")
            .build();

        let api_handler = Self {
            client,
            max_retries,
            sender,
            base_url: base_url.clone(),
            total_queue: Arc::new(AtomicI64::new(0)),
            total_queue_gauge,
            priority_queue: Arc::new(AtomicI64::new(0)),
            priority_queue_gauge,
            normal_queue: Arc::new(AtomicI64::new(0)),
            normal_queue_gauge,
            requests_counter,
            forbidden_urls: Arc::new(Mutex::new(HashSet::new())),
        };

        // Spawn the queue runner
        tokio::spawn(api_handler.clone().run_queue(receiver));

        api_handler
    }

    #[instrument(skip(self), fields(endpoint = %endpoint, priority = priority))]
    pub async fn fetch<T>(&self, endpoint: &str, priority: bool) -> Result<T>
    where
        T: DeserializeOwned,
    {
        let labels = &[KeyValue::new("base_url", self.base_url.clone())];
        self.total_queue.fetch_add(1, Ordering::SeqCst);
        if priority {
            self.priority_queue.fetch_add(1, Ordering::SeqCst);
        } else {
            self.normal_queue.fetch_add(1, Ordering::SeqCst);
        }

        self.total_queue_gauge
            .record(self.total_queue.load(Ordering::SeqCst), labels);
        self.priority_queue_gauge
            .record(self.priority_queue.load(Ordering::SeqCst), labels);
        self.normal_queue_gauge
            .record(self.normal_queue.load(Ordering::SeqCst), labels);

        let (response_sender, response_receiver) = oneshot::channel();
        let url = format!("{}{}", self.base_url, endpoint);
        let job = Job {
            url,
            priority,
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
                error!(error = ?e, url = %job.url, "Priority request failed");
            } else {
                error!(error = ?e, url = %job.url, "Request failed");
            }
        } else {
            info!(url = %job.url, priority = is_priority, "Request processed successfully");
        }
        let _ = job.response_sender.send(result);

        let labels = &[KeyValue::new("base_url", self.base_url.clone())];
        self.total_queue.fetch_sub(1, Ordering::SeqCst);
        if is_priority {
            self.priority_queue.fetch_sub(1, Ordering::SeqCst);
        } else {
            self.normal_queue.fetch_sub(1, Ordering::SeqCst);
        }

        self.total_queue_gauge
            .record(self.total_queue.load(Ordering::SeqCst), labels);
        self.priority_queue_gauge
            .record(self.priority_queue.load(Ordering::SeqCst), labels);
        self.normal_queue_gauge
            .record(self.normal_queue.load(Ordering::SeqCst), labels);

        self.requests_counter.add(1, labels);
    }

    #[instrument(skip(self), fields(url = %url))]
    async fn execute_request(&self, url: &str) -> Result<String> {
        // Check if the URL is in the forbidden cache
        {
            let mut forbidden_urls = self.forbidden_urls.lock().unwrap();
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();

            // Clean up expired entries
            forbidden_urls.retain(|(_, timestamp)| now - *timestamp < 3600);

            if forbidden_urls.iter().any(|(u, _)| u == url) {
                return Err(anyhow!("URL is cached forbidden: {}", url));
            }
        }

        let mut attempt = 0;
        let mut delay = DEFAULT_INITIAL_BACKOFF;

        loop {
            match self.client.get(url).send().await {
                Ok(response) => {
                    let status = response.status();
                    match response.status() {
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
                        StatusCode::FORBIDDEN => {
                            let body = response.text().await.unwrap_or_default();

                            // Add the URL to the forbidden cache
                            let now = SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .unwrap()
                                .as_secs();
                            let mut forbidden_urls = self.forbidden_urls.lock().unwrap();
                            forbidden_urls.insert((url.to_string(), now));

                            error!(url, status = %status, body, "Request failed");
                            return Err(anyhow!("Request failed with status {}: {}", status, body));
                        }
                        status => {
                            let body = response.text().await.unwrap_or_default();
                            error!(url, status = %status, body, "Request failed");
                            return Err(anyhow!("Request failed with status {}: {}", status, body));
                        }
                    }
                }
                Err(e) => {
                    attempt += 1;
                    if attempt > self.max_retries {
                        error!(url, error = ?e, attempt, max_retries = self.max_retries, "Max retries reached");
                        return Err(anyhow!("Max retries reached. Last error: {}", e));
                    }
                    warn!(url, error = ?e, attempt, delay = ?delay, "Request error, retrying");
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
