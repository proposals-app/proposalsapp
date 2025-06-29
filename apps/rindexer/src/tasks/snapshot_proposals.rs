use crate::extensions::{
    db_extension::{
        DAO_SLUG_GOVERNOR_SPACE_MAP, DAO_SLUG_GOVERNOR_TYPE_ID_MAP, DAO_SLUG_ID_MAP, store_proposal,
    },
    snapshot_api::{SNAPSHOT_API_HANDLER, SnapshotProposal},
};
use anyhow::{Context, Result};
use chrono::DateTime;
use proposalsapp_db::models::{proposal, sea_orm_active_enums::ProposalState};
use sea_orm::{ActiveValue::NotSet, Set, prelude::Uuid};
use serde_json::json;
use std::time::Duration;
use tracing::{debug, error, info, instrument};

// Constants
const REFRESH_INTERVAL: Duration = Duration::from_secs(60);
const BATCH_SIZE: usize = 10;

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

#[instrument(name = "update_snapshot_proposals", skip(dao_id, governor_id, space))]
pub async fn update_snapshot_proposals(
    dao_id: Uuid,
    governor_id: Uuid,
    space: String,
) -> Result<()> {
    info!(space = %space, "Running task to fetch latest snapshot proposals for space.");

    // Continuously refresh all proposals in a paginated way
    let mut current_skip = 0;
    let mut total_processed = 0;

    loop {
        // Fetch a batch of proposals
        let proposals_data = match SNAPSHOT_API_HANDLER
            .get()
            .context("Snapshot API handler not initialized")?
            .fetch_proposals(&space, current_skip, BATCH_SIZE)
            .await
        {
            Ok(proposals) => proposals,
            Err(e) => {
                error!(error = %e, space = %space, "Failed to fetch proposals batch: {}", e);
                break;
            }
        };

        // If no proposals were returned, we're done
        if proposals_data.is_empty() {
            info!(space = %space, "No more proposals to process, task completed for this cycle.");
            break;
        }

        let batch_size = proposals_data.len();
        info!(
            batch_size = batch_size,
            skip = current_skip,
            space = %space,
            "Processing batch of snapshot proposals"
        );

        // Process each proposal in the batch
        let mut batch_success_count = 0;
        for proposal_data in &proposals_data {
            match proposal_data.to_active_model(governor_id, dao_id) {
                Ok(proposal_model) => match store_proposal(proposal_model).await {
                    Ok(_) => {
                        debug!(proposal_id = %proposal_data.id, "Snapshot proposal stored");
                        batch_success_count += 1;
                    }
                    Err(e) => {
                        error!(proposal_id = %proposal_data.id, error = %e, "Failed to store snapshot proposal")
                    }
                },
                Err(e) => {
                    error!(proposal_id = %proposal_data.id, error = %e, "Failed to convert snapshot proposal to active model")
                }
            }
        }

        total_processed += batch_success_count;
        info!(
            space = %space,
            batch_size = batch_size,
            batch_success = batch_success_count,
            total_processed = total_processed,
            "Processed batch of snapshot proposals"
        );

        current_skip += BATCH_SIZE;
    }

    info!(
        "Successfully updated all snapshot proposals from snapshot API for space {}.",
        space
    );
    Ok(())
}

#[instrument(name = "run_periodic_snapshot_proposals_update", skip_all)]
pub async fn run_periodic_snapshot_proposals_update() -> Result<()> {
    info!("Starting periodic task for fetching latest snapshot proposals.");

    loop {
        let snapshot_governors = {
            // Collect governor info synchronously
            let dao_governor_map = DAO_SLUG_GOVERNOR_TYPE_ID_MAP
                .get()
                .context("DAO_SLUG_GOVERNOR_TYPE_ID_MAP not initialized")?
                .lock()
                .unwrap();

            let dao_id_map = DAO_SLUG_ID_MAP
                .get()
                .context("DAO_SLUG_ID_MAP not initialized")?
                .lock()
                .unwrap();

            let governor_space_map = DAO_SLUG_GOVERNOR_SPACE_MAP.lock().unwrap();

            let mut snapshot_governors: Vec<(Uuid, Uuid, String)> = Vec::new();

            for (dao_slug, governor_types) in dao_governor_map.iter() {
                let Some(&dao_id) = dao_id_map.get(dao_slug) else {
                    error!(dao_slug = %dao_slug, "DAO ID not found for slug. Skipping DAO for proposal update.");
                    continue;
                };

                for (gov_type, governor_id) in governor_types.iter() {
                    if gov_type.contains("SNAPSHOT") {
                        // Try to get the space using the tuple (dao_slug, gov_type)
                        let Some(space) =
                            governor_space_map.get(&(dao_slug.clone(), gov_type.clone()))
                        else {
                            error!(dao_slug = %dao_slug, governor_type = %gov_type, "Snapshot space not found for DAO slug and governor type. Skipping governor for proposal update.");
                            continue;
                        };
                        snapshot_governors.push((dao_id, *governor_id, space.clone()));
                    }
                }
            }
            // MutexGuards are dropped automatically here when they go out of scope
            snapshot_governors
        }; // End of synchronous block

        if snapshot_governors.is_empty() {
            info!("No SNAPSHOT governors configured. Skipping periodic proposal update.");
        } else {
            info!(
                governor_count = snapshot_governors.len(),
                "Found SNAPSHOT governors. Updating proposals."
            );
            for (dao_id, governor_id, space) in snapshot_governors {
                info!(dao_id = %dao_id, governor_id = %governor_id, space = %space, "Updating snapshot proposals for governor.");
                match update_snapshot_proposals(dao_id, governor_id, space).await {
                    Ok(_) => {
                        info!(governor_id = %governor_id, "Successfully updated snapshot proposals for governor.")
                    }
                    Err(e) => {
                        error!(governor_id = %governor_id, error = %e, "Failed to update snapshot proposals for governor: {:?}", e)
                    }
                }
            }
        }

        tokio::time::sleep(REFRESH_INTERVAL).await;
    }
}
