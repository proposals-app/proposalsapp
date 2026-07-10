use crate::extensions::{
    db_extension::{
        DAO_SLUG_GOVERNOR_SPACE_MAP, DAO_SLUG_GOVERNOR_TYPE_ID_MAP, DAO_SLUG_ID_MAP, DB,
        store_snapshot_proposal, store_votes,
    },
    snapshot_api::{SnapshotApi, SnapshotVote},
};
use anyhow::{Context, Result};
use chrono::{Duration, Utc};
use proposalsapp_db::models::{proposal, sea_orm_active_enums::ProposalState, vote};
use sea_orm::{
    ActiveModelTrait,
    ActiveValue::Set,
    ColumnTrait, EntityTrait, QueryFilter, QueryOrder, QuerySelect,
    prelude::{Expr, Uuid},
};
use std::collections::{HashMap, HashSet};
use std::time::{Duration as StdDuration, Instant as StdInstant};
use tracing::{debug, error, info, instrument, warn};

// Constants
const REFRESH_INTERVAL: StdDuration = StdDuration::from_secs(60);
const FULL_PROPOSAL_SYNC_INTERVAL: StdDuration = StdDuration::from_secs(6 * 60 * 60);
const HIDDEN_VOTE_MAX_RETRIES: usize = 15;
const HIDDEN_VOTE_RETRY_DELAY_SECONDS: u64 = 60;
const VOTE_CURSOR_OVERLAP_SECONDS: i64 = 300;
const PROPOSAL_PAGE_SIZE: usize = 1_000;
const VOTE_PAGE_SIZE: usize = 1_000;
const MAX_RECONCILIATIONS_PER_SPACE_PER_CYCLE: usize = 32;

fn vote_cursor_with_overlap(cursor: i64) -> i64 {
    (cursor - VOTE_CURSOR_OVERLAP_SECONDS).max(0)
}

fn should_reconcile_snapshot_votes(expected_count: u64, current_voter_count: u64) -> bool {
    current_voter_count != expected_count
}

fn should_fetch_next_vote_page(page_len: usize, page_size: usize) -> bool {
    page_len == page_size
}

/// Main entry point for periodic snapshot indexing
#[instrument(name = "run_periodic_snapshot_indexing", skip_all)]
pub async fn run_periodic_snapshot_indexing() -> Result<()> {
    info!("Starting simplified snapshot indexing with cursors");
    let mut last_full_proposal_sync: Option<StdInstant> = None;

    loop {
        let full_proposal_sync_due = last_full_proposal_sync
            .is_none_or(|last_sync| last_sync.elapsed() >= FULL_PROPOSAL_SYNC_INTERVAL);
        let mut full_proposal_sync_succeeded = true;
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

                if full_proposal_sync_due
                    && let Err(e) = sync_all_snapshot_proposals(&space, governor_id, dao_id).await
                {
                    full_proposal_sync_succeeded = false;
                    error!(space = %space, error = %e, "Failed to fully synchronize Snapshot proposals");
                }

                // Index votes
                if let Err(e) = index_votes(&space, governor_id, dao_id).await {
                    error!(space = %space, error = %e, "Failed to index votes");
                }

                // Update ended snapshot proposals that are still marked as ACTIVE
                if let Err(e) = update_ended_snapshot_proposals(&space, governor_id, dao_id).await {
                    error!(space = %space, error = %e, "Failed to update ended snapshot proposals");
                }

                // Repair bounded vote-count gaps across the complete proposal history.
                if let Err(e) = reconcile_snapshot_vote_gaps(&space, governor_id, dao_id).await {
                    error!(space = %space, error = %e, "Failed to reconcile Snapshot vote gaps");
                }
            }

            if full_proposal_sync_due && full_proposal_sync_succeeded {
                last_full_proposal_sync = Some(StdInstant::now());
            }
        }

        tokio::time::sleep(REFRESH_INTERVAL).await;
    }
}

/// Refresh metadata for the complete current proposal history.
///
/// Older rows can predate fields used by vote reconciliation, so a cursor-only
/// importer is not sufficient for a durable backfill.
#[instrument(name = "sync_all_snapshot_proposals", skip_all, fields(space = space))]
async fn sync_all_snapshot_proposals(space: &str, governor_id: Uuid, dao_id: Uuid) -> Result<()> {
    let api = SnapshotApi::new();
    let mut skip = 0;
    let mut provider_ids = HashSet::new();

    loop {
        let proposals = api
            .fetch_space_proposals_page(space, skip, PROPOSAL_PAGE_SIZE)
            .await?;
        let page_len = proposals.len();
        if page_len == 0 {
            break;
        }

        for proposal in proposals {
            provider_ids.insert(proposal.id.clone());
            store_snapshot_proposal(proposal, governor_id, dao_id).await?;
        }
        skip += page_len;
        if page_len < PROPOSAL_PAGE_SIZE {
            break;
        }
    }

    if provider_ids.is_empty() {
        anyhow::bail!("Snapshot returned no proposals for configured space {space}");
    }

    let db = DB.get().context("DB not initialized")?;
    let unavailable_proposals = proposal::Entity::find()
        .filter(proposal::Column::GovernorId.eq(governor_id))
        .filter(proposal::Column::ExternalId.is_not_in(provider_ids.iter().cloned()))
        .all(db)
        .await?;
    for unavailable in unavailable_proposals {
        if unavailable.proposal_state != ProposalState::Defeated {
            let mut active_model: proposal::ActiveModel = unavailable.into();
            active_model.proposal_state = Set(ProposalState::Defeated);
            active_model.update(db).await?;
        }
    }

    info!(
        space = %space,
        proposal_count = provider_ids.len(),
        "Fully synchronized Snapshot proposal metadata"
    );
    Ok(())
}

/// Index proposals using cursor-based pagination + refresh active proposals
#[instrument(name = "index_proposals", skip_all, fields(space = space))]
async fn index_proposals(space: &str, governor_id: Uuid, dao_id: Uuid) -> Result<()> {
    let api = SnapshotApi::new();

    // Get cursor or start from 1 year ago
    let cursor = get_proposal_cursor(space).await?;
    info!(space = %space, cursor = cursor, "Starting proposal indexing");

    let mut skip = 0;
    let mut fetched_count = 0;
    loop {
        let proposals = api
            .fetch_proposals_after_page(space, cursor, skip, PROPOSAL_PAGE_SIZE)
            .await?;
        let page_len = proposals.len();
        if page_len == 0 {
            break;
        }

        for proposal in proposals {
            let proposal_id = proposal.id.clone();
            store_snapshot_proposal(proposal, governor_id, dao_id)
                .await
                .with_context(|| format!("Failed to store Snapshot proposal {proposal_id}"))?;
        }
        fetched_count += page_len;
        skip += page_len;
        if page_len < PROPOSAL_PAGE_SIZE {
            break;
        }
    }

    if fetched_count > 0 {
        info!(space = %space, fetched_count, "Indexed Snapshot proposals");
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
            let proposal_id = proposal.id.clone();
            store_snapshot_proposal(proposal, governor_id, dao_id)
                .await
                .with_context(|| format!("Failed to refresh active proposal {proposal_id}"))?;
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

    // Paginate the complete overlap window in one cycle. Fetching only the first
    // page can permanently skip votes when more than one page shares a timestamp.
    let mut skip = 0;
    let mut fetched_count = 0;
    loop {
        let votes = api
            .fetch_votes_after_page(space, cursor, skip, VOTE_PAGE_SIZE)
            .await?;
        let page_len = votes.len();
        if page_len == 0 {
            break;
        }

        let latest_created = votes.last().map(|vote| vote.created);
        persist_snapshot_votes(votes, governor_id, dao_id).await?;
        fetched_count += page_len;
        skip += page_len;

        if let Some(latest_created) = latest_created {
            debug!(space = %space, latest_created, "Processed Snapshot vote page");
        }
        if !should_fetch_next_vote_page(page_len, VOTE_PAGE_SIZE) {
            break;
        }
    }

    if fetched_count > 0 {
        info!(space = %space, fetched_count, "Indexed Snapshot vote window");
    }

    // Handle shutter proposals that just ended
    refetch_ended_shutter_votes(space, governor_id, dao_id).await?;

    Ok(())
}

async fn persist_snapshot_votes(
    votes: Vec<SnapshotVote>,
    governor_id: Uuid,
    dao_id: Uuid,
) -> Result<usize> {
    let received_count = votes.len();
    let mut vote_models = Vec::with_capacity(received_count);

    for vote in votes {
        match vote.to_active_model(governor_id, dao_id) {
            Ok(Some(vote_model)) => vote_models.push(vote_model),
            Ok(None) => anyhow::bail!("Snapshot vote from {} was invalid", vote.voter),
            Err(error) => {
                return Err(error).with_context(|| {
                    format!("Failed to convert Snapshot vote from {}", vote.voter)
                });
            }
        }
    }

    let stored_count = vote_models.len();
    if stored_count > 0 {
        store_votes(vote_models, governor_id).await?;
    }

    debug!(received_count, stored_count, "Persisted Snapshot votes");
    Ok(stored_count)
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
                if let Some(updated_proposal) = api
                    .fetch_proposal_by_id(&proposal.external_id)
                    .await
                    .with_context(|| {
                        format!(
                            "Failed to refresh shutter proposal {}",
                            proposal.external_id
                        )
                    })?
                {
                    store_snapshot_proposal(updated_proposal, governor_id, dao_id)
                        .await
                        .with_context(|| {
                            format!("Failed to store shutter proposal {}", proposal.external_id)
                        })?;
                    debug!(proposal_id = %proposal.external_id, "Refreshed shutter proposal data after vote reveal");
                }
            }

            if !votes.is_empty() {
                info!(proposal_id = %proposal.external_id, vote_count = votes.len(), "Re-fetched shutter votes");

                persist_snapshot_votes(votes, governor_id, dao_id)
                    .await
                    .context("Failed to store re-fetched shutter votes")?;
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
            let cursor = vote_cursor_with_overlap(vote.created_at.and_utc().timestamp());
            debug!(space = %space, cursor = cursor, "Using vote cursor from database");
            return Ok(cursor);
        }
    }

    // Default to 10 years ago if no votes found
    let one_year_ago = (Utc::now() - Duration::days(10 * 365)).timestamp();
    debug!(space = %space, cursor = one_year_ago, "Using default vote cursor (1 year ago)");
    Ok(one_year_ago)
}

/// Update snapshot proposals that are still marked ACTIVE/PENDING in DB but whose end_at has passed.
/// Fetches current state from Snapshot API and updates accordingly.
/// If a proposal no longer exists on Snapshot, marks it as Defeated.
#[instrument(name = "update_ended_snapshot_proposals", skip_all, fields(space = space))]
async fn update_ended_snapshot_proposals(
    space: &str,
    governor_id: Uuid,
    dao_id: Uuid,
) -> Result<()> {
    let db = DB.get().context("DB not initialized")?;
    let now = Utc::now().naive_utc();

    // Find proposals marked ACTIVE or PENDING whose voting period has ended
    let stale_proposals = proposal::Entity::find()
        .filter(proposal::Column::GovernorId.eq(governor_id))
        .filter(
            proposal::Column::ProposalState.is_in([ProposalState::Active, ProposalState::Pending]),
        )
        .filter(proposal::Column::EndAt.lt(now))
        .all(db)
        .await?;

    if stale_proposals.is_empty() {
        return Ok(());
    }

    info!(
        space = %space,
        count = stale_proposals.len(),
        "Found ended snapshot proposals still marked as active/pending"
    );

    let api = SnapshotApi::new();

    for prop in stale_proposals {
        match api.fetch_proposal_by_id(&prop.external_id).await {
            Ok(Some(updated_proposal)) => {
                // Proposal still exists on Snapshot — update with current state
                store_snapshot_proposal(updated_proposal, governor_id, dao_id)
                    .await
                    .with_context(|| {
                        format!(
                            "Failed to update ended Snapshot proposal {}",
                            prop.external_id
                        )
                    })?;
                info!(
                    proposal_id = %prop.external_id,
                    name = %prop.name,
                    "Updated ended snapshot proposal state"
                );
            }
            Ok(None) => {
                // Proposal no longer exists on Snapshot — mark as Defeated
                warn!(
                    proposal_id = %prop.external_id,
                    name = %prop.name,
                    "Proposal no longer exists on Snapshot, marking as Defeated"
                );
                let mut active_model: proposal::ActiveModel = prop.into();
                active_model.proposal_state = Set(ProposalState::Defeated);
                active_model.update(db).await?;
            }
            Err(error) => {
                return Err(error).with_context(|| {
                    format!(
                        "Failed to fetch ended Snapshot proposal {}",
                        prop.external_id
                    )
                });
            }
        }

        // Rate limit API calls
        tokio::time::sleep(StdDuration::from_millis(500)).await;
    }

    Ok(())
}

/// Repair vote-count gaps across the complete Snapshot proposal history.
///
/// The work is bounded per cycle so live indexing remains responsive. Proposals
/// are processed newest-first, and only provider vote IDs missing locally are
/// persisted, avoiding repeated ENS work for millions of existing voters.
#[instrument(name = "reconcile_snapshot_vote_gaps", skip_all, fields(space = space))]
async fn reconcile_snapshot_vote_gaps(space: &str, governor_id: Uuid, dao_id: Uuid) -> Result<()> {
    let db = DB.get().context("DB not initialized")?;
    let proposals = proposal::Entity::find()
        .filter(proposal::Column::GovernorId.eq(governor_id))
        .order_by_desc(proposal::Column::EndAt)
        .all(db)
        .await?;
    let proposal_ids: Vec<Uuid> = proposals.iter().map(|proposal| proposal.id).collect();
    let voter_counts: HashMap<Uuid, u64> = if proposal_ids.is_empty() {
        HashMap::new()
    } else {
        vote::Entity::find()
            .select_only()
            .column(vote::Column::ProposalId)
            .column_as(
                Expr::cust(r#"COUNT(DISTINCT LOWER("voter_address"))"#),
                "voter_count",
            )
            .filter(vote::Column::ProposalId.is_in(proposal_ids))
            .group_by(vote::Column::ProposalId)
            .into_tuple::<(Uuid, i64)>()
            .all(db)
            .await?
            .into_iter()
            .map(|(proposal_id, count)| (proposal_id, count.max(0) as u64))
            .collect()
    };

    let mut reconciled = 0;
    for prop in proposals {
        let expected_count = prop
            .metadata
            .as_ref()
            .and_then(|m| m.get("snapshot_vote_count"))
            .and_then(|v| v.as_u64());
        let Some(expected_count) = expected_count else {
            continue;
        };
        let current_voter_count = voter_counts.get(&prop.id).copied().unwrap_or_default();
        if !should_reconcile_snapshot_votes(expected_count, current_voter_count) {
            continue;
        }

        reconcile_snapshot_proposal_votes(
            space,
            &prop,
            expected_count,
            current_voter_count,
            governor_id,
            dao_id,
        )
        .await?;
        reconciled += 1;
        if reconciled >= MAX_RECONCILIATIONS_PER_SPACE_PER_CYCLE {
            break;
        }
    }

    if reconciled > 0 {
        info!(space = %space, reconciled, "Reconciled Snapshot vote gaps");
    }
    Ok(())
}

async fn reconcile_snapshot_proposal_votes(
    space: &str,
    prop: &proposal::Model,
    expected_count: u64,
    current_voter_count: u64,
    governor_id: Uuid,
    dao_id: Uuid,
) -> Result<()> {
    let db = DB.get().context("DB not initialized")?;
    warn!(
        space = %space,
        proposal_id = %prop.external_id,
        expected = expected_count,
        actual = current_voter_count,
        delta = expected_count - current_voter_count,
        "Snapshot vote gap detected"
    );

    let api = SnapshotApi::new();
    let Some(current_proposal) = api.fetch_proposal_by_id(&prop.external_id).await? else {
        warn!(
            space = %space,
            proposal_id = %prop.external_id,
            "Snapshot proposal no longer exists; preserving its historical votes"
        );
        let mut metadata = prop
            .metadata
            .clone()
            .unwrap_or_else(|| serde_json::json!({}));
        if let Some(metadata_object) = metadata.as_object_mut() {
            metadata_object.insert(
                "snapshot_vote_count".to_string(),
                serde_json::json!(current_voter_count),
            );
            let mut active_model: proposal::ActiveModel = prop.clone().into();
            active_model.metadata = Set(Some(metadata));
            active_model.update(db).await?;
        }
        return Ok(());
    };
    let provider_expected_count = current_proposal.votes.unwrap_or_default();
    store_snapshot_proposal(current_proposal, governor_id, dao_id)
        .await
        .with_context(|| format!("Failed to refresh Snapshot proposal {}", prop.external_id))?;

    let votes = api.fetch_all_proposal_votes(&prop.external_id).await?;
    let provider_count = votes.len() as u64;
    if provider_count != provider_expected_count {
        anyhow::bail!(
            "Snapshot proposal {} reports {} votes but returned {}",
            prop.external_id,
            provider_expected_count,
            provider_count
        );
    }

    let provider_vote_ids: HashSet<String> = votes.iter().map(|vote| vote.ipfs.clone()).collect();
    if provider_vote_ids.len() != votes.len() {
        anyhow::bail!(
            "Snapshot proposal {} returned duplicate vote IDs",
            prop.external_id
        );
    }

    let existing_votes = vote::Entity::find()
        .filter(vote::Column::ProposalId.eq(prop.id))
        .all(db)
        .await?;
    let existing_vote_ids: HashSet<String> = existing_votes
        .iter()
        .filter_map(|vote| vote.txid.clone())
        .collect();
    let stale_vote_row_ids: Vec<Uuid> = existing_votes
        .into_iter()
        .filter(|vote| {
            vote.txid
                .as_ref()
                .is_none_or(|txid| !provider_vote_ids.contains(txid))
        })
        .map(|vote| vote.id)
        .collect();
    let missing_votes: Vec<SnapshotVote> = votes
        .into_iter()
        .filter(|vote| !existing_vote_ids.contains(&vote.ipfs))
        .collect();
    let missing_count = missing_votes.len();

    if missing_count > 0 {
        persist_snapshot_votes(missing_votes, governor_id, dao_id).await?;
    }
    if !stale_vote_row_ids.is_empty() {
        vote::Entity::delete_many()
            .filter(vote::Column::Id.is_in(stale_vote_row_ids.iter().copied()))
            .exec(db)
            .await
            .context("Failed to delete Snapshot votes absent from the provider")?;
    }

    let repaired_voter_count = count_snapshot_proposal_voters(prop.id).await?;
    if repaired_voter_count != provider_expected_count {
        anyhow::bail!(
            "Snapshot proposal {} reconciliation remained incomplete: expected {}, found {}",
            prop.external_id,
            provider_expected_count,
            repaired_voter_count
        );
    }
    info!(
        space = %space,
        proposal_id = %prop.external_id,
        missing_count,
        deleted_count = stale_vote_row_ids.len(),
        repaired_voter_count,
        previous_expected_count = expected_count,
        provider_expected_count,
        "Snapshot proposal vote reconciliation finished"
    );
    Ok(())
}

async fn count_snapshot_proposal_voters(proposal_id: Uuid) -> Result<u64> {
    let db = DB.get().context("DB not initialized")?;
    let count = vote::Entity::find()
        .select_only()
        .column_as(
            Expr::cust(r#"COUNT(DISTINCT LOWER("voter_address"))"#),
            "voter_count",
        )
        .filter(vote::Column::ProposalId.eq(proposal_id))
        .into_tuple::<i64>()
        .one(db)
        .await?
        .unwrap_or_default();
    Ok(count.max(0) as u64)
}

#[cfg(test)]
mod tests {
    use super::{
        VOTE_CURSOR_OVERLAP_SECONDS, should_fetch_next_vote_page, should_reconcile_snapshot_votes,
        vote_cursor_with_overlap,
    };

    #[test]
    fn vote_cursor_applies_overlap_without_going_negative() {
        assert_eq!(
            vote_cursor_with_overlap(1_000),
            1_000 - VOTE_CURSOR_OVERLAP_SECONDS
        );
        assert_eq!(vote_cursor_with_overlap(VOTE_CURSOR_OVERLAP_SECONDS / 2), 0);
    }

    #[test]
    fn reconciliation_uses_current_unique_voter_count() {
        assert!(should_reconcile_snapshot_votes(1_553, 1_544));
        assert!(!should_reconcile_snapshot_votes(1_553, 1_553));
        assert!(should_reconcile_snapshot_votes(1_553, 1_569));
    }

    #[test]
    fn full_vote_pages_continue_pagination() {
        assert!(should_fetch_next_vote_page(1_000, 1_000));
        assert!(!should_fetch_next_vote_page(999, 1_000));
        assert!(!should_fetch_next_vote_page(0, 1_000));
    }
}
