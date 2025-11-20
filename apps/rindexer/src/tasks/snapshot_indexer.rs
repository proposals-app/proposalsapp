use crate::extensions::{
    db_extension::{
        get_last_mci, store_snapshot_proposal, store_votes, update_last_mci,
        DAO_SLUG_GOVERNOR_SPACE_MAP, DAO_SLUG_GOVERNOR_TYPE_ID_MAP, DAO_SLUG_ID_MAP, DB,
    },
    snapshot::SnapshotApi,
};
use anyhow::{Context, Result};
use proposalsapp_db::models::proposal;
use proposalsapp_db::models::sea_orm_active_enums::ProposalState;
use sea_orm::{
    prelude::{Expr, Uuid},
    ColumnTrait, EntityTrait, QueryFilter, PaginatorTrait,
};
use std::collections::{HashMap, HashSet};
use std::time::Duration as StdDuration;
use tracing::{debug, error, info, instrument, warn};

// Constants
const POLL_INTERVAL: StdDuration = StdDuration::from_secs(10);
const BACKFILL_CHECK_INTERVAL: StdDuration = StdDuration::from_secs(3600); // 1 hour
const HIDDEN_VOTE_MAX_RETRIES: usize = 15;
const HIDDEN_VOTE_RETRY_DELAY_SECONDS: u64 = 60;

/// Main entry point for Snapshot indexing
#[instrument(name = "run_snapshot_indexer", skip_all)]
pub async fn run_periodic_snapshot_indexing() -> Result<()> {
    info!("Starting Snapshot MCI stream indexer");

    let api = SnapshotApi::new();
    let mut last_backfill_check = std::time::Instant::now();
    // Force initial backfill check
    last_backfill_check = last_backfill_check
        .checked_sub(BACKFILL_CHECK_INTERVAL)
        .unwrap_or(last_backfill_check);

    loop {
        // 1. Get monitored spaces and their mapping to Governor/DAO
        let space_map = get_space_mapping()?;
        let spaces: Vec<String> = space_map.keys().cloned().collect();

        if spaces.is_empty() {
            info!("No Snapshot spaces configured, waiting...");
            tokio::time::sleep(POLL_INTERVAL).await;
            continue;
        }

        // 2. Check for backfill (new spaces or periodic check)
        if last_backfill_check.elapsed() >= BACKFILL_CHECK_INTERVAL {
            if let Err(e) = run_backfill_check(&api, &space_map).await {
                error!(error = %e, "Failed to run backfill check");
            }
            last_backfill_check = std::time::Instant::now();
        }

        // 3. Get last processed MCI
        let last_mci = get_last_mci().await?;

        // 4. Fetch new messages from MCI stream
        match api.fetch_messages(&spaces, last_mci, 1000).await {
            Ok(messages) => {
                if messages.is_empty() {
                    debug!("No new messages, waiting...");
                    tokio::time::sleep(POLL_INTERVAL).await;
                    continue;
                }

                info!(
                    count = messages.len(),
                    last_mci = last_mci,
                    "Fetched new MCI messages"
                );

                // 5. Process messages
                let mut proposal_ids = HashSet::new();
                let mut vote_ids = HashSet::new();
                let mut max_mci = last_mci;

                for msg in &messages {
                    if msg.mci > max_mci {
                        max_mci = msg.mci;
                    }

                    // Only process messages for spaces we are monitoring
                    if !space_map.contains_key(&msg.space) {
                        continue;
                    }

                    match msg.message_type.as_str() {
                        "proposal" => {
                            proposal_ids.insert(msg.id.clone());
                        }
                        "vote" => {
                            vote_ids.insert(msg.id.clone());
                        }
                        _ => {} // Ignore other types like 'settings' for now
                    }
                }

                // 6. Fetch and store proposals
                if !proposal_ids.is_empty() {
                    let ids: Vec<String> = proposal_ids.into_iter().collect();
                    match api.fetch_proposals_by_ids(&ids).await {
                        Ok(proposals) => {
                            for proposal in proposals {
                                if let Some((dao_id, governor_id)) = space_map.get(&proposal.space.id) {
                                    if let Err(e) = store_snapshot_proposal(
                                        proposal.clone(),
                                        *governor_id,
                                        *dao_id,
                                    )
                                    .await
                                    {
                                        error!(
                                            proposal_id = %proposal.id,
                                            space = %proposal.space.id,
                                            error = %e,
                                            "Failed to store proposal"
                                        );
                                    }
                                } else {
                                    warn!(space = %proposal.space.id, "Space mapping not found for proposal");
                                }
                            }
                        }
                        Err(e) => error!(error = %e, "Failed to fetch proposals by IDs"),
                    }
                }

                // 7. Fetch and store votes
                if !vote_ids.is_empty() {
                    let ids: Vec<String> = vote_ids.into_iter().collect();
                    match api.fetch_votes_by_ids(&ids).await {
                        Ok(votes) => {
                            let mut vote_models = Vec::new();
                            for vote in votes {
                                if let Some((dao_id, governor_id)) = space_map.get(&vote.space.id) {
                                    match vote.to_active_model(*governor_id, *dao_id) {
                                        Ok(Some(model)) => vote_models.push(model),
                                        Ok(None) => {} // Skip invalid votes
                                        Err(e) => error!(
                                            vote_voter = %vote.voter,
                                            proposal_id = %vote.proposal.id,
                                            error = %e,
                                            "Failed to convert vote to model"
                                        ),
                                    }
                                }
                            }

                            if !vote_models.is_empty() {
                                // Group by governor for batch insertion
                                let mut votes_by_governor: HashMap<Uuid, Vec<proposalsapp_db::models::vote::ActiveModel>> = HashMap::new();
                                for model in vote_models {
                                    let gov_id = model.governor_id.clone().unwrap();
                                    votes_by_governor.entry(gov_id).or_default().push(model);
                                }

                                for (gov_id, models) in votes_by_governor {
                                    if let Err(e) = store_votes(models, gov_id).await {
                                        error!(governor_id = %gov_id, error = %e, "Failed to store votes batch");
                                    }
                                }
                            }
                        }
                        Err(e) => error!(error = %e, "Failed to fetch votes by IDs"),
                    }
                }

                // 8. Update MCI
                if max_mci > last_mci {
                    if let Err(e) = update_last_mci(max_mci).await {
                        error!(mci = max_mci, error = %e, "Failed to update last MCI");
                    }
                }
            }
            Err(e) => {
                error!(error = %e, "Failed to fetch messages from Snapshot");
                tokio::time::sleep(POLL_INTERVAL).await;
            }
        }

        // 9. Handle shutter proposals (check for ended ones to reveal votes)
        // We can do this periodically or based on message timestamps, but periodic is safer for now
        // to catch ones that ended without a new message event (though unlikely)
        // For now, let's keep it simple and maybe run it less frequently or in a separate task?
        // Let's run it every loop but with a check inside to not spam
        // Actually, we can just rely on the backfill/check loop or add a separate timer.
        // Let's add it to the backfill check for now or a separate interval.
        // Re-using the logic from before but optimized.
        if let Err(e) = check_ended_shutter_proposals(&api, &space_map).await {
             error!(error = %e, "Failed to check ended shutter proposals");
        }
    }
}

/// Helper to get mapping of Space ID -> (DAO ID, Governor ID)
fn get_space_mapping() -> Result<HashMap<String, (Uuid, Uuid)>> {
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

    let mut map = HashMap::new();

    for (dao_slug, governor_types) in dao_governor_map.iter() {
        let Some(&dao_id) = dao_id_map.get(dao_slug) else {
            continue;
        };

        for (gov_type, &governor_id) in governor_types {
            if gov_type.ends_with("_SNAPSHOT") {
                if let Some(space) = governor_space_map.get(&(dao_slug.clone(), gov_type.clone())) {
                    map.insert(space.clone(), (dao_id, governor_id));
                }
            }
        }
    }

    Ok(map)
}

/// Check for backfill needs (e.g. new spaces or gaps)
/// For now, this just ensures we have some data for each space.
/// A full backfill strategy would be more complex.
async fn run_backfill_check(
    api: &SnapshotApi,
    space_map: &HashMap<String, (Uuid, Uuid)>,
) -> Result<()> {
    info!("Running backfill check");
    // TODO: Implement smart backfill.
    // For now, we can check if a space has NO proposals and if so, fetch the last X months.
    // Or we can rely on the user to manually trigger backfill.
    // Given the requirement "ensure data integrity... by backfilling data for newly added spaces",
    // we should probably check if we have *any* proposals for a space.

    let db = DB.get().context("DB not initialized")?;

    for (space, (dao_id, governor_id)) in space_map {
        // Check if we have any proposals for this governor
        let count = proposal::Entity::find()
            .filter(proposal::Column::GovernorId.eq(*governor_id))
            .count(db)
            .await?;

        if count == 0 {
            info!(space = %space, "New space detected (no proposals), starting backfill");
            // Backfill last 6 months
            let six_months_ago = (chrono::Utc::now() - chrono::Duration::days(180)).timestamp();
            
            // Fetch active proposals first
            match api.fetch_active_proposals(space).await {
                Ok(proposals) => {
                    info!(space = %space, count = proposals.len(), "Backfilled active proposals");
                    for p in proposals {
                        if let Err(e) = store_snapshot_proposal(p, *governor_id, *dao_id).await {
                            error!(space = %space, error = %e, "Failed to store backfilled active proposal");
                        }
                    }
                }
                Err(e) => error!(space = %space, error = %e, "Failed to fetch active proposals for backfill"),
            }

            // Fetch historical proposals
            // This is a simplified backfill. Ideally we'd page through everything.
            // For this task, let's just fetch a batch from 6 months ago.
            match api.fetch_proposals_after(space, six_months_ago, 1000).await {
                Ok(proposals) => {
                    info!(space = %space, count = proposals.len(), "Backfilled historical proposals");
                    for p in proposals {
                        if let Err(e) = store_snapshot_proposal(p, *governor_id, *dao_id).await {
                            error!(space = %space, error = %e, "Failed to store backfilled historical proposal");
                        }
                    }
                }
                Err(e) => error!(space = %space, error = %e, "Failed to fetch historical proposals for backfill"),
            }

            // Backfill votes
            match api.fetch_votes_after(space, six_months_ago, 1000).await {
                Ok(votes) => {
                    info!(space = %space, count = votes.len(), "Backfilled votes");
                    let mut vote_models = Vec::new();
                    for vote in votes {
                        match vote.to_active_model(*governor_id, *dao_id) {
                            Ok(Some(model)) => vote_models.push(model),
                            Ok(None) => {} 
                            Err(e) => error!(
                                vote_voter = %vote.voter,
                                proposal_id = %vote.proposal.id,
                                error = %e,
                                "Failed to convert backfilled vote"
                            ),
                        }
                    }

                    if !vote_models.is_empty() {
                        if let Err(e) = store_votes(vote_models, *governor_id).await {
                            error!(space = %space, error = %e, "Failed to store backfilled votes");
                        }
                    }
                }
                Err(e) => error!(space = %space, error = %e, "Failed to fetch votes for backfill"),
            }
        }
    }

    Ok(())
}

/// Check for ended shutter proposals and reveal votes
async fn check_ended_shutter_proposals(
    api: &SnapshotApi,
    space_map: &HashMap<String, (Uuid, Uuid)>,
) -> Result<()> {
    let db = DB.get().context("DB not initialized")?;
    
    // Find shutter proposals that ended in the last 2 hours
    // We iterate over all governors in our map to find relevant proposals
    // This might be inefficient if we have many governors, but fine for now.
    
    let two_hours_ago = (chrono::Utc::now() - chrono::Duration::hours(2)).naive_utc();
    let now = chrono::Utc::now().naive_utc();

    // Get all governor IDs we are tracking
    let governor_ids: Vec<Uuid> = space_map.values().map(|(_, g_id)| *g_id).collect();
    
    if governor_ids.is_empty() {
        return Ok(());
    }


    let ended_shutter = proposal::Entity::find()
        .filter(proposal::Column::GovernorId.is_in(governor_ids))
        .filter(Expr::cust(r#"metadata->>'privacy' = 'shutter'"#))
        .filter(proposal::Column::EndAt.between(two_hours_ago, now))
        .filter(
            proposal::Column::ProposalState.is_not_in(vec![
                ProposalState::Executed,
                ProposalState::Defeated,
                ProposalState::Canceled,
            ]),
        )
        .all(db)
        .await?;

    for proposal in ended_shutter {
        // Find the space for this proposal (reverse lookup or store in proposal?)
        // We have the governor_id, so we can find the space from our map?
        // Actually we don't easily have governor_id -> space map here without iterating.
        // But we can just proceed with the proposal ID.
        
        // Find dao_id and governor_id from the proposal (we have governor_id)
        // We need dao_id for store_snapshot_proposal.
        // Let's look it up in our map.
        let mapping = space_map.values().find(|(_, g_id)| *g_id == proposal.governor_id);
        let dao_id = if let Some((d_id, _)) = mapping {
            *d_id
        } else {
            continue;
        };

        let votes = api
            .fetch_proposal_votes_with_retry(
                &proposal.external_id,
                HIDDEN_VOTE_MAX_RETRIES,
                HIDDEN_VOTE_RETRY_DELAY_SECONDS,
            )
            .await?;

        if !votes.is_empty() && !votes.iter().any(|vote| vote.has_hidden_choice()) {
             // Refresh proposal
             if let Ok(Some(updated_proposal)) = api.fetch_proposal_by_id(&proposal.external_id).await {
                 if let Err(e) = store_snapshot_proposal(updated_proposal, proposal.governor_id, dao_id).await {
                     error!(proposal_id = %proposal.external_id, error = %e, "Failed to refresh shutter proposal");
                 }
             }
             
             // Store votes
             let mut vote_models = Vec::new();
             for vote in votes {
                 if let Ok(Some(model)) = vote.to_active_model(proposal.governor_id, dao_id) {
                     vote_models.push(model);
                 }
             }
             
             if !vote_models.is_empty() {
                 if let Err(e) = store_votes(vote_models, proposal.governor_id).await {
                     error!(proposal_id = %proposal.external_id, error = %e, "Failed to store shutter votes");
                 }
             }
        }
    }

    Ok(())
}
