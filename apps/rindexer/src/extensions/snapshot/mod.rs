use anyhow::Result;
use once_cell::sync::Lazy;
use reqwest::Client;
use reqwest_middleware::{ClientBuilder, ClientWithMiddleware};
use reqwest_retry::{policies::ExponentialBackoff, RetryTransientMiddleware};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tracing::{debug, info, instrument, warn};

pub mod models;
use models::*;

pub const SNAPSHOT_GRAPHQL_ENDPOINT: &str = "https://hub.snapshot.org/graphql";

/// Token bucket rate limiter for 60 requests per minute
#[derive(Debug)]
struct RateLimiter {
    tokens: Arc<Mutex<f64>>,
    last_refill: Arc<Mutex<Instant>>,
    max_tokens: f64,
    refill_rate: f64, // tokens per second
}

impl RateLimiter {
    /// Create a new rate limiter with 60 requests per minute
    fn new() -> Self {
        Self {
            tokens: Arc::new(Mutex::new(60.0)),
            last_refill: Arc::new(Mutex::new(Instant::now())),
            max_tokens: 60.0,
            refill_rate: 1.0, // 60 tokens per 60 seconds = 1 token per second
        }
    }

    /// Wait until a request can be made (consumes 1 token)
    async fn acquire(&self) {
        loop {
            let now = Instant::now();
            let can_proceed = {
                let mut tokens = self.tokens.lock().unwrap();
                let mut last_refill = self.last_refill.lock().unwrap();

                // Refill tokens based on elapsed time
                let elapsed = now.duration_since(*last_refill).as_secs_f64();
                let new_tokens = (*tokens + elapsed * self.refill_rate).min(self.max_tokens);
                *tokens = new_tokens;
                *last_refill = now;

                // Check if we can consume a token
                if *tokens >= 1.0 {
                    *tokens -= 1.0;
                    true
                } else {
                    false
                }
            };

            if can_proceed {
                return;
            }

            // Wait before trying again
            let wait_ms = 1000; // 1 second
            warn!(
                "Rate limit reached, waiting {}ms before next request",
                wait_ms
            );
            tokio::time::sleep(Duration::from_millis(wait_ms)).await;
        }
    }
}

/// Global rate limiter instance for Snapshot API
static RATE_LIMITER: Lazy<RateLimiter> = Lazy::new(RateLimiter::new);

/// Simplified Snapshot API client
pub struct SnapshotApi {
    client: ClientWithMiddleware,
    endpoint: String,
}

impl SnapshotApi {
    pub fn new() -> Self {
        let retry_policy = ExponentialBackoff::builder().build_with_max_retries(3);
        let client = ClientBuilder::new(Client::new())
            .with(RetryTransientMiddleware::new_with_policy(retry_policy))
            .build();

        Self {
            client,
            endpoint: SNAPSHOT_GRAPHQL_ENDPOINT.to_string(),
        }
    }

    pub fn new_with_endpoint(endpoint: String) -> Self {
        let retry_policy = ExponentialBackoff::builder().build_with_max_retries(3);
        let client = ClientBuilder::new(Client::new())
            .with(RetryTransientMiddleware::new_with_policy(retry_policy))
            .build();

        Self {
            client,
            endpoint,
        }
    }

    /// Fetch proposals after a given timestamp (cursor-based pagination)
    #[instrument(name = "fetch_proposals_after", skip(self))]
    pub async fn fetch_proposals_after(
        &self,
        space: &str,
        after_timestamp: i64,
        limit: usize,
    ) -> Result<Vec<SnapshotProposal>> {
        let query = format!(
            r#"
            {{
                proposals(
                    first: {limit},
                    where: {{
                        space: "{space}",
                        created_gt: {after_timestamp}
                    }},
                    orderBy: "created",
                    orderDirection: asc
                ) {{
                    id
                    author
                    title
                    body
                    discussion
                    choices
                    scores_state
                    privacy
                    created
                    start
                    end
                    quorum
                    link
                    state
                    type
                    flagged
                    ipfs
                    votes
                    space {{
                        id
                    }}
                }}
            }}"#
        );

        debug!(space = %space, after_timestamp = after_timestamp, limit = limit, "Fetching proposals");

        let response: SnapshotProposalsResponse = self.fetch_graphql(&query).await?;
        Ok(response.data.map(|d| d.proposals).unwrap_or_default())
    }

    /// Fetch all votes for a specific proposal (handles pagination internally)
    #[instrument(name = "fetch_all_proposal_votes", skip(self))]
    pub async fn fetch_all_proposal_votes(&self, proposal_id: &str) -> Result<Vec<SnapshotVote>> {
        let mut all_votes = Vec::new();
        let mut skip = 0;
        const BATCH_SIZE: usize = 100;

        loop {
            let votes = self
                .fetch_proposal_votes_batch(proposal_id, skip, BATCH_SIZE)
                .await?;
            if votes.is_empty() {
                break;
            }

            skip += votes.len();
            all_votes.extend(votes);
        }

        info!(proposal_id = %proposal_id, total_votes = all_votes.len(), "Fetched all votes for proposal");
        Ok(all_votes)
    }

    /// Fetch a batch of votes for a proposal
    async fn fetch_proposal_votes_batch(
        &self,
        proposal_id: &str,
        skip: usize,
        limit: usize,
    ) -> Result<Vec<SnapshotVote>> {
        let query = format!(
            r#"
            {{
                votes(
                    first: {limit},
                    skip: {skip},
                    where: {{
                        proposal: "{proposal_id}"
                    }},
                    orderBy: "created",
                    orderDirection: asc
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
                    space {{
                        id
                    }}
                }}
            }}"#
        );

        debug!(proposal_id = %proposal_id, skip = skip, limit = limit, "Fetching vote batch");

        let response: SnapshotVotesResponse = self.fetch_graphql(&query).await?;
        Ok(response.data.and_then(|d| d.votes).unwrap_or_default())
    }

    /// Fetch active proposals for a space
    #[instrument(name = "fetch_active_proposals", skip(self))]
    pub async fn fetch_active_proposals(&self, space: &str) -> Result<Vec<SnapshotProposal>> {
        // Fetch active and pending proposals separately since the API doesn't support arrays for state
        let mut all_proposals = Vec::new();

        // Fetch active proposals
        let active_query = format!(
            r#"
            {{
                proposals(
                    where: {{
                        space: "{space}",
                        state: "active"
                    }},
                    first: 10,
                    orderBy: "created",
                    orderDirection: desc
                ) {{
                    id
                    author
                    title
                    body
                    discussion
                    choices
                    scores_state
                    privacy
                    created
                    start
                    end
                    quorum
                    link
                    state
                    type
                    flagged
                    ipfs
                    votes
                    space {{
                        id
                    }}
                }}
            }}"#
        );

        debug!(space = %space, "Fetching active proposals");
        let active_response: SnapshotProposalsResponse = self.fetch_graphql(&active_query).await?;
        all_proposals.extend(
            active_response
                .data
                .map(|d| d.proposals)
                .unwrap_or_default(),
        );

        // Fetch pending proposals
        let pending_query = format!(
            r#"
            {{
                proposals(
                    where: {{
                        space: "{space}",
                        state: "pending"
                    }},
                    first: 10,
                    orderBy: "created",
                    orderDirection: desc
                ) {{
                    id
                    author
                    title
                    body
                    discussion
                    choices
                    scores_state
                    privacy
                    created
                    start
                    end
                    quorum
                    link
                    state
                    type
                    flagged
                    ipfs
                    votes
                    space {{
                        id
                    }}
                }}
            }}"#
        );

        debug!(space = %space, "Fetching pending proposals");
        let pending_response: SnapshotProposalsResponse =
            self.fetch_graphql(&pending_query).await?;
        all_proposals.extend(
            pending_response
                .data
                .map(|d| d.proposals)
                .unwrap_or_default(),
        );

        info!(space = %space, active_count = all_proposals.len(), "Fetched active and pending proposals");
        Ok(all_proposals)
    }

    /// Fetch votes after a given timestamp for a space
    #[instrument(name = "fetch_votes_after", skip(self))]
    pub async fn fetch_votes_after(
        &self,
        space: &str,
        after_timestamp: i64,
        limit: usize,
    ) -> Result<Vec<SnapshotVote>> {
        let query = format!(
            r#"
            {{
                votes(
                    where: {{
                        space: "{space}",
                        created_gt: {after_timestamp}
                    }},
                    first: {limit},
                    orderBy: "created",
                    orderDirection: asc
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
                    space {{
                        id
                    }}
                }}
            }}"#
        );

        debug!(space = %space, after_timestamp = after_timestamp, limit = limit, "Fetching votes");

        let response: SnapshotVotesResponse = self.fetch_graphql(&query).await?;
        Ok(response.data.and_then(|d| d.votes).unwrap_or_default())
    }

    /// Fetch a single proposal by ID to refresh its state
    #[instrument(name = "fetch_proposal_by_id", skip(self))]
    pub async fn fetch_proposal_by_id(
        &self,
        proposal_id: &str,
    ) -> Result<Option<SnapshotProposal>> {
        let query = format!(
            r#"
            {{
                proposals(
                    where: {{
                        id: "{proposal_id}"
                    }},
                    first: 1
                ) {{
                    id
                    author
                    title
                    body
                    discussion
                    choices
                    scores_state
                    privacy
                    created
                    start
                    end
                    quorum
                    link
                    state
                    type
                    flagged
                    ipfs
                    votes
                    space {{
                        id
                    }}
                }}
            }}"#
        );

        debug!(proposal_id = %proposal_id, "Fetching proposal by ID");

        let response: SnapshotProposalsResponse = self.fetch_graphql(&query).await?;
        Ok(response.data.and_then(|d| d.proposals.into_iter().next()))
    }

    /// Fetch votes for a proposal with retry mechanism for hidden votes
    /// Keeps retrying until votes are no longer hidden (hex hashes) or max attempts reached
    #[instrument(name = "fetch_proposal_votes_with_retry", skip(self))]
    pub async fn fetch_proposal_votes_with_retry(
        &self,
        proposal_id: &str,
        max_attempts: usize,
        retry_delay_seconds: u64,
    ) -> Result<Vec<SnapshotVote>> {
        for attempt in 1..=max_attempts {
            let votes = self.fetch_all_proposal_votes(proposal_id).await?;

            // Check if any votes still have hidden choices
            let has_hidden_votes = votes.iter().any(|vote| vote.has_hidden_choice());

            if !has_hidden_votes || attempt == max_attempts {
                if has_hidden_votes && attempt == max_attempts {
                    warn!(
                        proposal_id = %proposal_id,
                        attempt = attempt,
                        "Max retry attempts reached, some votes may still be hidden"
                    );
                } else if !has_hidden_votes && attempt > 1 {
                    info!(
                        proposal_id = %proposal_id,
                        attempt = attempt,
                        "Hidden votes successfully revealed after retries"
                    );
                }
                return Ok(votes);
            }

            let hidden_count = votes.iter().filter(|vote| vote.has_hidden_choice()).count();
            info!(
                proposal_id = %proposal_id,
                attempt = attempt,
                max_attempts = max_attempts,
                hidden_count = hidden_count,
                total_count = votes.len(),
                "Found hidden votes, retrying in {}s",
                retry_delay_seconds
            );

            tokio::time::sleep(std::time::Duration::from_secs(retry_delay_seconds)).await;
        }

        // This shouldn't be reached due to the loop logic, but included for completeness
        self.fetch_all_proposal_votes(proposal_id).await
    }

    /// Fetch messages from the MCI stream
    #[instrument(name = "fetch_messages", skip(self))]
    pub async fn fetch_messages(
        &self,
        spaces: &[String],
        mci_gt: i64,
        limit: usize,
    ) -> Result<Vec<SnapshotMessage>> {
        let space_in = spaces
            .iter()
            .map(|s| format!("\"{}\"", s))
            .collect::<Vec<_>>()
            .join(",");

        let query = format!(
            r#"
            {{
                messages(
                    first: {limit},
                    where: {{
                        space_in: [{space_in}],
                        mci_gt: {mci_gt}
                    }},
                    orderBy: "mci",
                    orderDirection: asc
                ) {{
                    id
                    mci
                    timestamp
                    space
                    type
                }}
            }}"#
        );

        debug!(mci_gt = mci_gt, limit = limit, "Fetching messages from MCI stream");

        let response: SnapshotMessagesResponse = self.fetch_graphql(&query).await?;
        Ok(response.data.map(|d| d.messages).unwrap_or_default())
    }

    /// Fetch proposals by IDs
    #[instrument(name = "fetch_proposals_by_ids", skip(self))]
    pub async fn fetch_proposals_by_ids(
        &self,
        proposal_ids: &[String],
    ) -> Result<Vec<SnapshotProposal>> {
        if proposal_ids.is_empty() {
            return Ok(Vec::new());
        }

        let ids_str = proposal_ids
            .iter()
            .map(|id| format!("\"{}\"", id))
            .collect::<Vec<_>>()
            .join(",");

        let limit = proposal_ids.len();
        let query = format!(
            r#"
            {{
                proposals(
                    where: {{
                        id_in: [{ids_str}]
                    }},
                    first: {limit},
                    orderBy: "created",
                    orderDirection: asc
                ) {{
                    id
                    author
                    title
                    body
                    discussion
                    choices
                    scores_state
                    privacy
                    created
                    start
                    end
                    quorum
                    link
                    state
                    type
                    flagged
                    ipfs
                    votes
                    space {{
                        id
                    }}
                }}
            }}"#
        );

        debug!(count = proposal_ids.len(), "Fetching proposals by IDs");

        let response: SnapshotProposalsResponse = self.fetch_graphql(&query).await?;
        Ok(response.data.map(|d| d.proposals).unwrap_or_default())
    }

    /// Fetch votes by IDs
    #[instrument(name = "fetch_votes_by_ids", skip(self))]
    pub async fn fetch_votes_by_ids(
        &self,
        vote_ids: &[String],
    ) -> Result<Vec<SnapshotVote>> {
        if vote_ids.is_empty() {
            return Ok(Vec::new());
        }

        let ids_str = vote_ids
            .iter()
            .map(|id| format!("\"{}\"", id))
            .collect::<Vec<_>>()
            .join(",");

        let limit = vote_ids.len();
        let query = format!(
            r#"
            {{
                votes(
                    where: {{
                        id_in: [{ids_str}]
                    }},
                    first: {limit},
                    orderBy: "created",
                    orderDirection: asc
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
                    space {{
                        id
                    }}
                }}
            }}"#
        );

        debug!(count = vote_ids.len(), "Fetching votes by IDs");

        let response: SnapshotVotesResponse = self.fetch_graphql(&query).await?;
        Ok(response.data.and_then(|d| d.votes).unwrap_or_default())
    }

    /// Execute a GraphQL query with rate limiting
    async fn fetch_graphql<T>(&self, query: &str) -> Result<T>
    where
        T: for<'de> serde::Deserialize<'de>,
    {
        // Wait for rate limiter before making request
        RATE_LIMITER.acquire().await;

        let response = self
            .client
            .post(&self.endpoint)
            .header("Content-Type", "application/json")
            .body(serde_json::to_string(&serde_json::json!({"query": query}))?)
            .header("User-Agent", "proposals.app/1.0")
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await?;
            return Err(anyhow::anyhow!(
                "Snapshot API error: status={}, body={}",
                status,
                text
            ));
        }

        let response_body = response.text().await?;
        // debug!("Response body: {}", response_body);

        let parsed: T = serde_json::from_str(&response_body)?;
        Ok(parsed)
    }
}
