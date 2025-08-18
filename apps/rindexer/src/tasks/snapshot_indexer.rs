use crate::extensions::{
    db_extension::{
        DAO_SLUG_GOVERNOR_SPACE_MAP, DAO_SLUG_GOVERNOR_TYPE_ID_MAP, DAO_SLUG_ID_MAP, 
        store_proposal, store_votes, DB,
    },
    snapshot_api::{SnapshotApi, SnapshotProposal},
};
use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use proposalsapp_db::models::proposal;
use sea_orm::{
    ColumnTrait, Condition, EntityTrait, Order, QueryFilter, QueryOrder, QuerySelect,
    prelude::{Expr, Uuid},
};
use std::time::Duration;
use tracing::{debug, error, info, instrument};

// Constants
const REFRESH_INTERVAL: Duration = Duration::from_secs(60);
const PROPOSAL_BATCH_SIZE: usize = 100;

/// Main entry point for periodic snapshot indexing
#[instrument(name = "run_periodic_snapshot_indexing", skip_all)]
pub async fn run_periodic_snapshot_indexing() -> Result<()> {
    info!("Starting simplified periodic snapshot indexing");

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
                    error!(dao_slug = %dao_slug, "DAO ID not found for slug");
                    continue;
                };

                for (gov_type, governor_id) in governor_types.iter() {
                    if gov_type.contains("SNAPSHOT") {
                        let Some(space) = governor_space_map.get(&(dao_slug.clone(), gov_type.clone())) else {
                            error!(dao_slug = %dao_slug, governor_type = %gov_type, "Snapshot space not found");
                            continue;
                        };
                        snapshot_governors.push((dao_id, *governor_id, space.clone()));
                    }
                }
            }
            snapshot_governors
        };

        if snapshot_governors.is_empty() {
            info!("No SNAPSHOT governors configured");
        } else {
            info!(governor_count = snapshot_governors.len(), "Found SNAPSHOT governors");
            
            for (dao_id, governor_id, space) in snapshot_governors {
                if let Err(e) = index_snapshot_space(&space, governor_id, dao_id).await {
                    error!(space = %space, governor_id = %governor_id, error = %e, "Failed to index snapshot space");
                } else {
                    info!(space = %space, governor_id = %governor_id, "Successfully indexed snapshot space");
                }
            }
        }

        tokio::time::sleep(REFRESH_INTERVAL).await;
    }
}

/// Index a complete Snapshot space (proposals + votes)
#[instrument(name = "index_snapshot_space", skip_all, fields(space = space))]
async fn index_snapshot_space(space: &str, governor_id: Uuid, dao_id: Uuid) -> Result<()> {
    info!(space = %space, "Starting to index snapshot space");

    // Step 1: Index all proposals chronologically
    index_proposals(space, governor_id, dao_id).await?;

    // Step 2: Index votes for active/recent proposals
    index_votes(space, governor_id, dao_id).await?;

    info!(space = %space, "Completed indexing snapshot space");
    Ok(())
}

/// Index proposals using cursor-based pagination
#[instrument(name = "index_proposals", skip_all)]
async fn index_proposals(space: &str, governor_id: Uuid, dao_id: Uuid) -> Result<()> {
    let api = SnapshotApi::new();
    
    // Get the last proposal timestamp we've indexed
    let mut cursor = get_latest_proposal_created_at(governor_id).await?;
    let mut total_indexed = 0;

    info!(space = %space, cursor = cursor, "Starting proposal indexing");

    loop {
        let proposals = api.fetch_proposals_after(space, cursor, PROPOSAL_BATCH_SIZE).await?;
        
        if proposals.is_empty() {
            debug!(space = %space, "No more proposals to index");
            break;
        }

        info!(space = %space, batch_size = proposals.len(), cursor = cursor, "Processing proposal batch");

        let mut batch_success = 0;
        for proposal in &proposals {
            match proposal.to_active_model(governor_id, dao_id) {
                Ok(proposal_model) => {
                    match store_proposal(proposal_model).await {
                        Ok(_) => {
                            batch_success += 1;
                            cursor = proposal.created;
                        }
                        Err(e) => error!(proposal_id = %proposal.id, error = %e, "Failed to store proposal"),
                    }
                }
                Err(e) => error!(proposal_id = %proposal.id, error = %e, "Failed to convert proposal"),
            }
        }

        total_indexed += batch_success;
        info!(space = %space, batch_success = batch_success, total_indexed = total_indexed, "Completed proposal batch");
    }

    info!(space = %space, total_indexed = total_indexed, "Completed proposal indexing");
    Ok(())
}

/// Index votes for proposals that need updating
#[instrument(name = "index_votes", skip_all)]
async fn index_votes(space: &str, governor_id: Uuid, dao_id: Uuid) -> Result<()> {
    let api = SnapshotApi::new();

    // Step 1: Index votes for active/recent proposals
    let active_proposals = get_proposals_needing_votes(governor_id).await?;
    info!(space = %space, active_count = active_proposals.len(), "Found proposals needing vote updates");

    for proposal in active_proposals {
        if let Err(e) = index_all_votes_for_proposal(&api, &proposal, governor_id, dao_id).await {
            error!(proposal_id = %proposal.external_id, error = %e, "Failed to index votes for active proposal");
        }
    }

    // Step 2: Re-index recently ended shutter proposals (votes become visible after ending)
    let shutter_proposals = get_recently_ended_shutter_proposals(governor_id).await?;
    info!(space = %space, shutter_count = shutter_proposals.len(), "Found shutter proposals to re-index");

    for proposal in shutter_proposals {
        if let Err(e) = index_all_votes_for_proposal(&api, &proposal, governor_id, dao_id).await {
            error!(proposal_id = %proposal.external_id, error = %e, "Failed to re-index votes for shutter proposal");
        }
    }

    // Step 3: Historical backfill - index votes for proposals missing votes
    let historical_proposals = get_proposals_missing_votes(governor_id).await?;
    info!(space = %space, historical_count = historical_proposals.len(), "Found historical proposals needing vote backfill");

    for proposal in historical_proposals {
        if let Err(e) = index_all_votes_for_proposal(&api, &proposal, governor_id, dao_id).await {
            error!(proposal_id = %proposal.external_id, error = %e, "Failed to backfill votes for historical proposal");
        }
    }

    Ok(())
}

/// Index all votes for a single proposal
#[instrument(name = "index_all_votes_for_proposal", skip(api), fields(proposal_id = proposal.external_id))]
async fn index_all_votes_for_proposal(
    api: &SnapshotApi,
    proposal: &proposal::Model,
    governor_id: Uuid,
    dao_id: Uuid,
) -> Result<()> {
    let votes = api.fetch_all_proposal_votes(&proposal.external_id).await?;
    
    if votes.is_empty() {
        debug!(proposal_id = %proposal.external_id, "No votes found for proposal");
        return Ok(());
    }

    info!(proposal_id = %proposal.external_id, vote_count = votes.len(), "Processing votes for proposal");

    let mut vote_models = Vec::new();
    for vote in votes {
        match vote.to_active_model(governor_id, dao_id) {
            Ok(Some(vote_model)) => vote_models.push(vote_model),
            Ok(None) => debug!(voter = %vote.voter, "Skipped invalid vote"),
            Err(e) => error!(voter = %vote.voter, error = %e, "Failed to convert vote"),
        }
    }

    if !vote_models.is_empty() {
        let stored_count = vote_models.len();
        store_votes(vote_models, governor_id).await?;
        info!(proposal_id = %proposal.external_id, stored_count = stored_count, "Stored votes for proposal");
    }

    Ok(())
}

/// Get the timestamp of the latest proposal we've indexed
#[instrument(name = "get_latest_proposal_created_at", skip_all)]
async fn get_latest_proposal_created_at(governor_id: Uuid) -> Result<i64> {
    let db = DB.get().context("DB not initialized")?;

    let timestamp = proposal::Entity::find()
        .select_only()
        .column_as(
            Expr::cust("COALESCE(MAX(created_at), '1970-01-01 00:00:00+00')::timestamptz"),
            "max_timestamp",
        )
        .filter(proposal::Column::GovernorId.eq(governor_id))
        .into_tuple::<(DateTime<Utc>,)>()
        .one(db)
        .await?
        .map_or(0, |(dt,)| dt.timestamp());

    debug!(governor_id = %governor_id, timestamp = timestamp, "Retrieved latest proposal timestamp");
    Ok(timestamp)
}

/// Get proposals that need vote updates (active or recently ended)
#[instrument(name = "get_proposals_needing_votes", skip_all)]
async fn get_proposals_needing_votes(governor_id: Uuid) -> Result<Vec<proposal::Model>> {
    let db = DB.get().context("DB not initialized")?;
    let now = Utc::now().naive_utc();
    let two_days_ago = (Utc::now() - chrono::Duration::hours(48)).naive_utc();

    let proposals = proposal::Entity::find()
        .filter(proposal::Column::GovernorId.eq(governor_id))
        .filter(
            Condition::any()
                .add(proposal::Column::EndAt.gt(now))  // Still active
                .add(
                    Condition::all()
                        .add(proposal::Column::EndAt.gt(two_days_ago))  // Recently ended
                        .add(proposal::Column::EndAt.lte(now))
                )
        )
        .order_by(proposal::Column::EndAt, Order::Asc)
        .all(db)
        .await?;

    debug!(governor_id = %governor_id, count = proposals.len(), "Found proposals needing votes");
    Ok(proposals)
}

/// Get shutter proposals that recently ended (votes become visible after ending)
#[instrument(name = "get_recently_ended_shutter_proposals", skip_all)]
async fn get_recently_ended_shutter_proposals(governor_id: Uuid) -> Result<Vec<proposal::Model>> {
    let db = DB.get().context("DB not initialized")?;
    let now = Utc::now().naive_utc();
    let yesterday = (Utc::now() - chrono::Duration::hours(24)).naive_utc();

    let proposals = proposal::Entity::find()
        .filter(proposal::Column::GovernorId.eq(governor_id))
        .filter(proposal::Column::EndAt.between(yesterday, now))
        .filter(Expr::cust(r#"metadata->>'hidden_vote' = 'true'"#))
        .filter(Expr::cust(r#"metadata->>'scores_state' = 'final'"#))
        .order_by(proposal::Column::EndAt, Order::Desc)
        .all(db)
        .await?;

    debug!(governor_id = %governor_id, count = proposals.len(), "Found shutter proposals to re-index");
    Ok(proposals)
}

/// Get historical proposals that have no votes indexed yet (for backfill)
#[instrument(name = "get_proposals_missing_votes", skip_all)]
async fn get_proposals_missing_votes(governor_id: Uuid) -> Result<Vec<proposal::Model>> {
    let db = DB.get().context("DB not initialized")?;

    // Find proposals that have no votes in our database
    // Focus on older proposals that ended more than 48 hours ago (not covered by other methods)
    let two_days_ago = (Utc::now() - chrono::Duration::hours(48)).naive_utc();
    
    let proposals = proposal::Entity::find()
        .filter(proposal::Column::GovernorId.eq(governor_id))
        .filter(proposal::Column::EndAt.lt(two_days_ago)) // Older than 48 hours
        .filter(
            // Find proposals where we have NO votes at all
            Expr::cust(&format!(
                r#"NOT EXISTS (
                    SELECT 1 FROM vote v 
                    WHERE v.proposal_id = proposal.id 
                    AND v.governor_id = '{}'
                )"#, governor_id
            ))
        )
        .order_by(proposal::Column::EndAt, Order::Desc) // Start with most recent
        .limit(20) // Limit to avoid overwhelming the API - process 20 at a time
        .all(db)
        .await?;

    debug!(governor_id = %governor_id, count = proposals.len(), "Found historical proposals missing votes");
    Ok(proposals)
}

impl SnapshotProposal {
    fn to_active_model(&self, governor_id: Uuid, dao_id: Uuid) -> Result<proposal::ActiveModel> {
        use proposalsapp_db::models::proposal;
        use proposalsapp_db::models::sea_orm_active_enums::ProposalState;
        use sea_orm::{ActiveValue::NotSet, Set};
        use serde_json::json;

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