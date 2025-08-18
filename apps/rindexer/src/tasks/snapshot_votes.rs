use crate::extensions::{
    db_extension::{
        DAO_SLUG_GOVERNOR_SPACE_MAP, DAO_SLUG_GOVERNOR_TYPE_ID_MAP, DAO_SLUG_ID_MAP, DB,
        store_votes,
    },
    snapshot_api::{SNAPSHOT_API_HANDLER, SnapshotVote},
};
use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use futures::{StreamExt, stream};
use proposalsapp_db::models::{proposal, vote};
use sea_orm::{
    ColumnTrait, Condition, EntityOrSelect, EntityTrait, Order, QueryFilter, QueryOrder,
    QuerySelect, Value,
    prelude::{Expr, Uuid},
};
use serde_json::json;
use std::{collections::HashSet, time::Duration};
use tracing::{debug, error, info, instrument, warn};

// Constants
const REFRESH_INTERVAL: Duration = Duration::from_secs(60);
const MAX_BATCH_SIZE: usize = 100;
const MAX_LOOPS: usize = 10;

#[instrument(name = "update_snapshot_votes", skip(dao_id, governor_id, space))]
pub async fn update_snapshot_votes(dao_id: Uuid, governor_id: Uuid, space: String) -> Result<()> {
    info!(space = %space, "Running task to fetch latest snapshot votes for space.");

    // Get the timestamp of the latest vote we've already processed
    let mut last_vote_created = get_latest_vote_created(governor_id, dao_id).await?;

    // Apply a 5-minute overlap window to catch votes that may have been delayed
    // This helps catch votes that were submitted but not immediately visible in the API
    const OVERLAP_WINDOW_SECS: i64 = 300; // 5 minutes
    let fetch_from_timestamp = last_vote_created.saturating_sub(OVERLAP_WINDOW_SECS);

    // Fetch relevant proposals for this specific governor and DAO
    let relevant_proposals = get_relevant_proposals(governor_id, dao_id, last_vote_created).await?;

    // If there are no relevant proposals, there are no votes to fetch
    if relevant_proposals.is_empty() {
        debug!(space = %space, "No relevant proposals found to fetch votes for. Skipping.");
        return Ok(());
    }

    let mut processed_vote_hashes = HashSet::new();

    info!(
        proposal_count = relevant_proposals.len(),
        space = %space,
        "Fetching votes for relevant snapshot proposals."
    );

    // Track the fetch timestamp separately from last_vote_created
    // This ensures we don't skip votes due to the overlap window
    let mut current_fetch_from = fetch_from_timestamp;

    // Fetch votes in batches
    for loop_count in 0..MAX_LOOPS {
        // Fetch a batch of votes
        let votes_data = match SNAPSHOT_API_HANDLER
            .get()
            .context("Snapshot API handler not initialized")?
            .fetch_votes(&space, current_fetch_from, &relevant_proposals)
            .await
        {
            Ok(votes) => votes,
            Err(e) => {
                error!(error = %e, space = %space, "Failed to fetch votes batch: {}", e);
                break;
            }
        };

        // If no votes were returned, we're done
        if votes_data.is_empty() {
            info!(space = %space, "No more votes found for space, finished fetching.");
            break;
        }

        info!(
            vote_count = votes_data.len(),
            loop_count = loop_count,
            space = %space,
            "Processing batch of votes."
        );

        // Track the max timestamp in this batch
        let mut max_created_in_batch = last_vote_created;

        // Process votes and prepare them for storage
        let mut votes_to_store = Vec::with_capacity(votes_data.len());

        for vote_data in &votes_data {
            // Skip votes we've already processed in this batch
            let vote_hash = format!(
                "{}-{}-{}",
                vote_data.proposal.id, vote_data.voter, vote_data.ipfs
            );
            if processed_vote_hashes.contains(&vote_hash) {
                continue;
            }
            processed_vote_hashes.insert(vote_hash);

            // Track the maximum timestamp in this batch
            max_created_in_batch = max_created_in_batch.max(vote_data.created);

            // Process the vote and add it to the storage batch if valid
            if let Ok(Some(vote_model)) = vote_data.to_active_model(governor_id, dao_id) {
                votes_to_store.push(vote_model);
            }
        }

        // Store the votes in the database
        let votes_count = votes_to_store.len();
        if !votes_to_store.is_empty() {
            match store_votes(votes_to_store, governor_id).await {
                Ok(_) => debug!(vote_count = votes_count, space = %space, "Stored votes for space"),
                Err(e) => error!(error = %e, space = %space, "Failed to store votes: {}", e),
            }
        } else if !votes_data.is_empty() {
            debug!(
                space = %space,
                raw_batch_size = votes_data.len(),
                "No votes to store after processing - all may have been duplicates or filtered"
            );
        }

        // Update fetch timestamp for next iteration
        if votes_data.is_empty() {
            // No votes returned at all - we've caught up
            debug!(
                space = %space,
                current_fetch_from = current_fetch_from,
                "No votes returned in batch - fully caught up"
            );
            break;
        }

        // Always use the max timestamp from the batch for the next fetch
        // This ensures we don't miss votes with the same timestamp
        current_fetch_from = max_created_in_batch + 1;

        // Update last_vote_created to track our overall progress
        // This will be persisted for the next run
        if max_created_in_batch > last_vote_created {
            last_vote_created = max_created_in_batch;
            debug!(
                new_last_vote_created = last_vote_created,
                votes_in_batch = votes_data.len(),
                new_fetch_from = current_fetch_from,
                "Advanced timestamps for next iteration"
            );
        }
    }

    info!(
        space = %space,
        final_timestamp = last_vote_created,
        "Successfully updated snapshot votes from snapshot API."
    );

    // After fetching all votes, check if we need to refresh votes for closed shutter proposals
    if let Err(e) = refresh_closed_shutter_votes(dao_id, governor_id, space.clone()).await {
        error!(error = %e, space = %space, "Failed to refresh votes for closed shutter proposals: {}", e);
    } else {
        debug!(space = %space, "Refreshed votes for closed shutter proposals");
    }

    Ok(())
}

#[instrument(name = "run_periodic_snapshot_votes_update", skip_all)]
pub async fn run_periodic_snapshot_votes_update() -> Result<()> {
    info!("Starting periodic task for fetching latest snapshot votes.");

    loop {
        let snapshot_governors = {
            // Collect governor info synchronously before async calls
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
                    error!(dao_slug = %dao_slug, "DAO ID not found for slug. Skipping DAO for vote update.");
                    continue;
                };

                for (gov_type, governor_id) in governor_types.iter() {
                    if gov_type.contains("SNAPSHOT") {
                        // Try to get the space using the tuple (dao_slug, gov_type)
                        let key_tuple = (dao_slug.clone(), gov_type.clone());
                        let Some(space) = governor_space_map.get(&key_tuple) else {
                            error!(dao_slug = %dao_slug, governor_type = %gov_type, "Snapshot space not found for DAO slug and governor type. Skipping governor for vote update.");
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
            info!("No SNAPSHOT governors configured. Skipping periodic vote update.");
        } else {
            info!(
                governor_count = snapshot_governors.len(),
                "Found SNAPSHOT governors. Updating votes."
            );
            for (dao_id, governor_id, space) in snapshot_governors {
                info!(dao_id = %dao_id, governor_id = %governor_id, space = %space, "Updating snapshot votes for governor.");
                match update_snapshot_votes(dao_id, governor_id, space.clone()).await {
                    Ok(_) => {
                        debug!(governor_id = %governor_id, "Successfully updated snapshot votes for governor.")
                    }
                    Err(e) => {
                        error!(governor_id = %governor_id, error = %e, "Failed to update snapshot votes for governor: {:?}" , e)
                    }
                }

                match refresh_closed_shutter_votes(dao_id, governor_id, space).await {
                    Ok(_) => {
                        debug!(governor_id = %governor_id, "Successfully refreshed shutter proposal votes for governor.")
                    }
                    Err(e) => {
                        error!(governor_id = %governor_id, error = %e, "Failed to refresh shutter proposal votes for governor")
                    }
                }
            }
        }

        tokio::time::sleep(REFRESH_INTERVAL).await;
    }
}

/// Gets the timestamp of the latest vote created for a specific governor and DAO
/// Returns Unix timestamp (seconds since epoch) or 0 if no votes exist
#[instrument(name = "get_latest_vote_created", skip_all)]
async fn get_latest_vote_created(governor_id: Uuid, dao_id: Uuid) -> Result<i64> {
    let db = DB.get().context("DB not initialized")?;

    // Use a direct query with COALESCE to handle the case when no votes exist
    // This is more efficient than fetching the model and handling the Option in Rust
    let timestamp = vote::Entity::find()
        .select_only()
        .column_as(
            Expr::cust("COALESCE(MAX(created_at::TIMESTAMPTZ), '1970-01-01 00:00:00+00')"),
            "max_timestamp",
        )
        .filter(vote::Column::GovernorId.eq(governor_id))
        .filter(vote::Column::DaoId.eq(dao_id))
        .into_tuple::<(DateTime<Utc>,)>()
        .one(db)
        .await?
        .map_or(0, |(dt,)| dt.timestamp());

    debug!(
        governor_id = %governor_id,
        dao_id = %dao_id,
        last_created_timestamp = timestamp,
        "Latest vote created timestamp retrieved from DB."
    );

    Ok(timestamp)
}

#[instrument(name = "get_relevant_proposals", skip_all)]
async fn get_relevant_proposals(
    governor_id: Uuid,
    dao_id: Uuid,
    last_vote_created: i64,
) -> Result<Vec<String>> {
    let db = DB.get().context("DB not initialized")?;

    let last_vote_created_datetime = DateTime::<Utc>::from_timestamp(last_vote_created, 0)
        .context("Invalid last vote created timestamp")?;
    // Fetch proposals created up to 1 year ago - some proposals might still get votes after a long
    // time
    let one_year_ago_datetime =
        last_vote_created_datetime - Duration::from_secs(52 * 7 * 24 * 60 * 60);

    let relevant_proposals = proposal::Entity::find()
        .select()
        .filter(proposal::Column::GovernorId.eq(governor_id))
        .filter(proposal::Column::DaoId.eq(dao_id))
        // More permissive filtering: include proposals that ended recently OR might still be getting votes
        // Remove strict EndAt filter as Snapshot allows late votes
        .filter(
            Condition::any()
                .add(proposal::Column::EndAt.gt(last_vote_created_datetime.naive_utc()))
                .add(
                    proposal::Column::EndAt.gt((last_vote_created_datetime
                        - Duration::from_secs(7 * 24 * 60 * 60))
                    .naive_utc()),
                ), // Include proposals that ended within last week
        )
        // Fetch proposals that started within the last three years
        .filter(proposal::Column::StartAt.gt(one_year_ago_datetime.naive_utc()))
        .order_by(proposal::Column::EndAt, Order::Asc)
        .limit(500) // Increased limit to catch more proposals
        .all(db)
        .await?;

    let ids: Vec<String> = relevant_proposals
        .iter()
        .map(|rp| rp.external_id.clone())
        .collect();

    info!(
        proposal_ids_count = ids.len(),
        last_vote_created_timestamp = last_vote_created,
        lookback_duration_days = 365,
        "Relevant proposals retrieved from DB with expanded filtering."
    );
    Ok(ids)
}

#[instrument(name = "refresh_shutter_votes", skip(dao_id, governor_id, space))]
async fn refresh_closed_shutter_votes(
    dao_id: Uuid,
    governor_id: Uuid,
    space: String,
) -> Result<()> {
    info!(dao_id = %dao_id, governor_id = %governor_id, space = %space, "Running task to refresh votes for closed shutter proposals (24-hour window).");

    let db = DB.get().context("DB not initialized")?;

    let now = Utc::now();
    // Look for proposals that ended in the last 24 hours to catch delayed metadata updates
    let twenty_four_hours_ago = now - Duration::from_secs(24 * 60 * 60);

    let shutter_condition = Condition::all()
        .add(Expr::cust_with_values(
            r#""proposal"."metadata" @> $1::jsonb"#,
            [Value::Json(Some(Box::new(json!({"hidden_vote": true}))))],
        ))
        .add(Expr::cust_with_values(
            r#""proposal"."metadata" @> $1::jsonb"#,
            [Value::Json(Some(Box::new(
                json!({"scores_state": "final"}),
            )))],
        ));

    // Find closed proposals that used shutter privacy AND ended in the last 24 hours
    let shutter_proposals = proposal::Entity::find()
        .filter(proposal::Column::GovernorId.eq(governor_id))
        .filter(proposal::Column::DaoId.eq(dao_id))
        .filter(shutter_condition)
        .filter(proposal::Column::EndAt.gt(twenty_four_hours_ago.naive_utc()))
        .filter(proposal::Column::EndAt.lte(now.naive_utc()))
        .all(db)
        .await?;

    if shutter_proposals.is_empty() {
        info!(governor_id = %governor_id, "No closed shutter proposals found needing vote refresh in the last 24 hours.");
        return Ok(());
    }

    info!(
        count = shutter_proposals.len(),
        governor_id = %governor_id,
        "Found closed shutter proposals to refresh votes for."
    );

    const SHUTTER_PROPOSAL_FETCH_CONCURRENCY: usize = 10;

    // Process proposals concurrently
    stream::iter(shutter_proposals)
        .map(|proposal_to_refresh| async move {
            info!(
                proposal_id = proposal_to_refresh.external_id,
                governor_id = %governor_id,
                "Refreshing votes for shutter proposal."
            );
            // Pass dao_id and governor_id to refresh_votes_for_proposal
            match refresh_votes_for_proposal(&proposal_to_refresh.external_id, governor_id, dao_id).await {
                Ok(_) => {
                    info!(
                        proposal_id = proposal_to_refresh.external_id,
                        governor_id = %governor_id,
                        "Successfully refreshed votes."
                    );
                }
                Err(e) => {
                    error!(proposal_id = proposal_to_refresh.external_id, governor_id = %governor_id, error = %e, "Failed to refresh votes for shutter proposal.");
                }
            }
        })
        .buffer_unordered(SHUTTER_PROPOSAL_FETCH_CONCURRENCY) // Limit concurrency
        .collect::<()>()
        .await;

    info!(governor_id = %governor_id, "Finished refreshing votes for closed shutter proposals.");
    Ok(())
}

#[instrument(
    name = "refresh_votes_for_proposal",
    skip(governor_id, dao_id),
    fields(proposal_external_id)
)]
async fn refresh_votes_for_proposal(
    proposal_external_id: &str,
    governor_id: Uuid,
    dao_id: Uuid,
) -> Result<()> {
    info!(proposal_external_id = %proposal_external_id, "Fetching all votes for proposal.");

    let mut current_skip = 0;
    let mut all_votes_data: Vec<SnapshotVote> = Vec::new();

    // Fetch all votes for the proposal in batches
    loop {
        let votes_batch = SNAPSHOT_API_HANDLER
            .get()
            .context("Snapshot API handler not initialized")?
            .fetch_proposal_votes(proposal_external_id, current_skip, MAX_BATCH_SIZE)
            .await?;

        if votes_batch.is_empty() {
            debug!(proposal_external_id = %proposal_external_id, "No more votes found for proposal, finished fetching.");
            break;
        }

        let batch_size = votes_batch.len();
        info!(
            batch_size = batch_size,
            skip = current_skip,
            proposal_external_id = %proposal_external_id,
            "Processing batch of votes for proposal."
        );

        all_votes_data.extend(votes_batch);
        current_skip += MAX_BATCH_SIZE;
    }

    if all_votes_data.is_empty() {
        info!(proposal_external_id = %proposal_external_id, "No votes found for proposal.");
        return Ok(());
    }

    // Process all votes
    let mut votes_to_store = Vec::with_capacity(all_votes_data.len());
    let mut processed_count = 0;

    for vote_data in &all_votes_data {
        if let Ok(Some(vote_model)) = vote_data.to_active_model(governor_id, dao_id) {
            votes_to_store.push(vote_model);
            processed_count += 1;
        }
    }

    // Store processed votes
    if !votes_to_store.is_empty() {
        store_votes(votes_to_store, governor_id).await?;
        info!(
            proposal_external_id = %proposal_external_id,
            total_votes = all_votes_data.len(),
            processed_votes = processed_count,
            "Stored/Updated votes for proposal."
        );
    } else {
        warn!(
            proposal_external_id = %proposal_external_id,
            total_votes = all_votes_data.len(),
            "Found votes but none were valid for processing."
        );
    }

    Ok(())
}
