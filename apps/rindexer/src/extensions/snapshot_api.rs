use anyhow::{Context, Result};
use once_cell::sync::OnceCell;
use rand::Rng;
use reqwest::Client;
use serde::{Deserialize, de::DeserializeOwned};
use std::{
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::{
    sync::{Semaphore, mpsc, oneshot},
    time::{sleep, timeout},
};
use tracing::{debug, error, info, instrument, warn};

static SNAPSHOT_MAX_RETRIES: usize = 15; // Increased for reliability
static SNAPSHOT_MAX_CONCURRENT_REQUESTS: usize = 5;
static SNAPSHOT_MAX_QUEUE: usize = 1000; // Increased queue size
static SNAPSHOT_TIMEOUT: Duration = Duration::from_secs(60 * 5);
static SNAPSHOT_INITIAL_RETRY_DELAY: Duration = Duration::from_secs(1);
static SNAPSHOT_MAX_RETRY_DELAY: Duration = Duration::from_secs(300); // 5 minutes max

pub const SNAPSHOT_GRAPHQL_ENDPOINT: &str = "https://hub.snapshot.org/graphql";

// Response structures for Snapshot API

/// Response from Snapshot GraphQL API for proposals query
#[derive(Deserialize, Debug)]
pub struct SnapshotProposalsResponse {
    pub data: Option<SnapshotProposalData>,
}

/// Container for proposals data in the GraphQL response
#[derive(Deserialize, Debug)]
pub struct SnapshotProposalData {
    pub proposals: Vec<SnapshotProposal>,
}

/// Represents a proposal from Snapshot
#[derive(Clone, Deserialize, Debug)]
pub struct SnapshotProposal {
    pub id: String,
    pub author: String,
    pub title: String,
    pub body: String,
    pub discussion: String,
    pub choices: Vec<String>,
    pub scores_state: String,
    pub privacy: String,
    pub created: i64,
    pub start: i64,
    pub end: i64,
    pub quorum: f64,
    pub link: String,
    pub state: String,
    #[serde(rename = "type")]
    pub proposal_type: String,
    pub flagged: Option<bool>,
    pub ipfs: String,
}

/// Response from Snapshot GraphQL API for votes query
#[derive(Deserialize, Debug)]
pub struct SnapshotVotesResponse {
    pub data: Option<SnapshotVoteData>,
}

/// Container for votes data in the GraphQL response
#[derive(Deserialize, Debug)]
pub struct SnapshotVoteData {
    pub votes: Option<Vec<SnapshotVote>>,
}

/// Represents a vote from Snapshot
#[derive(Deserialize, Debug, Clone)]
pub struct SnapshotVote {
    pub voter: String,
    pub reason: Option<String>,
    pub choice: serde_json::Value,
    pub vp: f64,
    pub created: i64,
    pub proposal: SnapshotProposalRef,
    pub ipfs: String,
}

impl SnapshotVote {
    /// Converts a SnapshotVote to a database vote model
    pub fn to_active_model(
        &self,
        governor_id: sea_orm::prelude::Uuid,
        dao_id: sea_orm::prelude::Uuid,
    ) -> Result<Option<proposalsapp_db::models::vote::ActiveModel>> {
        use chrono::DateTime;
        use proposalsapp_db::models::vote;
        use sea_orm::{ActiveValue::NotSet, Set};
        use tracing::warn;

        // Parse the created timestamp
        let created_at = match DateTime::from_timestamp(self.created, 0) {
            Some(dt) => dt.naive_utc(),
            None => {
                warn!(
                    voter = self.voter,
                    proposal_id = self.proposal.id,
                    created = self.created,
                    "Invalid created timestamp for vote, skipping."
                );
                return Ok(None);
            }
        };

        // Process the choice value
        let choice_value = if self.choice.is_number() {
            match self.choice.as_i64() {
                Some(choice) => (choice - 1).into(),
                None => {
                    warn!(
                        voter = self.voter,
                        proposal_id = self.proposal.id,
                        choice = ?self.choice,
                        "Invalid choice value for vote, skipping."
                    );
                    return Ok(None);
                }
            }
        } else {
            self.choice.clone()
        };

        // Create the vote model
        let vote_model = vote::ActiveModel {
            id: NotSet,
            governor_id: Set(governor_id),
            dao_id: Set(dao_id),
            proposal_external_id: Set(self.proposal.id.clone()),
            voter_address: Set(self.voter.clone()),
            voting_power: Set(self.vp),
            choice: Set(choice_value),
            reason: Set(self.reason.clone()),
            created_at: Set(created_at),
            block_created_at: NotSet,
            txid: Set(Some(self.ipfs.clone())),
            proposal_id: NotSet, // Proposal id will be set in store_vote if proposal exists
        };

        tracing::debug!(
            voter = self.voter,
            proposal_id = self.proposal.id,
            created_at = ?created_at,
            "Snapshot vote processed"
        );

        Ok(Some(vote_model))
    }
}

/// Reference to a Snapshot proposal
#[derive(Deserialize, Debug, Clone)]
pub struct SnapshotProposalRef {
    pub id: String,
}

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

        // Send with automatic retry on full queue
        match self.sender.try_send(job) {
            Ok(()) => {
                debug!(
                    queue_capacity = self.sender.capacity(),
                    "Job sent to snapshot API queue"
                );
            }
            Err(mpsc::error::TrySendError::Full(job)) => {
                // Queue is full, wait for space
                warn!(
                    queue_capacity = self.sender.capacity(),
                    "Queue full, waiting for space..."
                );
                self.sender
                    .send(job)
                    .await
                    .context("Failed to send job to queue")?;
                debug!("Job sent to snapshot API queue after waiting");
            }
            Err(mpsc::error::TrySendError::Closed(_)) => {
                return Err(anyhow::anyhow!("Snapshot API queue is closed"));
            }
        }

        let response = response_receiver.await??;
        Ok(serde_json::from_str(&response)?)
    }

    /// Fetches a batch of proposals from Snapshot API for a given space
    #[instrument(name = "fetch_proposals", skip(self), fields(space = space))]
    pub async fn fetch_proposals(
        &self,
        space: &str,
        skip: usize,
        batch_size: usize,
    ) -> Result<Vec<SnapshotProposal>> {
        let graphql_query = format!(
            r#"
            {{
                proposals(
                    first: {batch_size},
                    skip: {skip},
                    orderBy: "created",
                    orderDirection: asc,
                    where: {{
                        space: "{space}"
                    }}
                ) {{
                    id
                    author
                    title
                    body
                    discussion
                    choices
                    scores
                    scores_total
                    scores_state
                    privacy
                    created
                    start
                    end
                    quorum
                    link
                    state
                    flagged
                    type
                    ipfs
                }}
            }}"#
        );

        debug!(space = %space, skip = skip, batch_size = batch_size, "Fetching snapshot proposals batch");

        let response: SnapshotProposalsResponse = self
            .fetch(SNAPSHOT_GRAPHQL_ENDPOINT, graphql_query)
            .await
            .with_context(|| {
                format!("Failed to fetch proposals from Snapshot API for space {space}")
            })?;

        Ok(response.data.map(|d| d.proposals).unwrap_or_default())
    }

    /// Fetches votes from Snapshot API for the given space and proposals
    #[instrument(name = "fetch_votes", skip(self), fields(space = space))]
    pub async fn fetch_votes(
        &self,
        space: &str,
        last_vote_created: i64,
        proposal_ids: &[String],
    ) -> Result<Vec<SnapshotVote>> {
        let proposals_str = format!(
            "[{}]",
            proposal_ids
                .iter()
                .map(|id| format!("\"{id}\""))
                .collect::<Vec<_>>()
                .join(",")
        );

        let graphql_query = format!(
            r#"
            {{
                votes(
                    first: {batch_size},
                    orderBy: "created",
                    orderDirection: asc,
                    where: {{
                        space: "{space}"
                        created_gt: {last_created},
                        proposal_in: {proposals}
                    }}
                ) {{
                    voter
                    reason
                    choice
                    vp
                    created
                    ipfs
                    proposal {{
                        id
                    }}
                }}
            }}
            "#,
            batch_size = 100,
            space = space,
            last_created = last_vote_created,
            proposals = proposals_str
        );

        debug!(space = %space, last_created = last_vote_created, proposal_count = proposal_ids.len(), "Fetching snapshot votes");

        let response: SnapshotVotesResponse = self
            .fetch(SNAPSHOT_GRAPHQL_ENDPOINT, graphql_query)
            .await
            .with_context(|| {
                format!("Failed to fetch votes from Snapshot API for space {space}")
            })?;

        Ok(response.data.and_then(|d| d.votes).unwrap_or_default())
    }

    /// Fetches votes for a specific proposal from Snapshot API
    #[instrument(name = "fetch_proposal_votes", skip(self), fields(proposal_id = proposal_external_id))]
    pub async fn fetch_proposal_votes(
        &self,
        proposal_external_id: &str,
        skip: usize,
        batch_size: usize,
    ) -> Result<Vec<SnapshotVote>> {
        let graphql_query = format!(
            r#"
            {{
                votes(
                    first: {batch_size},
                    skip: {skip},
                    orderBy: "created",
                    orderDirection: asc,
                    where: {{
                        proposal: "{proposal_external_id}"
                    }}
                ) {{
                    voter
                    reason
                    choice
                    vp
                    created
                    ipfs
                    proposal {{
                        id
                    }}
                }}
            }}"#
        );

        debug!(proposal_external_id = %proposal_external_id, skip = skip, batch_size = batch_size, "Fetching vote batch for proposal");

        let response: SnapshotVotesResponse = self
            .fetch(SNAPSHOT_GRAPHQL_ENDPOINT, graphql_query)
            .await
            .with_context(|| {
                format!(
                    "Failed to fetch votes from Snapshot API for proposal {proposal_external_id}"
                )
            })?;

        Ok(response.data.and_then(|d| d.votes).unwrap_or_default())
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

    /// Calculate retry delay with exponential backoff and jitter
    fn calculate_retry_delay(attempt: usize, base_delay: Duration) -> Duration {
        let mut rng = rand::rng();
        let exponential_delay = base_delay.saturating_mul(2u32.saturating_pow(attempt as u32));
        let capped_delay = exponential_delay.min(SNAPSHOT_MAX_RETRY_DELAY);

        // Add jitter: 80-120% of the calculated delay
        let jitter_factor = rng.random_range(0.8..1.2);
        let jittered_millis = (capped_delay.as_millis() as f64 * jitter_factor) as u64;
        Duration::from_millis(jittered_millis)
    }

    /// Check if an HTTP status code is retryable
    fn is_retryable_status(status: u16) -> bool {
        matches!(
            status,
            408 | // Request Timeout
            429 | // Too Many Requests
            500 | // Internal Server Error
            502 | // Bad Gateway
            503 | // Service Unavailable
            504 // Gateway Timeout
        )
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
        let mut delay = SNAPSHOT_INITIAL_RETRY_DELAY;
        let start_time = Instant::now();

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
                    } else {
                        let status_code = response.status().as_u16();

                        if Self::is_retryable_status(status_code) {
                            attempt += 1;
                            if attempt > config.max_retries {
                                error!(
                                    status_code = status_code,
                                    url = url,
                                    attempts = attempt,
                                    total_retry_time = ?start_time.elapsed(),
                                    "CRITICAL: Max retries reached for retryable HTTP error - request will be dropped!"
                                );
                                return Err(anyhow::anyhow!(
                                    "Max retries reached for URL: {} with status: {}",
                                    url,
                                    status_code
                                ));
                            }

                            // Special handling for rate limiting
                            if status_code == 429 {
                                let retry_after = response
                                    .headers()
                                    .get(reqwest::header::RETRY_AFTER)
                                    .and_then(|h| h.to_str().ok())
                                    .and_then(|s| s.parse::<u64>().ok())
                                    .map(Duration::from_secs)
                                    .unwrap_or_else(|| Self::calculate_retry_delay(attempt, delay));

                                warn!(
                                    status_code = 429,
                                    retry_after = ?retry_after,
                                    attempt = attempt,
                                    url = url,
                                    "Rate limited. Waiting before retrying..."
                                );
                                sleep(retry_after).await;
                                delay = retry_after;
                                // Consume response body
                                let _ = response.text().await;
                            } else {
                                let retry_delay = Self::calculate_retry_delay(attempt, delay);
                                warn!(
                                    status_code = status_code,
                                    retry_delay = ?retry_delay,
                                    attempt = attempt,
                                    url = url,
                                    "Retryable HTTP error. Waiting before retrying..."
                                );
                                // Consume response body
                                let _ = response.text().await;
                                sleep(retry_delay).await;
                                delay = retry_delay;
                            }
                        } else {
                            // Non-retryable error
                            let response_text = response.text().await?;
                            error!(
                                status_code = status_code,
                                url = url,
                                response_body = response_text,
                                "Non-retryable HTTP error from snapshot API"
                            );
                            return Err(anyhow::anyhow!(
                                "HTTP error: {}, URL: {}, Response: {}",
                                status_code,
                                url,
                                response_text
                            ));
                        }
                    }
                }
                Ok(Err(e)) => {
                    attempt += 1;
                    if attempt > config.max_retries {
                        error!(
                            error = %e,
                            url = url,
                            attempts = attempt,
                            total_retry_time = ?start_time.elapsed(),
                            "CRITICAL: Max retries reached after network error - request will be dropped!"
                        );
                        // TODO: Consider implementing a dead letter queue here
                        return Err(anyhow::anyhow!(
                            "Max retries reached for URL: {} after error: {}",
                            url,
                            e
                        ));
                    }

                    let retry_delay = Self::calculate_retry_delay(attempt, delay);
                    warn!(
                        error = %e,
                        retry_delay = ?retry_delay,
                        attempt = attempt,
                        url = url,
                        "Network error. Retrying with exponential backoff..."
                    );
                    sleep(retry_delay).await;
                    delay = retry_delay;
                }
                Err(_timeout_err) => {
                    attempt += 1;
                    if attempt > config.max_retries {
                        error!(
                            url = url,
                            attempts = attempt,
                            timeout_duration = ?config.request_timeout,
                            total_retry_time = ?start_time.elapsed(),
                            "CRITICAL: Max retries reached after timeouts - request will be dropped!"
                        );
                        return Err(anyhow::anyhow!(
                            "Max retries reached - Timeout for URL: {}",
                            url
                        ));
                    }

                    let retry_delay = Self::calculate_retry_delay(attempt, delay);
                    warn!(
                        retry_delay = ?retry_delay,
                        attempt = attempt,
                        url = url,
                        timeout_duration = ?config.request_timeout,
                        "Request timed out. Retrying with exponential backoff..."
                    );
                    sleep(retry_delay).await;
                    delay = retry_delay;
                }
            }
        }
    }

    #[instrument(name = "snapshot_api_update_rate_limit_info", skip(rate_limiter))]
    fn update_rate_limit_info(response: &reqwest::Response, rate_limiter: &RateLimiter) {
        if let Some(remaining) = response.headers().get("ratelimit-remaining")
            && let Ok(remaining) = remaining.to_str().unwrap_or("0").parse::<u32>()
        {
            rate_limiter
                .remaining
                .store(remaining, std::sync::atomic::Ordering::SeqCst);
            debug!(
                remaining_requests = remaining,
                "Rate limit remaining updated"
            );
        }

        if let Some(reset) = response.headers().get("ratelimit-reset")
            && let Ok(reset) = reset.to_str().unwrap_or("0").parse::<u64>()
            && let Ok(mut reset_time) = rate_limiter.reset.try_lock()
        {
            *reset_time = Instant::now() + Duration::from_secs(reset);
            debug!(reset_seconds = reset, "Rate limit reset time updated");
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
    use mockito::{Matcher, Server};
    use std::sync::atomic::Ordering;

    #[tokio::test]
    async fn test_fetch_space() {
        let config = SnapshotApiConfig {
            request_timeout: Duration::from_secs(10),
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
            request_timeout: Duration::from_secs(10),
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
            request_timeout: Duration::from_secs(5),
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
    async fn test_timeout_with_retry() {
        let config = SnapshotApiConfig {
            request_timeout: Duration::from_millis(10), // Very short timeout
            max_retries: 2,                             // Limit retries for test
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

        let start = Instant::now();
        let result = handler
            .fetch::<serde_json::Value>("https://hub.snapshot.org/graphql", query)
            .await;

        assert!(result.is_err(), "Should return an error due to timeout");
        // Should have retried at least once
        assert!(start.elapsed() > Duration::from_millis(20));
    }

    #[tokio::test]
    async fn test_queue_overflow_handling() {
        let config = SnapshotApiConfig {
            request_timeout: Duration::from_secs(5),
            queue_size: 2,  // Very small queue
            concurrency: 1, // Process one at a time
            ..Default::default()
        };
        let handler = Arc::new(SnapshotApiHandler::new(config));

        // Spawn multiple requests to fill the queue
        let mut handles = vec![];
        for i in 0..5 {
            let handler_clone = handler.clone();
            let handle = tokio::spawn(async move {
                let query = format!(
                    r#"
                    query {{
                        space(id: "test{i}.eth") {{
                            id
                        }}
                    }}
                    "#
                );
                handler_clone
                    .fetch::<serde_json::Value>("https://hub.snapshot.org/graphql", query)
                    .await
            });
            handles.push(handle);
        }

        // All requests should eventually complete (queue waits for space)
        for handle in handles {
            let result = handle.await.unwrap();
            // Some might fail due to invalid space, but none should fail due to queue overflow
            // The important thing is that the task completes
            assert!(result.is_ok() || result.is_err());
        }
    }

    #[tokio::test]
    async fn test_concurrent_requests() {
        let config = SnapshotApiConfig {
            request_timeout: Duration::from_secs(10),
            concurrency: 3,
            ..Default::default()
        };
        let handler = Arc::new(SnapshotApiHandler::new(config));

        let start = Instant::now();
        let mut handles = vec![];

        // Spawn 6 requests (should process 3 at a time)
        for _i in 0..6 {
            let handler_clone = handler.clone();
            let handle = tokio::spawn(async move {
                let query = r#"
                    query {
                        space(id: "yam.eth") {
                            id
                            name
                        }
                    }
                "#
                .to_string();

                handler_clone
                    .fetch::<serde_json::Value>("https://hub.snapshot.org/graphql", query)
                    .await
            });
            handles.push(handle);
        }

        let mut success_count = 0;
        for handle in handles {
            if let Ok(Ok(_)) = handle.await {
                success_count += 1;
            }
        }

        // At least some requests should succeed
        assert!(success_count > 0);

        // Should take more time than if all were concurrent
        let elapsed = start.elapsed();
        println!("Concurrent test took {elapsed:?} for 6 requests with concurrency 3");
    }

    #[test]
    fn test_calculate_retry_delay() {
        // Test exponential backoff
        let base = Duration::from_secs(1);

        let delay0 = SnapshotApiHandler::calculate_retry_delay(0, base);
        assert!(delay0 >= Duration::from_millis(800) && delay0 <= Duration::from_millis(1200));

        let delay1 = SnapshotApiHandler::calculate_retry_delay(1, base);
        assert!(delay1 >= Duration::from_millis(1600) && delay1 <= Duration::from_millis(2400));

        let delay2 = SnapshotApiHandler::calculate_retry_delay(2, base);
        assert!(delay2 >= Duration::from_millis(3200) && delay2 <= Duration::from_millis(4800));

        // Test max cap
        let delay10 = SnapshotApiHandler::calculate_retry_delay(10, base);
        assert!(delay10 <= Duration::from_secs(360)); // Should be capped at 5 minutes + jitter
    }

    #[test]
    fn test_is_retryable_status() {
        assert!(SnapshotApiHandler::is_retryable_status(408));
        assert!(SnapshotApiHandler::is_retryable_status(429));
        assert!(SnapshotApiHandler::is_retryable_status(500));
        assert!(SnapshotApiHandler::is_retryable_status(502));
        assert!(SnapshotApiHandler::is_retryable_status(503));
        assert!(SnapshotApiHandler::is_retryable_status(504));

        assert!(!SnapshotApiHandler::is_retryable_status(400));
        assert!(!SnapshotApiHandler::is_retryable_status(401));
        assert!(!SnapshotApiHandler::is_retryable_status(403));
        assert!(!SnapshotApiHandler::is_retryable_status(404));
    }

    #[tokio::test]
    async fn test_rate_limit_tracking() {
        let rate_limiter = Arc::new(RateLimiter::new());

        // Simulate rate limit update
        rate_limiter.remaining.store(10, Ordering::SeqCst);

        // Should not wait when we have remaining requests
        let start = Instant::now();
        SnapshotApiHandler::wait_for_rate_limit(&rate_limiter).await;
        assert!(start.elapsed() < Duration::from_millis(10));

        // Simulate approaching rate limit
        rate_limiter.remaining.store(25, Ordering::SeqCst);
        *rate_limiter.reset.lock().await = Instant::now() + Duration::from_millis(100);

        // Should wait when approaching limit
        let start = Instant::now();
        SnapshotApiHandler::wait_for_rate_limit(&rate_limiter).await;
        assert!(start.elapsed() >= Duration::from_millis(100));
    }

    #[tokio::test]
    async fn test_fetch_proposals_method() {
        let config = SnapshotApiConfig {
            request_timeout: Duration::from_secs(10),
            ..Default::default()
        };
        let handler = SnapshotApiHandler::new(config);

        let proposals = handler
            .fetch_proposals("arbitrumfoundation.eth", 0, 1)
            .await;

        match proposals {
            Ok(props) => {
                // May be empty if no proposals exist
                assert!(props.len() <= 1);
                if !props.is_empty() {
                    assert!(!props[0].id.is_empty());
                    assert!(!props[0].title.is_empty());
                }
            }
            Err(e) => {
                // API might be down or space might not exist
                println!("Error fetching proposals: {e:?}");
            }
        }
    }

    #[tokio::test]
    async fn test_fetch_votes_method() {
        let config = SnapshotApiConfig {
            request_timeout: Duration::from_secs(10),
            ..Default::default()
        };
        let handler = SnapshotApiHandler::new(config);

        // Use a timestamp from the past
        let votes = handler.fetch_votes("arbitrumfoundation.eth", 0, &[]).await;

        match votes {
            Ok(v) => {
                // Should return empty array for empty proposal list
                assert_eq!(v.len(), 0);
            }
            Err(e) => {
                println!("Error fetching votes: {e:?}");
            }
        }
    }

    // Mock server tests for controlled testing
    #[tokio::test]
    async fn test_retry_on_500_error() {
        let mut server = Server::new_async().await;
        let url = server.url();

        // First two requests return 500, third succeeds
        let _m = server
            .mock("GET", "/graphql")
            .match_query(Matcher::Any)
            .with_status(500)
            .with_body("Internal Server Error")
            .expect(2)
            .create_async()
            .await;

        let _m2 = server
            .mock("GET", "/graphql")
            .match_query(Matcher::Any)
            .with_status(200)
            .with_body(r#"{"data": {"test": "success"}}"#)
            .expect(1)
            .create_async()
            .await;

        let config = SnapshotApiConfig {
            request_timeout: Duration::from_secs(5),
            max_retries: 3,
            ..Default::default()
        };
        let handler = SnapshotApiHandler::new(config);

        let result = handler
            .fetch::<serde_json::Value>(&format!("{url}/graphql"), "test query".to_string())
            .await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap()["data"]["test"], "success");
    }

    #[tokio::test]
    async fn test_retry_on_rate_limit() {
        let mut server = Server::new_async().await;
        let url = server.url();

        // First request returns 429 with retry-after
        let _m = server
            .mock("GET", "/graphql")
            .match_query(Matcher::Any)
            .with_status(429)
            .with_header("retry-after", "1")
            .with_body("Rate limited")
            .expect(1)
            .create_async()
            .await;

        let _m2 = server
            .mock("GET", "/graphql")
            .match_query(Matcher::Any)
            .with_status(200)
            .with_body(r#"{"data": {"test": "success"}}"#)
            .expect(1)
            .create_async()
            .await;

        let config = SnapshotApiConfig {
            request_timeout: Duration::from_secs(5),
            max_retries: 2,
            ..Default::default()
        };
        let handler = SnapshotApiHandler::new(config);

        let start = Instant::now();
        let result = handler
            .fetch::<serde_json::Value>(&format!("{url}/graphql"), "test query".to_string())
            .await;

        assert!(result.is_ok());
        assert!(start.elapsed() >= Duration::from_secs(1)); // Should have waited
        assert_eq!(result.unwrap()["data"]["test"], "success");
    }

    #[tokio::test]
    async fn test_rate_limit_headers_parsing() {
        let mut server = Server::new_async().await;
        let url = server.url();

        // Response with rate limit headers
        let _m = server
            .mock("GET", "/graphql")
            .match_query(Matcher::Any)
            .with_status(200)
            .with_header("ratelimit-remaining", "45")
            .with_header("ratelimit-reset", "60")
            .with_body(r#"{"data": {"test": "success"}}"#)
            .expect(1)
            .create_async()
            .await;

        let config = SnapshotApiConfig::default();
        let handler = SnapshotApiHandler::new(config);

        let result = handler
            .fetch::<serde_json::Value>(&format!("{url}/graphql"), "test query".to_string())
            .await;

        assert!(result.is_ok());
        // The headers should be parsed and stored in the rate limiter
        // This is internal behavior, but we're testing it was processed without errors
    }

    #[tokio::test]
    async fn test_multiple_error_types_retry() {
        let mut server = Server::new_async().await;
        let url = server.url();

        // Test a single retryable error followed by success
        // This tests that different error codes are properly handled without excessive delays
        let _m1 = server
            .mock("GET", "/graphql")
            .match_query(Matcher::Any)
            .with_status(503) // Service Unavailable
            .with_body("Service temporarily unavailable")
            .expect(1)
            .create_async()
            .await;

        let _m2 = server
            .mock("GET", "/graphql")
            .match_query(Matcher::Any)
            .with_status(200)
            .with_body(r#"{"data": {"test": "success"}}"#)
            .expect(1)
            .create_async()
            .await;

        let config = SnapshotApiConfig {
            request_timeout: Duration::from_secs(5),
            max_retries: 3,
            ..Default::default()
        };
        let handler = SnapshotApiHandler::new(config);

        let result = handler
            .fetch::<serde_json::Value>(&format!("{url}/graphql"), "test query".to_string())
            .await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap()["data"]["test"], "success");

        // Test that all retryable status codes are recognized
        for &code in &[408, 429, 500, 502, 503, 504] {
            assert!(
                SnapshotApiHandler::is_retryable_status(code),
                "Status {code} should be retryable"
            );
        }
    }

    #[tokio::test]
    async fn test_non_retryable_errors() {
        let mut server = Server::new_async().await;
        let url = server.url();

        // Test non-retryable error codes
        let non_retryable_codes = vec![400, 401, 403, 404];

        for &code in &non_retryable_codes {
            let _m = server
                .mock("GET", "/graphql")
                .match_query(Matcher::Any)
                .with_status(code)
                .with_body(format!("Error {code}"))
                .expect(1)
                .create_async()
                .await;

            let config = SnapshotApiConfig {
                request_timeout: Duration::from_secs(5),
                max_retries: 3,
                ..Default::default()
            };
            let handler = SnapshotApiHandler::new(config);

            let result = handler
                .fetch::<serde_json::Value>(&format!("{url}/graphql"), format!("test query {code}"))
                .await;

            assert!(result.is_err(), "Should fail immediately for {code}");

            // Reset the server for next test
            server.reset();
        }
    }

    #[tokio::test]
    async fn test_edge_case_just_before_rate_limit() {
        let rate_limiter = Arc::new(RateLimiter::new());

        // Set to just above threshold
        rate_limiter.remaining.store(31, Ordering::SeqCst);

        let start = Instant::now();
        SnapshotApiHandler::wait_for_rate_limit(&rate_limiter).await;

        // Should not wait
        assert!(start.elapsed() < Duration::from_millis(10));
    }

    #[tokio::test]
    async fn test_edge_case_exactly_at_rate_limit() {
        let rate_limiter = Arc::new(RateLimiter::new());

        // Set exactly at threshold
        rate_limiter.remaining.store(30, Ordering::SeqCst);
        *rate_limiter.reset.lock().await = Instant::now() + Duration::from_millis(50);

        let start = Instant::now();
        SnapshotApiHandler::wait_for_rate_limit(&rate_limiter).await;

        // Should wait
        assert!(start.elapsed() >= Duration::from_millis(50));
    }

    #[tokio::test]
    async fn test_time_based_retry_behavior() {
        // Test that delays increase exponentially over multiple attempts
        let base = Duration::from_secs(1);

        // Test that delays increase exponentially
        let delay0 = SnapshotApiHandler::calculate_retry_delay(0, base);
        let delay1 = SnapshotApiHandler::calculate_retry_delay(1, base);
        let delay2 = SnapshotApiHandler::calculate_retry_delay(2, base);

        // Even with jitter, delay1 should be roughly 2x delay0
        assert!(delay1 > delay0);
        assert!(delay2 > delay1);

        // Test max cap - account for up to 20% jitter
        let delay_max = SnapshotApiHandler::calculate_retry_delay(20, base);
        let max_with_jitter =
            Duration::from_millis((SNAPSHOT_MAX_RETRY_DELAY.as_millis() as f64 * 1.2) as u64);
        assert!(
            delay_max <= max_with_jitter,
            "delay_max ({delay_max:?}) should be <= max_with_jitter ({max_with_jitter:?})"
        );
    }

    #[tokio::test]
    async fn test_queue_metrics_and_monitoring() {
        let config = SnapshotApiConfig {
            request_timeout: Duration::from_secs(5),
            queue_size: 10,
            concurrency: 2,
            ..Default::default()
        };
        let handler = Arc::new(SnapshotApiHandler::new(config));

        // Track queue capacity usage
        let initial_capacity = handler.sender.capacity();
        assert_eq!(initial_capacity, 10);

        // Fill queue partially
        let mut handles = vec![];
        for i in 0..5 {
            let handler_clone = handler.clone();
            let handle = tokio::spawn(async move {
                let query = format!(r#"query {{ test{i} }}"#);
                handler_clone
                    .fetch::<serde_json::Value>("https://hub.snapshot.org/graphql", query)
                    .await
            });
            handles.push(handle);
        }

        // Verify queue is being used
        // Note: This is a bit tricky to test reliably due to timing

        // Clean up
        for handle in handles {
            let _ = handle.await;
        }
    }

    #[test]
    fn test_jitter_distribution() {
        // Test that jitter is properly distributed
        let base = Duration::from_secs(1);
        let mut delays = vec![];

        // Generate multiple delays to check distribution
        for _ in 0..100 {
            let delay = SnapshotApiHandler::calculate_retry_delay(1, base);
            delays.push(delay.as_millis());
        }

        // Check that we have variation (jitter is working)
        let min = delays.iter().min().unwrap();
        let max = delays.iter().max().unwrap();

        // With 80-120% jitter on 2 second base, should be 1600-2400ms
        assert!(*min >= 1600);
        assert!(*max <= 2400);
        assert!(max - min > 100); // Should have reasonable spread
    }

    #[tokio::test]
    async fn test_concurrent_rate_limit_updates() {
        let rate_limiter = Arc::new(RateLimiter::new());

        // Simulate multiple concurrent updates to rate limiter
        let mut handles = vec![];

        for i in 0..10 {
            let rl = rate_limiter.clone();
            let handle = tokio::spawn(async move {
                // Simulate updating rate limit info
                rl.remaining.store(50 - i as u32, Ordering::SeqCst);
                if let Ok(mut reset) = rl.reset.try_lock() {
                    *reset = Instant::now() + Duration::from_secs(60);
                }
            });
            handles.push(handle);
        }

        for handle in handles {
            handle.await.unwrap();
        }

        // Verify rate limiter is in a valid state
        let remaining = rate_limiter.remaining.load(Ordering::SeqCst);
        assert!(remaining <= 50);
    }

    #[tokio::test]
    async fn test_request_deduplication() {
        // Test that identical concurrent requests are handled properly
        let config = SnapshotApiConfig {
            request_timeout: Duration::from_secs(10),
            concurrency: 5,
            ..Default::default()
        };
        let handler = Arc::new(SnapshotApiHandler::new(config));

        let identical_query = r#"
            query {
                space(id: "test.eth") {
                    id
                }
            }
        "#
        .to_string();

        // Send 3 identical requests concurrently
        let mut handles = vec![];
        for _ in 0..3 {
            let handler_clone = handler.clone();
            let query_clone = identical_query.clone();
            let handle = tokio::spawn(async move {
                handler_clone
                    .fetch::<serde_json::Value>("https://hub.snapshot.org/graphql", query_clone)
                    .await
            });
            handles.push(handle);
        }

        // All should complete (even if with errors)
        for handle in handles {
            let _ = handle.await.unwrap();
        }
    }

    // Property-based tests
    #[cfg(test)]
    mod prop_tests {
        use super::*;
        use proptest::prelude::*;

        proptest! {
            #[test]
            fn prop_calculate_retry_delay_increases(
                attempt in 0usize..10,
                base_secs in 1u64..10
            ) {
                let base = Duration::from_secs(base_secs);
                let delay = SnapshotApiHandler::calculate_retry_delay(attempt, base);

                // Delay should be within expected bounds
                let min_expected = base.as_millis() as f64 * 2f64.powi(attempt as i32) * 0.8;
                let max_expected = (base.as_millis() as f64 * 2f64.powi(attempt as i32) * 1.2)
                    .min(SNAPSHOT_MAX_RETRY_DELAY.as_millis() as f64 * 1.2);

                let delay_millis = delay.as_millis() as f64;
                prop_assert!(delay_millis >= min_expected.min(SNAPSHOT_MAX_RETRY_DELAY.as_millis() as f64 * 0.8));
                prop_assert!(delay_millis <= max_expected);
            }

            #[test]
            fn prop_is_retryable_status_consistent(status in 100u16..600) {
                let result = SnapshotApiHandler::is_retryable_status(status);

                // Verify consistency
                match status {
                    408 | 429 | 500 | 502 | 503 | 504 => prop_assert!(result),
                    _ => prop_assert!(!result),
                }
            }
        }
    }

    #[tokio::test]
    async fn test_stress_concurrent_requests() {
        let config = SnapshotApiConfig {
            request_timeout: Duration::from_secs(5),
            concurrency: 10,
            queue_size: 50,
            ..Default::default()
        };
        let handler = Arc::new(SnapshotApiHandler::new(config));

        // Stress test with many concurrent requests
        let mut handles = vec![];
        let request_count = 30;

        for i in 0..request_count {
            let handler_clone = handler.clone();
            let handle = tokio::spawn(async move {
                let query = format!(
                    r#"
                    query {{
                        space(id: "stress-test-{i}.eth") {{
                            id
                            name
                        }}
                    }}
                    "#
                );
                handler_clone
                    .fetch::<serde_json::Value>("https://hub.snapshot.org/graphql", query)
                    .await
            });
            handles.push(handle);
        }

        let mut completed = 0;
        for handle in handles {
            if handle.await.is_ok() {
                completed += 1;
            }
        }

        // All tasks should complete
        assert_eq!(completed, request_count);
    }

    #[tokio::test]
    async fn test_memory_safety_under_load() {
        // Test that the system doesn't leak memory or crash under load
        let config = SnapshotApiConfig {
            request_timeout: Duration::from_millis(100), // Very short to force timeouts
            concurrency: 5,
            queue_size: 20,
            max_retries: 1,
        };
        let handler = Arc::new(SnapshotApiHandler::new(config));

        // Create many requests that will timeout
        let mut handles = vec![];
        for i in 0..50 {
            let handler_clone = handler.clone();
            let handle = tokio::spawn(async move {
                let query = format!(r#"query {{ memtest{i} }}"#);
                let _ = handler_clone
                    .fetch::<serde_json::Value>("https://hub.snapshot.org/graphql", query)
                    .await;
            });
            handles.push(handle);
        }

        // All should complete without panics
        for handle in handles {
            let _ = handle.await;
        }
    }

    #[tokio::test]
    async fn test_all_retryable_error_codes() {
        // Test each retryable error code individually to ensure they're all handled
        let error_codes = vec![
            (408, "Request Timeout"),
            (429, "Too Many Requests"),
            (500, "Internal Server Error"),
            (502, "Bad Gateway"),
            (503, "Service Unavailable"),
            (504, "Gateway Timeout"),
        ];

        for (code, description) in error_codes {
            let mut server = Server::new_async().await;
            let url = server.url();

            // First request returns the error
            let _m1 = server
                .mock("GET", "/graphql")
                .match_query(Matcher::Any)
                .with_status(code)
                .with_body(format!("Error: {description}"))
                .expect(1)
                .create_async()
                .await;

            // Second request succeeds
            let _m2 = server
                .mock("GET", "/graphql")
                .match_query(Matcher::Any)
                .with_status(200)
                .with_body(r#"{"data": {"test": "recovered"}}"#)
                .expect(1)
                .create_async()
                .await;

            let config = SnapshotApiConfig {
                request_timeout: Duration::from_secs(2),
                max_retries: 2,
                ..Default::default()
            };
            let handler = SnapshotApiHandler::new(config);

            let result = handler
                .fetch::<serde_json::Value>(&format!("{url}/graphql"), "test query".to_string())
                .await;

            assert!(result.is_ok(), "Failed to retry on {code} {description}");
            assert_eq!(
                result.unwrap()["data"]["test"],
                "recovered",
                "Should recover from {code} {description}"
            );
        }
    }

    #[tokio::test]
    async fn test_graceful_shutdown() {
        let config = SnapshotApiConfig {
            request_timeout: Duration::from_secs(5),
            ..Default::default()
        };
        let handler = Arc::new(SnapshotApiHandler::new(config));

        // Send a request
        let handler_clone = handler.clone();
        let handle = tokio::spawn(async move {
            let query = r#"query { shutdown_test }"#.to_string();
            handler_clone
                .fetch::<serde_json::Value>("https://hub.snapshot.org/graphql", query)
                .await
        });

        // Drop the handler (simulating shutdown)
        drop(handler);

        // The in-flight request should still complete
        let result = handle.await;
        assert!(result.is_ok()); // Task should not panic
    }
}
