use anyhow::Result;
use reqwest::Client;
use serde::Deserialize;
use tracing::{debug, info, instrument};

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

/// Simplified Snapshot API client
pub struct SnapshotApi {
    client: Client,
}

impl SnapshotApi {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
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
            let votes = self.fetch_proposal_votes_batch(proposal_id, skip, BATCH_SIZE).await?;
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
                }}
            }}"#
        );

        debug!(proposal_id = %proposal_id, skip = skip, limit = limit, "Fetching vote batch");

        let response: SnapshotVotesResponse = self.fetch_graphql(&query).await?;
        Ok(response.data.and_then(|d| d.votes).unwrap_or_default())
    }

    /// Execute a GraphQL query
    async fn fetch_graphql<T>(&self, query: &str) -> Result<T>
    where
        T: for<'de> serde::Deserialize<'de>,
    {
        let response = self
            .client
            .post(SNAPSHOT_GRAPHQL_ENDPOINT)
            .json(&serde_json::json!({"query": query}))
            .header("User-Agent", "proposals.app/1.0")
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "HTTP error {}: {}",
                response.status(),
                response.text().await?
            ));
        }

        let result: T = response.json().await?;
        Ok(result)
    }
}