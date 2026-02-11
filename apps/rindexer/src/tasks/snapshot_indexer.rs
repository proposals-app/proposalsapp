use crate::extensions::{
    db_extension::{
        DAO_SLUG_GOVERNOR_SPACE_MAP, DAO_SLUG_GOVERNOR_TYPE_ID_MAP, DAO_SLUG_ID_MAP, DB,
        store_snapshot_proposal, store_votes,
    },
    snapshot_api::SnapshotApi,
};
use anyhow::{Context, Result};
use chrono::{Duration, Utc};
use proposalsapp_db::models::{proposal, sea_orm_active_enums::ProposalState, vote};
use sea_orm::{
    ColumnTrait, EntityTrait, PaginatorTrait, QueryFilter, QueryOrder,
    prelude::{Expr, Uuid},
};
use std::time::Duration as StdDuration;
use tracing::{debug, error, info, instrument, warn};

// Constants
const REFRESH_INTERVAL: StdDuration = StdDuration::from_secs(60);
const HIDDEN_VOTE_MAX_RETRIES: usize = 15;
const HIDDEN_VOTE_RETRY_DELAY_SECONDS: u64 = 60;

/// Main entry point for periodic snapshot indexing
#[instrument(name = "run_periodic_snapshot_indexing", skip_all)]
pub async fn run_periodic_snapshot_indexing() -> Result<()> {
    info!("Starting simplified snapshot indexing with cursors");

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

                for (gov_type, &governor_id) in governor_types {
                    if gov_type.ends_with("_SNAPSHOT") {
                        let Some(space) =
                            governor_space_map.get(&(dao_slug.clone(), gov_type.clone()))
                        else {
                            error!(dao_slug = %dao_slug, governor_type = %gov_type, "Snapshot space not found");
                            continue;
                        };
                        snapshot_governors.push((dao_id, governor_id, space.clone()));
                    }
                }
            }
            snapshot_governors
        };

        if snapshot_governors.is_empty() {
            info!("No SNAPSHOT governors configured");
        } else {
            info!(
                governor_count = snapshot_governors.len(),
                "Found SNAPSHOT governors"
            );

            for (dao_id, governor_id, space) in snapshot_governors {
                // Index proposals
                if let Err(e) = index_proposals(&space, governor_id, dao_id).await {
                    error!(space = %space, error = %e, "Failed to index proposals");
                }

                // Index votes
                if let Err(e) = index_votes(&space, governor_id, dao_id).await {
                    error!(space = %space, error = %e, "Failed to index votes");
                }

                // Reconcile vote counts for active proposals
                if let Err(e) = reconcile_active_proposal_votes(&space, governor_id, dao_id).await {
                    error!(space = %space, error = %e, "Failed to reconcile votes");
                }
            }
        }

        tokio::time::sleep(REFRESH_INTERVAL).await;
    }
}

/// Index proposals using cursor-based pagination + refresh active proposals
#[instrument(name = "index_proposals", skip_all, fields(space = space))]
async fn index_proposals(space: &str, governor_id: Uuid, dao_id: Uuid) -> Result<()> {
    let api = SnapshotApi::new();

    // Get cursor or start from 1 year ago
    let cursor = get_proposal_cursor(space).await?;
    info!(space = %space, cursor = cursor, "Starting proposal indexing");

    // Fetch next batch of proposals chronologically
    let proposals = api.fetch_proposals_after(space, cursor, 100).await?;

    if !proposals.is_empty() {
        info!(space = %space, count = proposals.len(), "Fetched proposals");

        // Store all proposals
        for proposal in &proposals {
            if let Err(e) = store_snapshot_proposal(proposal.clone(), governor_id, dao_id).await {
                error!(proposal_id = %proposal.id, error = %e, "Failed to store proposal");
            }
        }

        // Log the latest proposal timestamp (cursor is now from database)
        if let Some(last) = proposals.last() {
            debug!(space = %space, latest_created = last.created, "Processed proposals up to timestamp");
        }
    }

    // Also refresh active proposals (regardless of cursor)
    refresh_active_proposals(space, governor_id, dao_id).await?;

    Ok(())
}

/// Refresh active proposals to get latest state/vote counts
#[instrument(name = "refresh_active_proposals", skip_all)]
async fn refresh_active_proposals(space: &str, governor_id: Uuid, dao_id: Uuid) -> Result<()> {
    let api = SnapshotApi::new();

    // Fetch proposals that might still be changing
    let active_proposals = api.fetch_active_proposals(space).await?;

    if !active_proposals.is_empty() {
        info!(space = %space, active_count = active_proposals.len(), "Refreshing active proposals");

        for proposal in active_proposals {
            if let Err(e) = store_snapshot_proposal(proposal, governor_id, dao_id).await {
                error!(error = %e, "Failed to update active proposal");
            }
        }
    }

    Ok(())
}

/// Index votes using cursor-based pagination by space
#[instrument(name = "index_votes", skip_all, fields(space = space))]
async fn index_votes(space: &str, governor_id: Uuid, dao_id: Uuid) -> Result<()> {
    let api = SnapshotApi::new();

    // Get vote cursor or start from 1 year ago
    let cursor = get_vote_cursor(space).await?;
    info!(space = %space, cursor = cursor, "Starting vote indexing");

    // Fetch votes directly by space and created time
    let votes = api.fetch_votes_after(space, cursor, 500).await?;

    if !votes.is_empty() {
        info!(space = %space, vote_count = votes.len(), "Fetched votes");

        // Get cursor before moving votes
        let last_cursor = votes.last().map(|v| v.created);

        // Convert SnapshotVotes to ActiveModels and persist before reconciliation runs.
        let vote_count = votes.len();
        let mut vote_models = Vec::new();
        for vote in votes {
            match vote.to_active_model(governor_id, dao_id) {
                Ok(Some(vote_model)) => vote_models.push(vote_model),
                Ok(None) => {
                    debug!(voter = %vote.voter, "Skipped invalid vote");
                }
                Err(e) => {
                    error!(voter = %vote.voter, error = %e, "Failed to convert vote");
                }
            }
        }

        if !vote_models.is_empty() {
            match store_votes(vote_models, governor_id).await {
                Ok(()) => {
                    info!(vote_count = vote_count, "Successfully stored votes");
                }
                Err(e) => {
                    error!(error = %e, vote_count = vote_count, "Failed to store votes");
                }
            }
        }

        // Log the latest vote timestamp (cursor is now from database)
        if let Some(cursor) = last_cursor {
            debug!(space = %space, latest_created = cursor, "Processed votes up to timestamp");
        }
    }

    // Handle shutter proposals that just ended
    refetch_ended_shutter_votes(space, governor_id, dao_id).await?;

    Ok(())
}

/// Re-fetch votes for shutter proposals that recently ended (votes are now decrypted)
#[instrument(name = "refetch_ended_shutter_votes", skip_all)]
async fn refetch_ended_shutter_votes(space: &str, governor_id: Uuid, dao_id: Uuid) -> Result<()> {
    let db = DB.get().context("DB not initialized")?;

    // Find shutter proposals that ended in the last 2 hours
    let two_hours_ago = (Utc::now() - Duration::hours(2)).naive_utc();
    let now = Utc::now().naive_utc();

    let ended_shutter = proposal::Entity::find()
        .filter(proposal::Column::GovernorId.eq(governor_id))
        .filter(Expr::cust(r#"metadata->>'privacy' = 'shutter'"#))
        .filter(proposal::Column::EndAt.between(two_hours_ago, now))
        .all(db)
        .await?;

    if !ended_shutter.is_empty() {
        info!(space = %space, shutter_count = ended_shutter.len(), "Re-fetching votes for ended shutter proposals");

        let api = SnapshotApi::new();

        // Re-fetch votes for these proposals with retry until choices are decrypted
        for proposal in ended_shutter {
            let votes = api
                .fetch_proposal_votes_with_retry(
                    &proposal.external_id,
                    HIDDEN_VOTE_MAX_RETRIES,
                    HIDDEN_VOTE_RETRY_DELAY_SECONDS,
                )
                .await?;

            // Only refresh proposal data if votes were successfully retrieved and revealed
            if !votes.is_empty() && !votes.iter().any(|vote| vote.has_hidden_choice()) {
                // Refresh the proposal itself to get updated state/scores after votes are revealed
                if let Ok(Some(updated_proposal)) =
                    api.fetch_proposal_by_id(&proposal.external_id).await
                {
                    if let Err(e) =
                        store_snapshot_proposal(updated_proposal, governor_id, dao_id).await
                    {
                        error!(proposal_id = %proposal.external_id, error = %e, "Failed to refresh shutter proposal after vote reveal");
                    } else {
                        debug!(proposal_id = %proposal.external_id, "Refreshed shutter proposal data after vote reveal");
                    }
                }
            }

            if !votes.is_empty() {
                info!(proposal_id = %proposal.external_id, vote_count = votes.len(), "Re-fetched shutter votes");

                // Store votes in background
                tokio::spawn({
                    let votes = votes.clone();
                    async move {
                        // Convert SnapshotVotes to ActiveModels
                        let mut vote_models = Vec::new();
                        for vote in votes {
                            match vote.to_active_model(governor_id, dao_id) {
                                Ok(Some(vote_model)) => vote_models.push(vote_model),
                                Ok(None) => {
                                    debug!(voter = %vote.voter, "Skipped invalid shutter vote");
                                }
                                Err(e) => {
                                    error!(voter = %vote.voter, error = %e, "Failed to convert shutter vote");
                                }
                            }
                        }

                        if !vote_models.is_empty()
                            && let Err(e) = store_votes(vote_models, governor_id).await
                        {
                            error!(error = %e, "Failed to store re-fetched shutter votes");
                        }
                    }
                });
            }

            // Rate limit between shutter re-fetches
            tokio::time::sleep(StdDuration::from_secs(1)).await;
        }
    }

    Ok(())
}

/// Get proposal cursor from latest proposal created_at in database
async fn get_proposal_cursor(space: &str) -> Result<i64> {
    let db = DB.get().context("DB not initialized")?;

    // Find the governor_id for this space (release locks before async operations)
    let governor_id = {
        let governor_space_map = DAO_SLUG_GOVERNOR_SPACE_MAP.lock().unwrap();
        governor_space_map
            .iter()
            .find(|(_, mapped_space)| *mapped_space == space)
            .and_then(|((dao_slug, gov_type), _)| {
                let dao_governor_map = DAO_SLUG_GOVERNOR_TYPE_ID_MAP
                    .get()
                    .context("DAO_SLUG_GOVERNOR_TYPE_ID_MAP not initialized")
                    .ok()?
                    .lock()
                    .unwrap();
                dao_governor_map.get(dao_slug)?.get(gov_type).copied()
            })
    };

    if let Some(governor_id) = governor_id {
        // Get the latest proposal created_at timestamp for this governor
        let latest_proposal = proposal::Entity::find()
            .filter(proposal::Column::GovernorId.eq(governor_id))
            .order_by_desc(proposal::Column::CreatedAt)
            .one(db)
            .await?;

        if let Some(proposal) = latest_proposal {
            let cursor = proposal.created_at.and_utc().timestamp();
            debug!(space = %space, cursor = cursor, "Using proposal cursor from database");
            return Ok(cursor);
        }
    }

    // Default to 10 years ago if no proposals found
    let one_year_ago = (Utc::now() - Duration::days(10 * 365)).timestamp();
    debug!(space = %space, cursor = one_year_ago, "Using default proposal cursor (1 year ago)");
    Ok(one_year_ago)
}

/// Get vote cursor from latest vote created_at in database
async fn get_vote_cursor(space: &str) -> Result<i64> {
    let db = DB.get().context("DB not initialized")?;

    // Find the governor_id for this space (release locks before async operations)
    let governor_id = {
        let governor_space_map = DAO_SLUG_GOVERNOR_SPACE_MAP.lock().unwrap();
        governor_space_map
            .iter()
            .find(|(_, mapped_space)| *mapped_space == space)
            .and_then(|((dao_slug, gov_type), _)| {
                let dao_governor_map = DAO_SLUG_GOVERNOR_TYPE_ID_MAP
                    .get()
                    .context("DAO_SLUG_GOVERNOR_TYPE_ID_MAP not initialized")
                    .ok()?
                    .lock()
                    .unwrap();
                dao_governor_map.get(dao_slug)?.get(gov_type).copied()
            })
    };

    if let Some(governor_id) = governor_id {
        // Get the latest vote created_at timestamp for this governor
        let latest_vote = vote::Entity::find()
            .filter(vote::Column::GovernorId.eq(governor_id))
            .order_by_desc(vote::Column::CreatedAt)
            .one(db)
            .await?;

        if let Some(vote) = latest_vote {
            let cursor = vote.created_at.and_utc().timestamp();
            debug!(space = %space, cursor = cursor, "Using vote cursor from database");
            return Ok(cursor);
        }
    }

    // Default to 10 years ago if no votes found
    let one_year_ago = (Utc::now() - Duration::days(10 * 365)).timestamp();
    debug!(space = %space, cursor = one_year_ago, "Using default vote cursor (1 year ago)");
    Ok(one_year_ago)
}

/// Reconcile vote counts for active proposals by comparing DB counts with Snapshot API counts.
/// If a mismatch is detected, re-fetches all votes for the proposal using skip-based pagination.
#[instrument(name = "reconcile_active_proposal_votes", skip_all, fields(space = space))]
async fn reconcile_active_proposal_votes(
    space: &str,
    governor_id: Uuid,
    dao_id: Uuid,
) -> Result<()> {
    let db = DB.get().context("DB not initialized")?;

    // Find active proposals for this governor
    let active_proposals = proposal::Entity::find()
        .filter(proposal::Column::GovernorId.eq(governor_id))
        .filter(proposal::Column::ProposalState.eq(ProposalState::Active))
        .all(db)
        .await?;

    for prop in active_proposals {
        // Get expected vote count from metadata
        let expected_count = prop
            .metadata
            .as_ref()
            .and_then(|m| m.get("snapshot_vote_count"))
            .and_then(|v| v.as_u64());

        let Some(expected_count) = expected_count else {
            continue;
        };

        // Count actual votes in DB
        let db_count = vote::Entity::find()
            .filter(vote::Column::ProposalId.eq(prop.id))
            .count(db)
            .await?;

        if db_count < expected_count {
            warn!(
                space = %space,
                proposal_id = %prop.external_id,
                expected = expected_count,
                actual = db_count,
                delta = expected_count - db_count,
                "Vote count mismatch detected, reconciling"
            );

            let api = SnapshotApi::new();
            let votes = api.fetch_all_proposal_votes(&prop.external_id).await?;

            let mut vote_models = Vec::new();
            for vote in votes {
                match vote.to_active_model(governor_id, dao_id) {
                    Ok(Some(m)) => vote_models.push(m),
                    Ok(None) => {}
                    Err(e) => error!(error = %e, "Failed to convert reconciliation vote"),
                }
            }

            if !vote_models.is_empty() {
                store_votes(vote_models, governor_id).await?;
                info!(
                    space = %space,
                    proposal_id = %prop.external_id,
                    "Reconciliation complete"
                );
            }
        }
    }

    Ok(())
}
