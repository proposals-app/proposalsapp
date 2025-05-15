use crate::extensions::{
    db_extension::{DAO_SLUG_GOVERNOR_TYPE_ID_MAP, DAO_SLUG_ID_MAP, DAO_SLUG_SPACE_MAP, store_proposal},
    snapshot_api::SNAPSHOT_API_HANDLER,
};
use anyhow::{Context, Result};
use chrono::DateTime;
use proposalsapp_db_indexer::models::{proposal, sea_orm_active_enums::ProposalState};
use sea_orm::{ActiveValue::NotSet, Set, prelude::Uuid};
use serde::Deserialize;
use serde_json::json;
use std::time::Duration;
use tracing::{debug, error, info, instrument};

fn get_dao_id(dao_slug: &str) -> Option<Uuid> {
    DAO_SLUG_ID_MAP
        .get()
        .unwrap()
        .lock()
        .unwrap()
        .get(dao_slug)
        .copied()
}

fn get_governor_id(dao_slug: &str) -> Option<Uuid> {
    DAO_SLUG_GOVERNOR_TYPE_ID_MAP
        .get()
        .unwrap()
        .lock()
        .unwrap()
        .get(dao_slug)
        .and_then(|inner_map| {
            inner_map
                .iter()
                .find(|(key, _)| key.contains("SNAPSHOT"))
                .map(|(_, value)| *value)
        })
}

fn get_space(dao_slug: &str) -> Option<String> {
    DAO_SLUG_SPACE_MAP.lock().unwrap().get(dao_slug).cloned()
}

#[derive(Deserialize)]
struct SnapshotProposalsResponse {
    data: Option<SnapshotProposalData>,
}

#[derive(Deserialize)]
struct SnapshotProposalData {
    proposals: Vec<SnapshotProposal>,
}

#[derive(Clone, Deserialize)]
struct SnapshotProposal {
    id: String,
    author: String,
    title: String,
    body: String,
    discussion: String,
    choices: Vec<String>,
    scores_state: String,
    privacy: String,
    created: i64,
    start: i64,
    end: i64,
    quorum: f64,
    link: String,
    state: String,
    #[serde(rename = "type")]
    proposal_type: String,
    flagged: Option<bool>,
    ipfs: String,
}

#[instrument(name = "tasks_update_snapshot_proposals", skip_all)]
pub async fn update_snapshot_proposals(dao_slug: &str) -> Result<()> {
    info!("Running task to fetch latest snapshot proposals for {dao_slug} space.");

    let dao_id = get_dao_id(dao_slug).context(format!("DAO ID not found for slug: {}", dao_slug))?;
    let governor_id = get_governor_id(dao_slug).context(format!("Governor ID not found for slug: {}", dao_slug))?;
    let space = get_space(dao_slug).context(format!("Snapshot space not found for slug: {}", dao_slug))?;

    // Continuously refresh all proposals in a paginated way
    let mut current_skip = 0;
    const BATCH_SIZE: usize = 10;

    loop {
        let graphql_query = format!(
            r#"
            {{
                proposals(
                    first: {},
                    skip: {},
                    orderBy: "created",
                    orderDirection: asc,
                    where: {{
                        space: "{}"
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
            }}"#,
            BATCH_SIZE, current_skip, space
        );

        debug!(
            query = graphql_query,
            "Fetching snapshot proposals with query"
        );

        let response: SnapshotProposalsResponse = SNAPSHOT_API_HANDLER
            .get()
            .context("Snapshot API handler not initialized")?
            .fetch("https://hub.snapshot.org/graphql", graphql_query)
            .await
            .context("Failed to fetch proposals from Snapshot API")?;

        let proposals_data = response.data.map(|d| d.proposals).unwrap_or_default();

        if proposals_data.is_empty() {
            info!(
                "No more proposals to process from snapshot API for space {}, task completed for this cycle.",
                space
            );
            break;
        }

        info!(
            batch_size = proposals_data.len(),
            skip = current_skip,
            space = space,
            "Processing batch of snapshot proposals"
        );

        for proposal_data in &proposals_data {
            // Use a match expression to handle the Result from to_active_model
            match proposal_data.to_active_model(governor_id, dao_id) {
                Ok(proposal_model) => {
                    // Use a match expression to handle the Result from store_proposal
                    match store_proposal(proposal_model).await {
                        Ok(_) => debug!(proposal_id = proposal_data.id, "Snapshot proposal stored"),
                        Err(e) => error!(proposal_id = proposal_data.id, error = %e, "Failed to store snapshot proposal"),
                    }
                }
                Err(e) => error!(proposal_id = proposal_data.id, error = %e, "Failed to convert snapshot proposal to active model"),
            }
        }

        // Only advance skip if we processed a full batch or if the batch size was less than BATCH_SIZE
        // (meaning it was the last batch)
        if proposals_data.len() < BATCH_SIZE {
            info!(
                "Finished processing all proposals for space {} in this cycle.",
                space
            );
            break;
        }
        current_skip += BATCH_SIZE;
    }

    info!(
        "Successfully updated all snapshot proposals from snapshot API for space {}.",
        space
    );
    Ok(())
}

impl SnapshotProposal {
    fn to_active_model(&self, governor_id: Uuid, dao_id: Uuid) -> Result<proposal::ActiveModel> {
        let state = match self.state.as_str() {
            "pending" if self.privacy == "shutter" => ProposalState::Hidden,
            "active" => ProposalState::Active,
            "pending" => ProposalState::Pending,
            "closed" => {
                if self.scores_state == "final" {
                    ProposalState::Executed
                } else {
                    ProposalState::Defeated
                }
            }
            _ => ProposalState::Unknown,
        };

        let created_at = DateTime::from_timestamp(self.created, 0)
            .context("Invalid created timestamp")?
            .naive_utc();
        let start_at = DateTime::from_timestamp(self.start, 0)
            .context("Invalid start timestamp")?
            .naive_utc();
        let end_at = DateTime::from_timestamp(self.end, 0)
            .context("Invalid end timestamp")?
            .naive_utc();

        let mut metadata = json!({
            "vote_type": self.proposal_type,
            "quorum_choices": self.get_quorum_choices(),
            "scores_state": self.scores_state
        });

        if self.privacy == "shutter" {
            metadata["hidden_vote"] = json!(true);
        }

        Ok(proposal::ActiveModel {
            id: NotSet,
            governor_id: Set(governor_id),
            dao_id: Set(dao_id),
            external_id: Set(self.id.clone()),
            name: Set(self.title.clone()),
            body: Set(self.body.clone()),
            url: Set(self.link.clone()),
            discussion_url: Set(Some(self.discussion.clone())),
            choices: Set(json!(self.choices)),
            quorum: Set(self.quorum),
            proposal_state: Set(state),
            marked_spam: Set(self.flagged.unwrap_or(false)),
            created_at: Set(created_at),
            start_at: Set(start_at),
            end_at: Set(end_at),
            block_created_at: NotSet,
            block_start_at: NotSet,
            block_end_at: NotSet,
            txid: Set(Some(self.ipfs.clone())),
            metadata: Set(metadata.into()),
            author: Set(Some(self.author.clone())),
        })
    }

    fn get_quorum_choices(&self) -> Vec<u32> {
        if self.proposal_type == "basic" {
            vec![0, 2] // For basic proposals: [For, Against]
        } else {
            (0..self.choices.len() as u32).collect()
        }
    }
}

#[instrument(name = "tasks_run_periodic_snapshot_proposals_update", skip_all)]
pub async fn run_periodic_snapshot_proposals_update() -> Result<()> {
    info!("Starting periodic task for fetching latest snapshot proposals.");

    loop {
        match update_snapshot_proposals("arbitrum").await {
            Ok(_) => info!("Successfully updated snapshot proposals in periodic task."),
            Err(e) => error!(error = %e, "Failed to update snapshot proposals in periodic task"),
        }

        tokio::time::sleep(Duration::from_secs(60)).await;
    }
}
