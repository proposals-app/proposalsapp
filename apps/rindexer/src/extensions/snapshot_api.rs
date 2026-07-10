use anyhow::{Context, Result, bail};
use once_cell::sync::Lazy;
use reqwest::Client;
use serde::{Deserialize, de::DeserializeOwned};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tracing::{debug, info, instrument, warn};

pub const SNAPSHOT_GRAPHQL_ENDPOINT: &str = "https://hub.snapshot.org/graphql";
const MAX_GRAPHQL_SKIP: usize = 5_000;

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
    pub votes: Option<u64>,
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
    /// Check if this vote has a hidden (hex hash) choice indicating encrypted vote
    pub fn has_hidden_choice(&self) -> bool {
        match &self.choice {
            serde_json::Value::String(choice_str) => {
                // Check if it's a hex hash (0x followed by hex characters)
                choice_str.starts_with("0x")
                    && choice_str.len() >= 10
                    && choice_str[2..].chars().all(|c| c.is_ascii_hexdigit())
            }
            _ => false,
        }
    }
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

/// Simplified Snapshot API client
pub struct SnapshotApi {
    client: Client,
}

fn graphql_string_literal(value: &str) -> String {
    serde_json::to_string(value).expect("serializing a string cannot fail")
}

impl SnapshotApi {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    /// Fetch proposals after a given timestamp (cursor-based pagination)
    #[instrument(name = "fetch_proposals_after", skip(self))]
    pub async fn fetch_proposals_after_page(
        &self,
        space: &str,
        after_timestamp: i64,
        skip: usize,
        limit: usize,
    ) -> Result<Vec<SnapshotProposal>> {
        let space_literal = graphql_string_literal(space);
        let query = format!(
            r#"
            {{
                proposals(
                    first: {limit},
                    skip: {skip},
                    where: {{
                        space: {space_literal},
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
                }}
            }}"#
        );

        debug!(space = %space, after_timestamp, skip, limit, "Fetching proposals");

        let response: SnapshotProposalsResponse = self.fetch_graphql(&query).await?;
        Ok(response
            .data
            .context("Snapshot proposals response omitted data")?
            .proposals)
    }

    /// Fetch a page of all current proposals for a space.
    pub async fn fetch_space_proposals_page(
        &self,
        space: &str,
        skip: usize,
        limit: usize,
    ) -> Result<Vec<SnapshotProposal>> {
        let space_literal = graphql_string_literal(space);
        let query = format!(
            r#"
            {{
                proposals(
                    first: {limit},
                    skip: {skip},
                    where: {{ space: {space_literal} }},
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
                }}
            }}"#
        );

        let response: SnapshotProposalsResponse = self.fetch_graphql(&query).await?;
        Ok(response
            .data
            .context("Snapshot space proposals response omitted data")?
            .proposals)
    }

    /// Fetch all votes for a specific proposal (handles pagination internally)
    #[instrument(name = "fetch_all_proposal_votes", skip(self))]
    pub async fn fetch_all_proposal_votes(&self, proposal_id: &str) -> Result<Vec<SnapshotVote>> {
        let mut all_votes = Vec::new();
        let mut created_cursor = 0;
        let mut same_timestamp_skip = 0;
        const BATCH_SIZE: usize = 1_000;

        loop {
            let votes = self
                .fetch_proposal_votes_batch(
                    proposal_id,
                    created_cursor,
                    same_timestamp_skip,
                    BATCH_SIZE,
                )
                .await?;
            if votes.is_empty() {
                break;
            }

            let page_len = votes.len();
            let last_created = votes
                .last()
                .expect("non-empty vote page must have a last vote")
                .created;
            let votes_at_last_timestamp = votes
                .iter()
                .filter(|vote| vote.created == last_created)
                .count();
            if last_created == created_cursor {
                same_timestamp_skip += page_len;
            } else {
                created_cursor = last_created;
                same_timestamp_skip = votes_at_last_timestamp;
            }
            if same_timestamp_skip > MAX_GRAPHQL_SKIP {
                bail!(
                    "Snapshot proposal {proposal_id} has more than {MAX_GRAPHQL_SKIP} votes at timestamp {created_cursor}; exact pagination is not possible with the provider's skip limit"
                );
            }
            all_votes.extend(votes);
            if page_len < BATCH_SIZE {
                break;
            }
        }

        info!(proposal_id = %proposal_id, total_votes = all_votes.len(), "Fetched all votes for proposal");
        Ok(all_votes)
    }

    /// Fetch a batch of votes for a proposal
    async fn fetch_proposal_votes_batch(
        &self,
        proposal_id: &str,
        created_gte: i64,
        skip: usize,
        limit: usize,
    ) -> Result<Vec<SnapshotVote>> {
        let proposal_id_literal = graphql_string_literal(proposal_id);
        let query = format!(
            r#"
            {{
                votes(
                    first: {limit},
                    skip: {skip},
                    where: {{
                        proposal: {proposal_id_literal},
                        created_gte: {created_gte}
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
                }}
            }}"#
        );

        debug!(proposal_id = %proposal_id, created_gte, skip, limit, "Fetching vote batch");

        let response: SnapshotVotesResponse = self.fetch_graphql(&query).await?;
        response
            .data
            .context("Snapshot proposal votes response omitted data")?
            .votes
            .context("Snapshot proposal votes response omitted votes")
    }

    /// Fetch active proposals for a space
    #[instrument(name = "fetch_active_proposals", skip(self))]
    pub async fn fetch_active_proposals(&self, space: &str) -> Result<Vec<SnapshotProposal>> {
        let space_literal = graphql_string_literal(space);
        // Fetch active and pending proposals separately since the API doesn't support arrays for state
        let mut all_proposals = Vec::new();

        // Fetch active proposals
        let active_query = format!(
            r#"
            {{
                proposals(
                    where: {{
                        space: {space_literal},
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
                }}
            }}"#
        );

        debug!(space = %space, "Fetching active proposals");
        let active_response: SnapshotProposalsResponse = self.fetch_graphql(&active_query).await?;
        all_proposals.extend(
            active_response
                .data
                .context("Snapshot active proposals response omitted data")?
                .proposals,
        );

        // Fetch pending proposals
        let pending_query = format!(
            r#"
            {{
                proposals(
                    where: {{
                        space: {space_literal},
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
                }}
            }}"#
        );

        debug!(space = %space, "Fetching pending proposals");
        let pending_response: SnapshotProposalsResponse =
            self.fetch_graphql(&pending_query).await?;
        all_proposals.extend(
            pending_response
                .data
                .context("Snapshot pending proposals response omitted data")?
                .proposals,
        );

        info!(space = %space, active_count = all_proposals.len(), "Fetched active and pending proposals");
        Ok(all_proposals)
    }

    /// Fetch votes after a given timestamp for a space
    #[instrument(name = "fetch_votes_after", skip(self))]
    pub async fn fetch_votes_after_page(
        &self,
        space: &str,
        after_timestamp: i64,
        skip: usize,
        limit: usize,
    ) -> Result<Vec<SnapshotVote>> {
        let space_literal = graphql_string_literal(space);
        let query = format!(
            r#"
            {{
                votes(
                    where: {{
                        space: {space_literal},
                        created_gt: {after_timestamp}
                    }},
                    first: {limit},
                    skip: {skip},
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
                }}
            }}"#
        );

        debug!(space = %space, after_timestamp, skip, limit, "Fetching vote page");

        let response: SnapshotVotesResponse = self.fetch_graphql(&query).await?;
        response
            .data
            .context("Snapshot vote page response omitted data")?
            .votes
            .context("Snapshot vote page response omitted votes")
    }

    /// Fetch a single proposal by ID to refresh its state
    #[instrument(name = "fetch_proposal_by_id", skip(self))]
    pub async fn fetch_proposal_by_id(
        &self,
        proposal_id: &str,
    ) -> Result<Option<SnapshotProposal>> {
        let proposal_id_literal = graphql_string_literal(proposal_id);
        let query = format!(
            r#"
            {{
                proposals(
                    where: {{
                        id: {proposal_id_literal}
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
                }}
            }}"#
        );

        debug!(proposal_id = %proposal_id, "Fetching proposal by ID");

        let response: SnapshotProposalsResponse = self.fetch_graphql(&query).await?;
        Ok(response
            .data
            .context("Snapshot proposal response omitted data")?
            .proposals
            .into_iter()
            .next())
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

    /// Maximum number of retry attempts for transient failures
    const MAX_RETRIES: u32 = 3;
    /// Initial delay between retries (doubles with each attempt)
    const INITIAL_RETRY_DELAY_MS: u64 = 1000;

    /// Execute a GraphQL query with rate limiting and exponential backoff retry
    async fn fetch_graphql<T>(&self, query: &str) -> Result<T>
    where
        T: DeserializeOwned,
    {
        let mut last_error: Option<anyhow::Error> = None;
        let mut retry_delay = Duration::from_millis(Self::INITIAL_RETRY_DELAY_MS);

        for attempt in 0..=Self::MAX_RETRIES {
            // Wait for rate limiter before making request
            RATE_LIMITER.acquire().await;

            let result = self
                .client
                .post(SNAPSHOT_GRAPHQL_ENDPOINT)
                .json(&serde_json::json!({"query": query}))
                .header("User-Agent", "proposals.app/1.0")
                .timeout(Duration::from_secs(30))
                .send()
                .await;

            match result {
                Ok(response) => {
                    let status = response.status();

                    // Handle rate limiting (429) with immediate retry after delay
                    if status.as_u16() == 429 {
                        let retry_after = response
                            .headers()
                            .get("retry-after")
                            .and_then(|v| v.to_str().ok())
                            .and_then(|s| s.parse::<u64>().ok())
                            .unwrap_or(60);

                        warn!(
                            attempt = attempt + 1,
                            max_retries = Self::MAX_RETRIES + 1,
                            retry_after_secs = retry_after,
                            "Snapshot API rate limited, waiting before retry"
                        );

                        tokio::time::sleep(Duration::from_secs(retry_after)).await;
                        continue;
                    }

                    // Retry on server errors (5xx)
                    if status.is_server_error() {
                        let error_text = response.text().await.unwrap_or_default();
                        last_error =
                            Some(anyhow::anyhow!("Server error {}: {}", status, error_text));

                        if attempt < Self::MAX_RETRIES {
                            warn!(
                                attempt = attempt + 1,
                                max_retries = Self::MAX_RETRIES + 1,
                                status = %status,
                                delay_ms = retry_delay.as_millis(),
                                "Snapshot API server error, retrying with backoff"
                            );
                            tokio::time::sleep(retry_delay).await;
                            retry_delay *= 2; // Exponential backoff
                            continue;
                        }
                        // Max retries exhausted for server error
                        return Err(last_error.unwrap());
                    }

                    // Client errors (4xx except 429) are not retried
                    if !status.is_success() {
                        let error_text = response.text().await.unwrap_or_default();
                        return Err(anyhow::anyhow!("HTTP error {}: {}", status, error_text));
                    }

                    let body = response
                        .text()
                        .await
                        .context("Failed to read Snapshot GraphQL response")?;
                    return parse_graphql_response(&body);
                }
                Err(e) => {
                    // Network errors are retried
                    last_error = Some(anyhow::anyhow!("Request failed: {}", e));

                    if attempt < Self::MAX_RETRIES {
                        warn!(
                            attempt = attempt + 1,
                            max_retries = Self::MAX_RETRIES + 1,
                            error = %e,
                            delay_ms = retry_delay.as_millis(),
                            "Snapshot API request failed, retrying with backoff"
                        );
                        tokio::time::sleep(retry_delay).await;
                        retry_delay *= 2; // Exponential backoff
                        continue;
                    }
                }
            }
        }

        Err(last_error.unwrap_or_else(|| anyhow::anyhow!("Max retries exceeded")))
    }
}

fn parse_graphql_response<T: DeserializeOwned>(body: &str) -> Result<T> {
    let value: serde_json::Value =
        serde_json::from_str(body).context("Failed to parse Snapshot GraphQL response as JSON")?;
    if let Some(errors) = value.get("errors").and_then(serde_json::Value::as_array)
        && !errors.is_empty()
    {
        bail!("Snapshot GraphQL returned errors: {}", errors[0]);
    }
    serde_json::from_value(value).context("Failed to decode Snapshot GraphQL response")
}

#[cfg(test)]
mod tests {
    use super::{
        SnapshotApi, SnapshotVotesResponse, graphql_string_literal, parse_graphql_response,
    };

    #[test]
    fn graphql_string_literal_escapes_query_syntax() {
        assert_eq!(
            graphql_string_literal("space\" } ) { votes { id } } #"),
            r#""space\" } ) { votes { id } } #""#
        );
    }

    #[test]
    fn graphql_errors_are_not_treated_as_empty_data() {
        let result = parse_graphql_response::<SnapshotVotesResponse>(
            r#"{"data":null,"errors":[{"message":"rate limited"}]}"#,
        );
        assert!(result.is_err());
    }

    #[tokio::test]
    #[ignore = "calls the real Snapshot GraphQL API"]
    async fn live_snapshot_queries_return_consistent_results() {
        let api = SnapshotApi::new();
        let after = chrono::Utc::now().timestamp() - 365 * 24 * 60 * 60;
        let proposals = api
            .fetch_proposals_after_page("uniswapgovernance.eth", after, 0, 5)
            .await
            .unwrap();
        assert!(!proposals.is_empty());
        let all_proposals = api
            .fetch_space_proposals_page("uniswapgovernance.eth", 0, 1_000)
            .await
            .unwrap();
        assert!(all_proposals.len() >= proposals.len());

        let proposal = proposals
            .into_iter()
            .min_by_key(|proposal| proposal.votes.unwrap_or_default())
            .unwrap();
        let refreshed = api
            .fetch_proposal_by_id(&proposal.id)
            .await
            .unwrap()
            .unwrap();
        let votes = api.fetch_all_proposal_votes(&proposal.id).await.unwrap();
        assert_eq!(votes.len() as u64, refreshed.votes.unwrap_or_default());

        let vote_page = api
            .fetch_votes_after_page("uniswapgovernance.eth", after, 0, 5)
            .await
            .unwrap();
        assert!(vote_page.len() <= 5);

        let large_proposal_id =
            "0xb581f3aed701ae889c1d79406acdf3d653e6eb4323cb5e46635f729e6313da4d";
        let large_proposal = api
            .fetch_proposal_by_id(large_proposal_id)
            .await
            .unwrap()
            .unwrap();
        let large_vote_set = api
            .fetch_all_proposal_votes(large_proposal_id)
            .await
            .unwrap();
        assert_eq!(
            large_vote_set.len() as u64,
            large_proposal.votes.unwrap_or_default()
        );
    }
}
