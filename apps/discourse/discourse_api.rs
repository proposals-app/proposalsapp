use anyhow::{Context, Result, anyhow};
use once_cell::sync::Lazy;
use rand::seq::IndexedRandom;
use regex::Regex;
use reqwest::{
    Client, StatusCode,
    cookie::Jar,
    header::{HeaderMap, HeaderValue, RETRY_AFTER, USER_AGENT},
};
use serde::de::DeserializeOwned;
use std::{
    collections::{HashMap, VecDeque},
    sync::{Arc, Mutex},
    time::{Duration, Instant, SystemTime},
};
use tokio::{
    sync::{mpsc, oneshot},
    time::sleep,
};
use tracing::{Instrument, debug, error, info, instrument, warn};

// --- Constants ---
const DEFAULT_QUEUE_SIZE: usize = 100_000;
const DEFAULT_MAX_RETRIES: usize = 5;
const DEFAULT_INITIAL_BACKOFF: Duration = Duration::from_secs(2);
const MAX_BACKOFF: Duration = Duration::from_secs(60); // Cap backoff to prevent excessive waits
const FORBIDDEN_CACHE_DURATION: Duration = Duration::from_secs(3600); // 1 hour
const NORMAL_JOBS_BATCH_SIZE: usize = 10; // Process normal jobs in batches
const WORKER_YIELD_DURATION: Duration = Duration::from_millis(10); // Small sleep to yield control

const USER_AGENTS: [&str; 5] = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0",
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
];

// Compile regex once using Lazy for efficiency.
static RE_UPLOAD_URL: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"upload:\/\/([a-zA-Z0-9\-_]+)(?:\.([a-zA-Z0-9]+))?")
        .expect("Failed to compile upload URL regex")
});

// --- Structs ---

/// Represents a job to be processed by the API worker.
struct Job {
    url: String, // Full URL to fetch
    priority: bool,
    endpoint_key: String, // Key used for deduplication in pending_requests
    span: tracing::Span,  // Span to link worker processing to the original request
}

/// Tracks requests currently being processed to avoid duplicates.
struct PendingRequest {
    response_senders: Vec<oneshot::Sender<Result<Arc<String>>>>,
    priority: bool, // Tracks if any waiter requested priority
}

/// A rate-limited, retrying, and prioritizing client for interacting with a Discourse API.
#[derive(Clone)]
pub struct DiscourseApi {
    client: Client,
    max_retries: usize,
    sender: mpsc::Sender<Job>,
    pub base_url: String,
    // Cache for URLs that returned 403 Forbidden. Uses SystemTime for expiry.
    forbidden_urls: Arc<Mutex<HashMap<String, SystemTime>>>,
    // Tracks ongoing requests to prevent duplicate fetches for the same endpoint.
    pending_requests: Arc<Mutex<HashMap<String, PendingRequest>>>,
    // Internal queues managed by the worker task.
    priority_queue: Arc<Mutex<VecDeque<Job>>>,
    normal_queue: Arc<Mutex<VecDeque<Job>>>,
}

// --- Implementation ---

impl DiscourseApi {
    /// Creates a new Discourse API client and starts its background worker task.
    #[instrument(skip(base_url, with_user_agent), fields(base_url = %base_url))]
    pub fn new(base_url: String, with_user_agent: bool) -> Self {
        info!("Initializing Discourse API client");
        let (headers, cookie_jar) = Self::default_headers_with_cookies(with_user_agent);

        let client = Client::builder()
            .default_headers(headers)
            .cookie_provider(cookie_jar)
            .timeout(Duration::from_secs(60)) // Add a general request timeout
            .connect_timeout(Duration::from_secs(20)) // Timeout for establishing connection
            .build()
            .expect("Failed to build HTTP client"); // Panic is acceptable during initialization

        // Use a bounded channel to prevent unbounded memory growth if the worker falls behind.
        let (sender, receiver) = mpsc::channel(DEFAULT_QUEUE_SIZE);

        let priority_queue = Arc::new(Mutex::new(VecDeque::with_capacity(DEFAULT_QUEUE_SIZE / 2))); // Smaller capacity hints
        let normal_queue = Arc::new(Mutex::new(VecDeque::with_capacity(DEFAULT_QUEUE_SIZE / 2)));

        let api_handler = Self {
            client,
            max_retries: DEFAULT_MAX_RETRIES,
            sender,
            base_url: base_url.clone(),
            forbidden_urls: Arc::new(Mutex::new(HashMap::new())),
            pending_requests: Arc::new(Mutex::new(HashMap::new())),
            priority_queue: priority_queue.clone(),
            normal_queue: normal_queue.clone(),
        };

        // Spawn the queue runner task.
        tokio::spawn(
            api_handler
                .clone()
                .run_queue(receiver)
                .instrument(tracing::info_span!("discourse_api_worker", base_url = %base_url)),
        );

        info!("Discourse API client initialized and worker task started.");
        api_handler
    }

    /// Selects a random user agent string.
    fn get_random_user_agent() -> &'static str {
        let mut rng = rand::rng();
        USER_AGENTS
            .choose(&mut rng)
            .expect("USER_AGENTS array should not be empty")
    }

    /// Configures default HTTP headers and cookie jar.
    fn default_headers_with_cookies(with_user_agent: bool) -> (HeaderMap, Arc<Jar>) {
        let mut headers = HeaderMap::new();
        let cookie_jar = Arc::new(Jar::default());

        let user_agent = if with_user_agent {
            Self::get_random_user_agent()
        } else {
            // Standard user agent if randomization is disabled.
            "proposals.app Discourse Indexer/1.0 (https://proposals.app; contact@proposals.app) reqwest/0.12"
        };
        headers.insert(USER_AGENT, HeaderValue::from_static(user_agent));

        // Common browser headers to mimic regular traffic.
        headers.insert("Referer", HeaderValue::from_static("https://proposals.app")); // Set a referer
        headers.insert(
            "Accept",
            HeaderValue::from_static("application/json, text/html, */*"), // Prioritize JSON
        );
        headers.insert(
            "Accept-Language",
            HeaderValue::from_static("en-US,en;q=0.9"),
        );
        headers.insert("Connection", HeaderValue::from_static("keep-alive"));
        headers.insert("Upgrade-Insecure-Requests", HeaderValue::from_static("1")); // Common browser header

        (headers, cookie_jar)
    }

    /// Checks if both internal processing queues (priority and normal) are empty.
    /// Primarily used for graceful shutdown or pausing logic.
    #[instrument(skip(self))]
    pub fn are_queues_empty(&self) -> bool {
        let pq_empty = self
            .priority_queue
            .lock()
            .expect("Priority queue lock poisoned")
            .is_empty();
        let nq_empty = self
            .normal_queue
            .lock()
            .expect("Normal queue lock poisoned")
            .is_empty();
        pq_empty && nq_empty
    }

    /// Queues an API request for a given endpoint.
    /// Handles deduplication of identical pending requests.
    /// Returns a future that resolves with the deserialized response or an error.
    #[instrument(skip(self), fields(endpoint = %endpoint, priority = priority))]
    pub async fn queue<T>(&self, endpoint: &str, priority: bool) -> Result<T>
    where
        T: DeserializeOwned + Send + 'static, // Ensure T is Send + 'static for async blocks
    {
        let (response_sender, response_receiver) = oneshot::channel();
        let url = format!("{}{}", self.base_url, endpoint);
        // Use endpoint itself as the key for deduplication.
        let endpoint_key = endpoint.to_string();

        // Check for pending requests and decide whether to send a new job.
        let should_send_new_request = {
            let mut pending = self
                .pending_requests
                .lock()
                .expect("Pending requests lock poisoned"); // Use expect for poisoned mutexes

            if let Some(pending_request) = pending.get_mut(&endpoint_key) {
                debug!(endpoint, "Request already pending, adding receiver.");
                // If a new request is priority, upgrade the pending request's status.
                if priority && !pending_request.priority {
                    pending_request.priority = true;
                    // Note: This doesn't re-prioritize an already *sent* job in the worker queue.
                    // It mainly affects subsequent identical queue calls before the first finishes.
                    debug!(endpoint, "Upgraded pending request to priority.");
                }
                pending_request.response_senders.push(response_sender);
                false // Don't send a new job to the worker.
            } else {
                debug!(endpoint, "No pending request found, creating new entry.");
                pending.insert(
                    endpoint_key.clone(),
                    PendingRequest {
                        response_senders: vec![response_sender],
                        priority,
                    },
                );
                true // Send a new job to the worker.
            }
        };

        if should_send_new_request {
            let job = Job {
                url, // Full URL
                priority,
                endpoint_key: endpoint_key.clone(), // Pass the key
                span: tracing::Span::current(),     // Capture current span
            };

            debug!(endpoint = %job.endpoint_key, priority = job.priority, "Sending job to worker channel");
            // Send the job to the worker task via the mpsc channel.
            if let Err(e) = self.sender.send(job).await {
                // If sending fails, immediately remove the pending request entry to allow retries.
                error!(endpoint = %endpoint_key, error = %e, "Failed to send job to worker channel. Removing pending request.");
                self.pending_requests
                    .lock()
                    .expect("Pending requests lock poisoned")
                    .remove(&endpoint_key);
                // Propagate the error back to the caller.
                return Err(anyhow!("Failed to send job to worker channel: {}", e));
            }
        } else {
            debug!(endpoint, "Skipped sending duplicate job to worker channel.");
        }

        // Await the response from the worker task.
        let response_result = response_receiver
            .await
            .context("Response channel closed unexpectedly. Worker task might have panicked.")?;

        // Handle potential errors returned from the worker (e.g., network errors, parsing errors).
        let shared_response = response_result.with_context(|| {
            format!(
                "Worker task failed processing request for endpoint: {endpoint}"
            )
        })?;

        // Deserialize the successful JSON response.
        serde_json::from_str::<T>(&shared_response).with_context(|| {
            format!(
                "Failed to parse JSON response for endpoint: {} | Response: {:.100}",
                endpoint,
                shared_response.as_ref()
            )
        })
    }

    /// The main loop for the background worker task. Receives jobs and processes them.
    async fn run_queue(self, mut receiver: mpsc::Receiver<Job>) {
        info!("Starting Discourse API queue runner worker.");
        loop {
            tokio::select! {
                Some(job) = receiver.recv() => {
                    // Create logging info before moving job
                    let url_log = job.url.clone();
                    let endpoint_key_log = job.endpoint_key.clone();
                    let job_priority = job.priority;
                    let span = job.span.clone(); // Clone the span

                    // Enter span for proper tracing context
                    let _enter = span.enter();
                    debug!(url = %url_log, priority = job_priority, endpoint_key = %endpoint_key_log, "Received job, adding to internal queue.");

                    // Add job to appropriate queue
                    if job_priority {
                        let mut pq = self.priority_queue.lock().expect("Priority queue lock poisoned");
                        pq.push_back(job); // Now safe to move job
                        drop(pq); // Release lock promptly
                    } else {
                        let mut nq = self.normal_queue.lock().expect("Normal queue lock poisoned");
                        nq.push_back(job); // Now safe to move job
                        drop(nq); // Release lock promptly
                    }

                    // Process queued jobs after receiving a new one
                    self.process_queued_jobs().await;
                },
                else => {
                    info!("Job channel closed. Starting shutdown sequence.");
                    while !self.are_queues_empty() {
                        warn!("Processing remaining jobs during shutdown...");
                        self.process_queued_jobs().await;
                        sleep(WORKER_YIELD_DURATION).await;
                    }
                    info!("All queues processed. Shutting down queue runner worker.");
                    break;
                }
            }
            sleep(WORKER_YIELD_DURATION).await;
        }
        info!("Discourse API queue runner worker finished.");
    }

    /// Processes jobs from the internal priority and normal queues.
    #[instrument(skip(self), name = "process_queued_jobs")]
    async fn process_queued_jobs(&self) {
        let mut processed_count = 0;

        // --- Process Priority Queue ---
        loop {
            let job_opt = {
                let mut pq = self
                    .priority_queue
                    .lock()
                    .expect("Priority queue lock poisoned");
                pq.pop_front()
            };

            if let Some(job) = job_opt {
                // Clone needed values for logging before moving job
                let url_log = job.url.clone();
                let endpoint_key_log = job.endpoint_key.clone();
                let span = job.span.clone();

                // Enter the job's span before processing
                let _enter = span.enter();
                debug!(url = %url_log, endpoint_key = %endpoint_key_log, "Processing priority job");

                self.process_job(job, true).await;
                processed_count += 1;
            } else {
                break;
            }
        }

        // --- Process Normal Queue ---
        for _ in 0..NORMAL_JOBS_BATCH_SIZE {
            let job_opt = {
                let mut nq = self
                    .normal_queue
                    .lock()
                    .expect("Normal queue lock poisoned");
                nq.pop_front()
            };

            if let Some(job) = job_opt {
                // Clone needed values for logging before moving job
                let url_log = job.url.clone();
                let endpoint_key_log = job.endpoint_key.clone();
                let span = job.span.clone();

                // Enter the job's span before processing
                let _enter = span.enter();
                debug!(url = %url_log, endpoint_key = %endpoint_key_log, "Processing normal job");

                self.process_job(job, false).await;
                processed_count += 1;
            } else {
                break;
            }
        }

        if processed_count > 0 {
            debug!("Processed {} jobs in this cycle", processed_count);
        }
    }

    /// Executes a single job: performs the HTTP request and broadcasts the result.
    #[instrument(
        skip(self, job),
        fields(url = %job.url, priority = is_priority, endpoint_key = %job.endpoint_key),
        name = "process_job" // Explicit span name
    )]
    async fn process_job(&self, job: Job, is_priority: bool) {
        let start_time = Instant::now();

        let endpoint_key_clone = job.endpoint_key.clone(); // Clone for metrics

        info!(url = %job.url, "Executing request");
        // Execute the actual HTTP request with retries/backoff.
        let result: Result<String> = self.execute_request(&job.url).await;
        let request_duration = start_time.elapsed();

        debug!(url = %job.url, ?request_duration, "Request execution finished.");

        // --- Broadcast Result ---
        // Retrieve all waiting senders and remove the pending request entry *atomically*.
        let senders = {
            let mut pending = self
                .pending_requests
                .lock()
                .expect("Pending requests lock poisoned");
            // Remove the entry using the endpoint_key from the job.
            pending
                .remove(&job.endpoint_key)
                .map(|p| p.response_senders) // Get the senders if entry existed
                .unwrap_or_else(|| {
                    // Handle case where entry might already be removed (e.g., send error)
                    warn!(endpoint_key = %job.endpoint_key, "Pending request entry was already removed before broadcasting result.");
                    Vec::new() // Return empty vec, nothing to broadcast
                })
        };

        let receiver_count = senders.len();
        if receiver_count > 0 {
            debug!(url = %job.url, receiver_count, "Broadcasting result to waiters.");
            match result {
                Ok(response_text) => {
                    let shared_response = Arc::new(response_text); // Share successful response
                    for sender in senders {
                        // Ignore error if receiver was dropped (client timed out/cancelled).
                        let _ = sender.send(Ok(shared_response.clone()));
                    }
                }
                Err(e) => {
                    // Log the final error that prevented a successful response.
                    error!(url = %job.url, error = ?e, "Request ultimately failed, notifying waiters with error.");
                    // Send owned error to each waiter.
                    // We need to capture the error before the loop as `e` is moved into the first `context` call.
                    let error_message = format!(
                        "Discourse API request failed for {endpoint_key_clone}: {e:?}"
                    );
                    for sender in senders {
                        // Create a fresh anyhow::Error for each sender with the captured message.
                        let err_to_send = anyhow!(error_message.clone());
                        let _ = sender.send(Err(err_to_send));
                    }
                }
            }
        } else {
            debug!(url = %job.url, "No waiters found for this request result.");
        }

        // Record overall job processing time (includes request execution + broadcasting logic).
        let total_job_duration = start_time.elapsed();

        info!(url = %job.url, ?total_job_duration, "Finished processing job.");
    }

    /// Executes the HTTP GET request with retry logic and forbidden URL caching.
    #[instrument(skip(self), fields(url = %url))]
    async fn execute_request(&self, url: &str) -> Result<String> {
        // --- Forbidden URL Check ---
        {
            // Scope for the lock guard
            let mut forbidden_urls = self
                .forbidden_urls
                .lock()
                .expect("Forbidden URLs lock poisoned");
            let now = SystemTime::now();

            // Clean up expired entries before checking.
            forbidden_urls.retain(|_url, timestamp| {
                now.duration_since(*timestamp)
                    .is_ok_and(|age| age < FORBIDDEN_CACHE_DURATION)
            });

            // Check if URL is still forbidden after cleanup.
            if forbidden_urls.contains_key(url) {
                warn!(url, "Request blocked by forbidden cache.");

                return Err(anyhow!("URL is cached as forbidden: {}", url));
            }
        } // Lock released here

        // --- Retry Loop ---
        let mut attempt = 0;
        let mut delay = DEFAULT_INITIAL_BACKOFF;

        loop {
            attempt += 1;
            let request_start = Instant::now(); // Use Instant for duration measurement
            debug!(url, attempt, "Sending HTTP GET request attempt.");

            // Clone client for the request (reqwest::Client is Arc-based internally)
            let request = self.client.get(url).build()?; // Build request first

            match self.client.execute(request).await {
                Ok(response) => {
                    let status = response.status();
                    let response_time = request_start.elapsed();
                    debug!(url, attempt, %status, ?response_time, "Received response.");

                    // --- Handle Status Codes ---
                    match status {
                        StatusCode::OK => {
                            info!(url, attempt, ?response_time, "Request successful (200 OK)");
                            // Read body text - potential point of failure
                            return response.text().await.with_context(|| {
                                format!("Failed to read response body text for {url}")
                            });
                        }
                        StatusCode::TOO_MANY_REQUESTS => {
                            if attempt > self.max_retries {
                                error!(
                                    url,
                                    attempt,
                                    max_retries = self.max_retries,
                                    "Max retries reached after 429 Too Many Requests"
                                );
                                return Err(anyhow!(
                                    "Max retries ({}) reached for {}: Last error HTTP 429",
                                    self.max_retries,
                                    url
                                ));
                            }
                            // Calculate delay respecting Retry-After header, apply exponential backoff.
                            let retry_after = Self::get_retry_after(&response, delay);
                            delay = (delay * 2).min(MAX_BACKOFF).max(retry_after); // Exponential backoff with ceiling and floor
                            warn!(url, attempt, ?retry_after, effective_delay = ?delay, "Rate limited (429), retrying...");

                            sleep(delay).await; // Wait before retrying
                        }
                        s if s.is_server_error() => {
                            // 5xx errors
                            if attempt > self.max_retries {
                                error!(url, status = %s, attempt, max_retries = self.max_retries, "Max retries reached after server error");
                                return Err(anyhow!(
                                    "Max retries ({}) reached for {}: Last error HTTP {}",
                                    self.max_retries,
                                    url,
                                    s
                                ));
                            }
                            warn!(url, status = %s, attempt, ?delay, "Server error, retrying...");

                            sleep(delay).await;
                            delay = (delay * 2).min(MAX_BACKOFF); // Exponential backoff with ceiling
                        }
                        StatusCode::FORBIDDEN => {
                            // 403 Forbidden
                            let body_preview = match response.text().await {
                                Ok(text) => text.chars().take(100).collect::<String>(),
                                Err(_) => "[failed to read body]".to_string(),
                            };
                            error!(url, status = %status, body_preview, "Request forbidden (403), caching URL and failing permanently.");

                            // Add to forbidden cache
                            {
                                // Scope for lock guard
                                let mut forbidden_urls = self
                                    .forbidden_urls
                                    .lock()
                                    .expect("Forbidden URLs lock poisoned");
                                forbidden_urls.insert(url.to_string(), SystemTime::now());
                                debug!(url, "Added URL to forbidden cache.");
                            } // Lock released

                            return Err(anyhow!(
                                "Request failed with status {}: {}",
                                status,
                                body_preview
                            ));
                        }
                        s if s.is_client_error() => {
                            // Other 4xx errors (e.g., 404 Not Found)
                            let body_preview = match response.text().await {
                                Ok(text) => text.chars().take(100).collect::<String>(),
                                Err(_) => "[failed to read body]".to_string(),
                            };
                            error!(url, status = %s, body_preview, "Client error, failing permanently.");
                            return Err(anyhow!(
                                "Client error for {}: HTTP {}: {}",
                                url,
                                s,
                                body_preview
                            ));
                        }
                        // Handle unexpected non-success statuses
                        s => {
                            let body_preview = match response.text().await {
                                Ok(text) => text.chars().take(100).collect::<String>(),
                                Err(_) => "[failed to read body]".to_string(),
                            };
                            error!(url, status = %s, body_preview, "Unexpected status, failing permanently.");
                            return Err(anyhow!(
                                "Request failed for {}: Unexpected status {}: {}",
                                url,
                                s,
                                body_preview
                            ));
                        }
                    }
                }
                // Handle network or reqwest-level errors
                Err(e) => {
                    let error_string = e.to_string();
                    if attempt > self.max_retries {
                        error!(url, error = %error_string, attempt, max_retries = self.max_retries, "Max retries reached after request error.");
                        return Err(anyhow!(
                            "Max retries ({}) reached for {}. Last error: {}",
                            self.max_retries,
                            url,
                            e
                        ))
                        .context("Request failed after multiple retries");
                    }
                    warn!(url, error = %error_string, attempt, ?delay, "Request error, retrying...");

                    sleep(delay).await;
                    delay = (delay * 2).min(MAX_BACKOFF); // Exponential backoff with ceiling
                }
            }
        } // End retry loop
    }

    /// Parses the Retry-After header, returning a Duration.
    /// Handles second-based values. Assumes HTTP-date format is less common here.
    fn get_retry_after(response: &reqwest::Response, default: Duration) -> Duration {
        response
            .headers()
            .get(RETRY_AFTER)
            .and_then(|h| h.to_str().ok())
            .and_then(|s| s.parse::<u64>().ok()) // Attempt to parse as seconds
            .map(Duration::from_secs)
            .unwrap_or(default) // Fallback to default backoff
    }
}

/// Replaces Discourse `upload://` URLs with full HTTP URLs based on the API's base URL.
// This function doesn't need to be async anymore.
#[instrument(skip(discourse_api, raw_content))] // Skip raw_content to avoid large logs
pub fn process_upload_urls(raw_content: &str, discourse_api: Arc<DiscourseApi>) -> String {
    // Return String directly
    // Use the statically compiled regex for performance.
    let replaced_content = RE_UPLOAD_URL.replace_all(raw_content, |caps: &regex::Captures| {
        let base_url = &discourse_api.base_url;
        // Capture group 1: file identifier (guaranteed to exist by regex structure)
        let file_id = &caps[1];
        match caps.get(2) {
            // Capture group 2: optional extension
            Some(ext) => format!(
                "{}/uploads/short-url/{}.{}",
                base_url.trim_end_matches('/'), // Ensure no double slash
                file_id,
                ext.as_str()
            ),
            None => format!(
                "{}/uploads/short-url/{}",
                base_url.trim_end_matches('/'),
                file_id
            ),
        }
    });
    replaced_content.into_owned() // Convert Cow<str> to String
}

// --- Tests ---
#[cfg(test)]
mod tests {
    use super::*; // Import items from parent module
    // use std::time::Duration; // Removed unused Duration

    // Helper to create a simple API instance for tests that don't need a real server.
    fn create_test_api() -> Arc<DiscourseApi> {
        Arc::new(DiscourseApi::new(
            "https://test.forum.local".to_string(),
            false,
        ))
    }

    #[tokio::test]
    async fn test_process_upload_urls_basic() {
        let api = create_test_api();
        let raw = "Some text with upload://file123.png and upload://anotherfile without extension.";
        let expected = "Some text with https://test.forum.local/uploads/short-url/file123.png and https://test.forum.local/uploads/short-url/anotherfile without extension.";
        let processed = process_upload_urls(raw, api); // No await needed
        assert_eq!(processed, expected);
    }

    #[tokio::test]
    async fn test_process_upload_urls_trailing_slash() {
        let api = Arc::new(DiscourseApi::new(
            "https://test.forum.local/".to_string(),
            false,
        ));
        let raw = "Text upload://file.jpg";
        let expected = "Text https://test.forum.local/uploads/short-url/file.jpg"; // No double slash
        let processed = process_upload_urls(raw, api); // No await needed
        assert_eq!(processed, expected);
    }

    // --- Keep Existing Tests ---

    #[tokio::test]
    async fn test_process_post_raw_content() {
        // Use a real-looking URL even if the test doesn't hit the network for this function
        let discourse_api = Arc::new(DiscourseApi::new(
            "https://forum.arbitrum.foundation".to_string(),
            true,
        ));

        let raw_content = r#"Yes, both Arbitrum DAO governors count the **Abstain** vote choice towards quorum.

And for example, in the OpCo onchain vote, if **Abstain** wouldn't count towards quorum the proposal would have just very very barely passed, with **122.4M ARB** voting **For** and the 3% Quorum threshold being **121.8M ARB**.

![soon on arbitrum.proposals.app|690x234](upload://dL6cgekakAbqqmWl7b2EWSlhidB.png)
"#;

        // Process the raw content
        let processed_content = process_upload_urls(raw_content, discourse_api); // No await needed

        assert_eq!(
            processed_content,
            r#"Yes, both Arbitrum DAO governors count the **Abstain** vote choice towards quorum.

And for example, in the OpCo onchain vote, if **Abstain** wouldn't count towards quorum the proposal would have just very very barely passed, with **122.4M ARB** voting **For** and the 3% Quorum threshold being **121.8M ARB**.

![soon on arbitrum.proposals.app|690x234](https://forum.arbitrum.foundation/uploads/short-url/dL6cgekakAbqqmWl7b2EWSlhidB.png)
"#
        );
    }

    #[tokio::test]
    async fn test_process_post_raw_content_revision() {
        let discourse_api = Arc::new(DiscourseApi::new(
            "https://forum.arbitrum.foundation".to_string(),
            true,
        ));

        let raw_content = r#"## Constitutional / Non-Constitutional

Constitutional

## Abstract

We propose to unlock ARB utility and improve the governance and security of the Arbitrum protocol by implementing ARB staking, without yet turning on fee distribution to token holders. Through ARB staking, token holders who delegate to active governance participants will be able to capture value. The proposal will also implement a liquid staked ARB token (stARB) via the Tally Protocol that enables any future rewards to auto-compound, is (re)stakeable, and is compatible with DeFi. Separately, we will work with the Arbitrum DAO to decide whether and how to fund rewards and split rewards between token holders and delegates.

## Motivation

The ARB token is struggling to accrue value.

* Governance power is the only source of fundamental demand for ARB, while there are multiple sources of new supply (unlocks, treasury spending).
* The ability to restake ARB or use it on DeFi is not compatible with governance. Voting power breaks when ARB is deposited into smart contracts. [Less than 1%](https://dune.com/queries/3732998/6278607) of ARB tokens are used actively in the onchain ecosystem.

![|446x317](upload://tamq2f2DwVq4Vns9mZ2HPtEvQO4.png)

The ARB token is struggling as a governance mechanism

* Only about 10% of the circulating supply of ARB is [actively used](https://www.tally.xyz/gov/arbitrum/delegates) in governance
* Voter participation in the DAO has been [steadily declining](https://dune.com/queries/3829223/6440489) since DAO launch

![|441x350](upload://1PNLGkw1QuYw4Qh3IZwZ8mjyGgK.png)

Meanwhile, the Arbitrum DAO treasury has accumulated over [16 Million $ETH](https://www.tally.xyz/gov/arbitrum/treasury) in surplus fees from Arbitrum One and Nova. As a result, it is becoming economically attractive for a malicious actor to launch a governance attack on the DAO treasury. The potential profit of attacking the DAO treasury is increasing as more ETH accumulates in the treasury, while the cost of attacking the DAO through purchasing ARB for its voting power is not increasing proportionally to defend against attacks. A more developed version of this dynamic exists in the ENS and Compound DAOs, both of which are actively fighting off governance attacks (ENS documented [here](https://discuss.ens.domains/t/temp-check-enable-cancel-role-on-the-dao/19090/10)).

ARB Staking unlocks utility and aligns governance by creating a mechanism to stream future rewards from DAO-generated sources like sequencer fees, MEV fees, validator fees, token inflation, and treasury diversification to token holders who are delegated to an active governance participant. ARB Staking makes ARB usable in restaking and DeFi by returning voting power locked in contracts to the DAO.

## Rationale

This proposal contributes to Arbitrum [Community Values](https://docs.arbitrum.foundation/dao-constitution#section-6-community-values) by making the Arbitrum DAO more sustainable and secure.

## Specifications and Steps to Implement

### System architecture

ARB Staking enables ARB utility while allowing the DAO to retain governance power. It includes a few modular components that come together to power the system.

Governance Staking

* Requires that tokens are delegated to an active delegate in order to be eligible to receive rewards (see Karma Integration)
* Accepts arbitrary fee sources as rewards
* Is based on Uniswaps audited [UniStaker](https://github.com/uniswapfoundation/UniStaker). Each pool of staked tokens are held in their own special purpose smart contract which can only delegate its own voting power. The governance contract is simple, permissionless, audited and has no special authorities. The contract is upgradable only via Constitutional Proposal by the Arbitrum DAO.
* Each user owns their own staking vault, and is free to use Governance Staking regardless of whether or not they use stARB (see Tally Protocol LST section below). This allows for maximum flexibility for the DAO and lets others also build yield generating infrastructure for the ARB token.

![image|401x500](upload://xtLYBucs08yayq7BgfqSGTvtUjM.png)

The DAO
* Has the power to turn on fee distribution and send fees to ARB Staking
* Controls how voting power is distributed to delegates, including delegation strategies for unused voting power

stARB (Tally Protocol LST)

* Creates a *receipt token* for the ARB which is staked through it, called stARB, and it returns it to the user. The underlying tokens that are staked on the users behalf are always available to redeem, 1:1 plus rewards if applicable, at any time.
* Auto-compounds potential rewards if they are turned on in the future
* Provides token holders a liquid position
* Administers its own Governance Staking vault, not any other vault. stARB has no special powers over the staking contract, and has no access to user&#39;s tokens other than the tokens it manages itself.
* Will be deployed as an immutable, non-upgradeable contract. The delegation strategies part of the system will upgradeable via Arbitrum DAO Constitutional Proposal. The only part of the system Tally manages is the rebalancing of underlying assets.
* Can have a withdrawal period, which is configurable by the DAO. The expectation is that any withdrawal period will be very short and is there only to prevent people from abusing the reward mechanism (i.e. staking right before a reward, claiming a chunk of it, and immediately unstaking). If there is a price difference, arbitrageurs can instantly unstake stARB and sell it as ARB to close the price difference. This easy arbitrage opportunity minimizes price discrepancies and makes it difficult for any potential governance attacker to acquire ARB at a discount.
* Allows stARB holders to continue delegating directly to their preferred delegate.
* Has the ability to return voting power to the DAO if stARB is deposited into restaking, DeFi, or centralized exchange smart contracts that do not maintain a 1:1 delegation relationship by implementing a [Flexible Voting](https://github.com/ScopeLift/flexible-voting) client. The Arbitrum DAO exclusively has the ability to determine how this voting power is distributed/redelegated via a governance proposal. The DAO will decide how to set up the initial redelegation logic for stARB.

![image|527x500](upload://agIc8rArg7v5BAPz3iVfM397fS2.png)

### Karma integration

Governance Staking requires that tokens are delegated to an active delegate in order to be eligible to receive rewards. We will define an &quot;active delegate&quot; using Karma Score. The implementation of Karma for ARB Staking is designed to be modular. If, in the future, the DAO wishes to add additional or alternative providers to define &quot;active delegate&quot;, it can do so. The DAO will define the Karma Score requirement for being considered an active delegate. Karma Score is a combination of delegate’s Snapshot voting stats, onchain voting stats and their forum activity. To accurately calculate forum activity score, delegates are required to prove ownership of their forum handle by [signing a message](https://www.karmahq.xyz/dao/link/forum?dao=arbitrum) with their delegate address and posting on the forum. The current Karma score formula is below, which can be adjusted by the DAO going forward:

((100) * ((Forum Activity Score * 1) + (Off-chain Votes % * 3) + (On-chain Votes % * 5))) / (Sum of Weights times Max Score Setting * 1)

Karma Score will be included in ARB staking via a smart contract that writes data onchain from the Karma API. We will include several guardrails to ensure that this aspect of the implementation is robust and decentralized:

* Users can verify Karma score calculations independently.
* The DAO will have the ability to block Karma Scores if it believes they are being calculated incorrectly.
* If Karma scores fail to arrive or the scores are blocked by the DAO, ARB Staking will distribute rewards to all stakers regardless of whether they are delegated to an active governance participant until the situation is resolved.

In the future, we believe it would make sense to integrate delegate incentives with ARB staking so that, instead of getting delegate incentive funds from the ARB treasury, they come directly from onchain revenue. We will lead a working group to develop a recommendation on this topic.

Tally will build ARB staking into our existing [Arbitrum DAO platform](https://www.tally.xyz/gov/arbitrum), so that users can easily stake and delegate in one place.

### Parallel workstreams: Staking Rewards and Delegation working groups

In parallel with the development of ARB Staking, we will lead two separate DAO working groups that are focused on aspects of the system that will be implemented after development is complete.

* The Staking Rewards working group will focus on how to fund staking rewards. It will develop a recommendation about whether staking rewards should be funded by sequencer fees, MEV fees, validator fees, token inflation, treasury diversification, and/or DAO venture investments and how to implement such rewards.
* The ARB Staking &amp; Delegation working group will focus on how to define an active contributor to the Arbitrum DAO, delegate incentives, and voting power distribution. It will collaborate with Tally and Karma to develop recommendations on Karma Score formula, the minimum Karma Score required to be eligible for staking.

The working groups will be formed via an open call for contributors that will be posted after this proposal passes the temp check stage. Each working group will deliver their recommendations in October, so that the recommendations can be turned into DAO proposals and created following the implementation of ARB Staking.

### Integration with future Arbitrum staking systems

We anticipate that multiple Arbitrum staking systems will be developed over time, perhaps to incentivize decentralized block production in BoLD or to create an efficient MEV market in Time Boost. We view multiple staking systems as complementary. Each system would ask the staker to do different work for Arbitrum, take different risks, and pay out different rewards. Having multiple systems lets ARB holders pick between different risk/reward payoffs and specialize in different types of work to secure the system.

## Estimated Timeline

Post proposal on forum for feedback: June

Post temp check proposal on Snapshot: August

Post onchain proposal on Tally for funding: August

Begin development: August

Submit smart contracts for audit: September

Submit onchain proposal on Tally including full ARB Staking implementation: October

Publish working group recommendations and turn them into DAO proposals: November

## Overall Cost

If this proposal passes temperature check, we will submit an onchain proposal that includes $200,000 USD in ARB of funding to cover the costs of development, including the following funding categories:

* $50,000 USD in ARB: Develop ARB Staking smart contracts
  * Implement staking contracts
  * Integrate Arbitrum’s current and potential fee mechanisms
  * Integrate Karma Score requirement
  * Enable the DAO to block Karma Scores if it believes they are being calculated incorrectly
* $20,000 USD in ARB: Integrate ARB Staking into Tally.xyz
* $50,000 USD in ARB: Integrate Karma into ARB Staking
  * Develop and deploy a smart contract to store key stats and Karma scores onchain
  * Create a system to record stats onchain and store detailed delegate data off-chain (using Arweave or IPFS) for easy verification
  * Continuously improve scoring algorithms to adapt to evolving Arbitrum community needs
  * Provide technical support to delegates experiencing issues with their statistics
* $60,000 USD in ARB: Audit ARB Staking smart contracts
  * The final cost of the audit including documentation will be published on this thread. Any leftover funds from the $100,000 budget will be returned to the DAO.
* $20,000 USD in ARB: Fund Staking Rewards and ARB Staking &amp; Delegation working groups

Separately, we will submit an onchain proposal with the full ARB Staking implementation at the conclusion of the development process.

### Disclaimer

This proposal should not be relied on as legal, tax, or investment advice. Any projections included here are based on our best estimates and presented for informational purposes only."#;

        // Process the raw content
        let processed_content = process_upload_urls(raw_content, discourse_api); // No await needed

        let expected_content = r#"## Constitutional / Non-Constitutional

Constitutional

## Abstract

We propose to unlock ARB utility and improve the governance and security of the Arbitrum protocol by implementing ARB staking, without yet turning on fee distribution to token holders. Through ARB staking, token holders who delegate to active governance participants will be able to capture value. The proposal will also implement a liquid staked ARB token (stARB) via the Tally Protocol that enables any future rewards to auto-compound, is (re)stakeable, and is compatible with DeFi. Separately, we will work with the Arbitrum DAO to decide whether and how to fund rewards and split rewards between token holders and delegates.

## Motivation

The ARB token is struggling to accrue value.

* Governance power is the only source of fundamental demand for ARB, while there are multiple sources of new supply (unlocks, treasury spending).
* The ability to restake ARB or use it on DeFi is not compatible with governance. Voting power breaks when ARB is deposited into smart contracts. [Less than 1%](https://dune.com/queries/3732998/6278607) of ARB tokens are used actively in the onchain ecosystem.

![|446x317](https://forum.arbitrum.foundation/uploads/short-url/tamq2f2DwVq4Vns9mZ2HPtEvQO4.png)

The ARB token is struggling as a governance mechanism

* Only about 10% of the circulating supply of ARB is [actively used](https://www.tally.xyz/gov/arbitrum/delegates) in governance
* Voter participation in the DAO has been [steadily declining](https://dune.com/queries/3829223/6440489) since DAO launch

![|441x350](https://forum.arbitrum.foundation/uploads/short-url/1PNLGkw1QuYw4Qh3IZwZ8mjyGgK.png)

Meanwhile, the Arbitrum DAO treasury has accumulated over [16 Million $ETH](https://www.tally.xyz/gov/arbitrum/treasury) in surplus fees from Arbitrum One and Nova. As a result, it is becoming economically attractive for a malicious actor to launch a governance attack on the DAO treasury. The potential profit of attacking the DAO treasury is increasing as more ETH accumulates in the treasury, while the cost of attacking the DAO through purchasing ARB for its voting power is not increasing proportionally to defend against attacks. A more developed version of this dynamic exists in the ENS and Compound DAOs, both of which are actively fighting off governance attacks (ENS documented [here](https://discuss.ens.domains/t/temp-check-enable-cancel-role-on-the-dao/19090/10)).

ARB Staking unlocks utility and aligns governance by creating a mechanism to stream future rewards from DAO-generated sources like sequencer fees, MEV fees, validator fees, token inflation, and treasury diversification to token holders who are delegated to an active governance participant. ARB Staking makes ARB usable in restaking and DeFi by returning voting power locked in contracts to the DAO.

## Rationale

This proposal contributes to Arbitrum [Community Values](https://docs.arbitrum.foundation/dao-constitution#section-6-community-values) by making the Arbitrum DAO more sustainable and secure.

## Specifications and Steps to Implement

### System architecture

ARB Staking enables ARB utility while allowing the DAO to retain governance power. It includes a few modular components that come together to power the system.

Governance Staking

* Requires that tokens are delegated to an active delegate in order to be eligible to receive rewards (see Karma Integration)
* Accepts arbitrary fee sources as rewards
* Is based on Uniswaps audited [UniStaker](https://github.com/uniswapfoundation/UniStaker). Each pool of staked tokens are held in their own special purpose smart contract which can only delegate its own voting power. The governance contract is simple, permissionless, audited and has no special authorities. The contract is upgradable only via Constitutional Proposal by the Arbitrum DAO.
* Each user owns their own staking vault, and is free to use Governance Staking regardless of whether or not they use stARB (see Tally Protocol LST section below). This allows for maximum flexibility for the DAO and lets others also build yield generating infrastructure for the ARB token.

![image|401x500](https://forum.arbitrum.foundation/uploads/short-url/xtLYBucs08yayq7BgfqSGTvtUjM.png)

The DAO
* Has the power to turn on fee distribution and send fees to ARB Staking
* Controls how voting power is distributed to delegates, including delegation strategies for unused voting power

stARB (Tally Protocol LST)

* Creates a *receipt token* for the ARB which is staked through it, called stARB, and it returns it to the user. The underlying tokens that are staked on the users behalf are always available to redeem, 1:1 plus rewards if applicable, at any time.
* Auto-compounds potential rewards if they are turned on in the future
* Provides token holders a liquid position
* Administers its own Governance Staking vault, not any other vault. stARB has no special powers over the staking contract, and has no access to user&#39;s tokens other than the tokens it manages itself.
* Will be deployed as an immutable, non-upgradeable contract. The delegation strategies part of the system will upgradeable via Arbitrum DAO Constitutional Proposal. The only part of the system Tally manages is the rebalancing of underlying assets.
* Can have a withdrawal period, which is configurable by the DAO. The expectation is that any withdrawal period will be very short and is there only to prevent people from abusing the reward mechanism (i.e. staking right before a reward, claiming a chunk of it, and immediately unstaking). If there is a price difference, arbitrageurs can instantly unstake stARB and sell it as ARB to close the price difference. This easy arbitrage opportunity minimizes price discrepancies and makes it difficult for any potential governance attacker to acquire ARB at a discount.
* Allows stARB holders to continue delegating directly to their preferred delegate.
* Has the ability to return voting power to the DAO if stARB is deposited into restaking, DeFi, or centralized exchange smart contracts that do not maintain a 1:1 delegation relationship by implementing a [Flexible Voting](https://github.com/ScopeLift/flexible-voting) client. The Arbitrum DAO exclusively has the ability to determine how this voting power is distributed/redelegated via a governance proposal. The DAO will decide how to set up the initial redelegation logic for stARB.

![image|527x500](https://forum.arbitrum.foundation/uploads/short-url/agIc8rArg7v5BAPz3iVfM397fS2.png)

### Karma integration

Governance Staking requires that tokens are delegated to an active delegate in order to be eligible to receive rewards. We will define an &quot;active delegate&quot; using Karma Score. The implementation of Karma for ARB Staking is designed to be modular. If, in the future, the DAO wishes to add additional or alternative providers to define &quot;active delegate&quot;, it can do so. The DAO will define the Karma Score requirement for being considered an active delegate. Karma Score is a combination of delegate’s Snapshot voting stats, onchain voting stats and their forum activity. To accurately calculate forum activity score, delegates are required to prove ownership of their forum handle by [signing a message](https://www.karmahq.xyz/dao/link/forum?dao=arbitrum) with their delegate address and posting on the forum. The current Karma score formula is below, which can be adjusted by the DAO going forward:

((100) * ((Forum Activity Score * 1) + (Off-chain Votes % * 3) + (On-chain Votes % * 5))) / (Sum of Weights times Max Score Setting * 1)

Karma Score will be included in ARB staking via a smart contract that writes data onchain from the Karma API. We will include several guardrails to ensure that this aspect of the implementation is robust and decentralized:

* Users can verify Karma score calculations independently.
* The DAO will have the ability to block Karma Scores if it believes they are being calculated incorrectly.
* If Karma scores fail to arrive or the scores are blocked by the DAO, ARB Staking will distribute rewards to all stakers regardless of whether they are delegated to an active governance participant until the situation is resolved.

In the future, we believe it would make sense to integrate delegate incentives with ARB staking so that, instead of getting delegate incentive funds from the ARB treasury, they come directly from onchain revenue. We will lead a working group to develop a recommendation on this topic.

Tally will build ARB staking into our existing [Arbitrum DAO platform](https://www.tally.xyz/gov/arbitrum), so that users can easily stake and delegate in one place.

### Parallel workstreams: Staking Rewards and Delegation working groups

In parallel with the development of ARB Staking, we will lead two separate DAO working groups that are focused on aspects of the system that will be implemented after development is complete.

* The Staking Rewards working group will focus on how to fund staking rewards. It will develop a recommendation about whether staking rewards should be funded by sequencer fees, MEV fees, validator fees, token inflation, treasury diversification, and/or DAO venture investments and how to implement such rewards.
* The ARB Staking &amp; Delegation working group will focus on how to define an active contributor to the Arbitrum DAO, delegate incentives, and voting power distribution. It will collaborate with Tally and Karma to develop recommendations on Karma Score formula, the minimum Karma Score required to be eligible for staking.

The working groups will be formed via an open call for contributors that will be posted after this proposal passes the temp check stage. Each working group will deliver their recommendations in October, so that the recommendations can be turned into DAO proposals and created following the implementation of ARB Staking.

### Integration with future Arbitrum staking systems

We anticipate that multiple Arbitrum staking systems will be developed over time, perhaps to incentivize decentralized block production in BoLD or to create an efficient MEV market in Time Boost. We view multiple staking systems as complementary. Each system would ask the staker to do different work for Arbitrum, take different risks, and pay out different rewards. Having multiple systems lets ARB holders pick between different risk/reward payoffs and specialize in different types of work to secure the system.

## Estimated Timeline

Post proposal on forum for feedback: June

Post temp check proposal on Snapshot: August

Post onchain proposal on Tally for funding: August

Begin development: August

Submit smart contracts for audit: September

Submit onchain proposal on Tally including full ARB Staking implementation: October

Publish working group recommendations and turn them into DAO proposals: November

## Overall Cost

If this proposal passes temperature check, we will submit an onchain proposal that includes $200,000 USD in ARB of funding to cover the costs of development, including the following funding categories:

* $50,000 USD in ARB: Develop ARB Staking smart contracts
  * Implement staking contracts
  * Integrate Arbitrum’s current and potential fee mechanisms
  * Integrate Karma Score requirement
  * Enable the DAO to block Karma Scores if it believes they are being calculated incorrectly
* $20,000 USD in ARB: Integrate ARB Staking into Tally.xyz
* $50,000 USD in ARB: Integrate Karma into ARB Staking
  * Develop and deploy a smart contract to store key stats and Karma scores onchain
  * Create a system to record stats onchain and store detailed delegate data off-chain (using Arweave or IPFS) for easy verification
  * Continuously improve scoring algorithms to adapt to evolving Arbitrum community needs
  * Provide technical support to delegates experiencing issues with their statistics
* $60,000 USD in ARB: Audit ARB Staking smart contracts
  * The final cost of the audit including documentation will be published on this thread. Any leftover funds from the $100,000 budget will be returned to the DAO.
* $20,000 USD in ARB: Fund Staking Rewards and ARB Staking &amp; Delegation working groups

Separately, we will submit an onchain proposal with the full ARB Staking implementation at the conclusion of the development process.

### Disclaimer

This proposal should not be relied on as legal, tax, or investment advice. Any projections included here are based on our best estimates and presented for informational purposes only."#;

        assert_eq!(processed_content, expected_content);
    }
}
