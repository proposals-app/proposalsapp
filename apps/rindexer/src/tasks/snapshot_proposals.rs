use crate::extensions::{
    db_extension::{DAO_GOVERNOR_ID_MAP, DAO_ID_SLUG_MAP, store_proposal},
    snapshot_api::SNAPSHOT_API_HANDLER,
};
use anyhow::{Context, Result, anyhow};
use chrono::DateTime;
use proposalsapp_db::models::{proposal_new, sea_orm_active_enums::ProposalState};
use sea_orm::{ActiveValue::NotSet, Set, prelude::Uuid};
use serde::Deserialize;
use serde_json::json;
use std::time::Duration;
use tracing::{error, info, instrument};

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

#[instrument]
pub async fn update_snapshot_proposals() -> Result<()> {
    info!("Running task to fetch latest snapshot proposals");

    let dao_id = DAO_ID_SLUG_MAP
        .get()
        .context("DAO_ID_SLUG_MAP not initialized")?
        .lock()
        .map_err(|_| anyhow!("Failed to acquire DAO_ID_SLUG_MAP lock"))?
        .get("arbitrum")
        .copied()
        .context("DAO not found for slug")?;

    let governor_id = DAO_GOVERNOR_ID_MAP
        .get()
        .context("DAO_GOVERNOR_ID_MAP not initialized")?
        .lock()
        .map_err(|_| anyhow!("Failed to acquire DAO_GOVERNOR_ID_MAP lock"))?
        .get("SNAPSHOT")
        .copied()
        .context("Snapshot proposals governor not found")?;

    // Continuously refresh all proposals in a paginated way
    let mut current_skip = 0;
    const BATCH_SIZE: usize = 10; // Taking max 10 at a time

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
                        space: "arbitrumfoundation.eth"
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
            BATCH_SIZE, current_skip,
        );

        let response: SnapshotProposalsResponse = SNAPSHOT_API_HANDLER
            .get()
            .context("Snapshot API handler not initialized")?
            .fetch("https://hub.snapshot.org/graphql", graphql_query)
            .await
            .context("Failed to fetch proposals from Snapshot API")?;

        let proposals_data = response.data.map(|d| d.proposals).unwrap_or_default();

        if proposals_data.is_empty() {
            info!("No more proposals to process");
            break;
        }

        info!("Processing batch of {} proposals", proposals_data.len());

        for proposal_data in proposals_data {
            let proposal_model = proposal_data.to_active_model(governor_id, dao_id)?;
            store_proposal(proposal_model).await?;
        }

        current_skip += BATCH_SIZE;
    }

    info!("Successfully updated all snapshot proposals");
    Ok(())
}

impl SnapshotProposal {
    fn to_active_model(&self, governor_id: Uuid, dao_id: Uuid) -> Result<proposal_new::ActiveModel> {
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

        Ok(proposal_new::ActiveModel {
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

#[instrument]
pub async fn run_periodic_snapshot_proposals_update() -> Result<()> {
    info!("Starting periodic task for fetching latest snapshot proposals");

    loop {
        match update_snapshot_proposals().await {
            Ok(_) => info!("Successfully updated proposals"),
            Err(e) => error!("Failed to update proposals: {:?}", e),
        }

        tokio::time::sleep(Duration::from_secs(5)).await;
    }
}
