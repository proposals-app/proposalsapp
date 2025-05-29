use crate::extensions::{
    db_extension::{DAO_SLUG_GOVERNOR_SPACE_MAP, DAO_SLUG_GOVERNOR_TYPE_ID_MAP, DAO_SLUG_ID_MAP, DB, store_votes},
    snapshot_api::SNAPSHOT_API_HANDLER,
};
use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use futures::{StreamExt, stream};
use proposalsapp_db::models::{proposal, vote};
use sea_orm::{
    ActiveValue::NotSet,
    ColumnTrait, Condition, EntityOrSelect, EntityTrait, Order, QueryFilter, QueryOrder, QuerySelect, Set, Value,
    prelude::{Expr, Uuid},
};
use serde::Deserialize;
use serde_json::json;
use std::time::Duration;
use tracing::{debug, error, info, instrument, warn};

#[derive(Deserialize, Debug)]
struct SnapshotVotesResponse {
    data: Option<SnapshotVoteData>,
}

#[derive(Deserialize, Debug)]
struct SnapshotVoteData {
    votes: Option<Vec<SnapshotVote>>,
}

#[derive(Deserialize, Debug, Clone)]
struct SnapshotVote {
    voter: String,
    reason: Option<String>,
    choice: serde_json::Value,
    vp: f64,
    created: i64,
    proposal: SnapshotProposalRef,
    ipfs: String,
}

#[derive(Deserialize, Debug, Clone)]
struct SnapshotProposalRef {
    id: String,
}

#[instrument(name = "update_snapshot_votes", skip(dao_id, governor_id, space))]
pub async fn update_snapshot_votes(dao_id: Uuid, governor_id: Uuid, space: String) -> Result<()> {
    info!(space = %space, "Running task to fetch latest snapshot votes for space.");

    let mut last_vote_created = get_latest_vote_created(governor_id, dao_id).await?;

    // Fetch relevant proposals for this specific governor and DAO
    let relevant_proposals_vec = get_relevant_proposals(governor_id, dao_id, last_vote_created).await?;
    let relevant_proposals_str = format!(
        "[{}]",
        relevant_proposals_vec
            .iter()
            .map(|id| format!("\"{}\"", id))
            .collect::<Vec<_>>()
            .join(",")
    );

    // If there are no relevant proposals, there are no votes to fetch
    if relevant_proposals_vec.is_empty() {
        debug!(space = %space, "No relevant proposals found to fetch votes for. Skipping.");
        return Ok(());
    }

    let mut loop_count = 0;
    let max_loops = 10;
    let mut processed_vote_hashes = std::collections::HashSet::new();

    info!(
        proposal_count = relevant_proposals_vec.len(),
        space = %space,
        "Fetching votes for relevant snapshot proposals."
    );

    loop {
        if loop_count >= max_loops {
            info!(
                loop_count = loop_count,
                max_loops = max_loops,
                space = %space,
                "Reached maximum loop count, exiting snapshot votes update loop for space."
            );
            break;
        }

        let graphql_query = format!(
            r#"
            {{
                votes(
                    first: 100,
                    orderBy: "created",
                    orderDirection: asc,
                    where: {{
                        space: "{}"
                        created_gte: {},
                        proposal_in: {}
                    }}
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
            }}
            "#,
            space, last_vote_created, relevant_proposals_str
        );

        debug!(query = graphql_query, space = %space, "Fetching snapshot votes with query");

        let response: SnapshotVotesResponse = SNAPSHOT_API_HANDLER
            .get()
            .context("Snapshot API handler not initialized")?
            .fetch("https://hub.snapshot.org/graphql", graphql_query)
            .await
            .context(format!(
                "Failed to fetch votes from Snapshot API for space {}",
                space
            ))?;

        let votes_data: Vec<SnapshotVote> = response.data.and_then(|d| d.votes).unwrap_or_default();

        if votes_data.is_empty() {
            info!(space = %space, "No new snapshot votes to process from snapshot API, task completed for this cycle.");
            break; // No more new votes, exit loop
        }

        info!(
            batch_size = votes_data.len(),
            vote_created_gte = last_vote_created,
            space = %space,
            "Processing batch of snapshot votes"
        );

        // Monitor for unexpectedly small batches which might indicate missing votes
        if votes_data.len() < 100 && loop_count == 0 {
            warn!(
                batch_size = votes_data.len(),
                expected_size = 100,
                space = %space,
                "First batch smaller than expected - possible missing votes or API issues"
            );
        }

        let mut votes = vec![];
        let mut new_votes_found = false;
        let mut max_created_in_batch = last_vote_created;

        for vote_data in &votes_data {
            // Skip votes we've already processed (deduplication for same timestamp)
            if processed_vote_hashes.contains(&vote_data.ipfs) {
                debug!(ipfs = vote_data.ipfs, "Skipping already processed vote");
                continue;
            }

            // Only process votes that are actually newer than our last processed timestamp
            if vote_data.created > last_vote_created {
                new_votes_found = true;
            }

            let created_at = DateTime::from_timestamp(vote_data.created, 0)
                .context("Invalid created timestamp")?
                .naive_utc();

            let choice_value = if vote_data.choice.is_number() {
                (vote_data
                    .choice
                    .as_i64()
                    .ok_or_else(|| anyhow::anyhow!("Invalid choice value"))?
                    - 1)
                .into()
            } else {
                vote_data.choice.clone()
            };

            let vote_model = vote::ActiveModel {
                id: NotSet,
                governor_id: Set(governor_id),
                dao_id: Set(dao_id),
                proposal_external_id: Set(vote_data.proposal.id.clone()),
                voter_address: Set(vote_data.voter.clone()),
                voting_power: Set(vote_data.vp),
                choice: Set(choice_value),
                reason: Set(vote_data.reason.clone()),
                created_at: Set(created_at),
                block_created_at: NotSet, // Block number is not relevant for snapshot votes
                txid: Set(Some(vote_data.ipfs.clone())),
                proposal_id: NotSet, // Proposal id will be set in store_vote if proposal exists
            };

            votes.push(vote_model);
            processed_vote_hashes.insert(vote_data.ipfs.clone());
            max_created_in_batch = max_created_in_batch.max(vote_data.created);
            debug!(voter = vote_data.voter, proposal_id = vote_data.proposal.id, created_at = ?created_at, "Snapshot vote created");
        }

        let votes_count = votes.len();
        if !votes.is_empty() {
            store_votes(votes, governor_id).await?;
            info!(
                space = %space,
                processed_votes = votes_count,
                raw_batch_size = votes_data.len(),
                "Batch of snapshot votes stored."
            );
        } else {
            warn!(
                space = %space,
                raw_batch_size = votes_data.len(),
                "No votes to store after processing - all may have been duplicates or filtered"
            );
        }

        // Only advance timestamp if we found new votes, otherwise we might be in an infinite loop
        if new_votes_found {
            last_vote_created = max_created_in_batch;
            debug!(
                new_last_vote_created = last_vote_created,
                "Advanced last vote created timestamp"
            );
        } else {
            // If no new votes found, increment by 1 to avoid infinite loop on same timestamp
            warn!(
                space = %space,
                batch_size = votes_data.len(),
                processed_votes = votes_count,
                last_vote_created = last_vote_created,
                "No new votes found in batch - incrementing timestamp to avoid infinite loop. This may indicate missing votes."
            );
            last_vote_created += 1;
            debug!(
                incremented_last_vote_created = last_vote_created,
                "Incremented timestamp to avoid infinite loop"
            );
        }

        loop_count += 1;
    }

    info!(
        space = %space,
        total_loops = loop_count,
        final_timestamp = last_vote_created,
        "Successfully updated snapshot votes from snapshot API."
    );

    if loop_count >= max_loops {
        warn!(
            space = %space,
            max_loops = max_loops,
            "Reached maximum loop count - there may be more votes to process in next cycle"
        );
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
                    Ok(_) => debug!(governor_id = %governor_id, "Successfully updated snapshot votes for governor."),
                    Err(e) => error!(governor_id = %governor_id, error = %e, "Failed to update snapshot votes for governor: {:?}" , e),
                }

                match refresh_closed_shutter_votes(dao_id, governor_id, space).await {
                    Ok(_) => debug!(governor_id = %governor_id, "Successfully refreshed shutter proposal votes for governor."),
                    Err(e) => error!(governor_id = %governor_id, error = %e, "Failed to refresh shutter proposal votes for governor"),
                }
            }
        }

        tokio::time::sleep(Duration::from_secs(5)).await;
    }
}

#[instrument(name = "get_latest_vote_created", skip_all)]
async fn get_latest_vote_created(governor_id: Uuid, dao_id: Uuid) -> Result<i64> {
    let db = DB.get().context("DB not initialized")?;
    
    // Use a direct query to get the max timestamp, which is more efficient
    let timestamp = vote::Entity::find()
        .select_only()
        .column_as(
            Expr::cust("COALESCE(MAX(created_at), '1970-01-01 00:00:00')"),
            "max_timestamp"
        )
        .filter(vote::Column::GovernorId.eq(governor_id))
        .filter(vote::Column::DaoId.eq(dao_id))
        .into_tuple::<(DateTime<Utc>,)>()
        .one(db)
        .await?
        .map_or(0, |(dt,)| dt.timestamp());

    debug!(
        last_created_timestamp = timestamp,
        "Latest vote created timestamp retrieved from DB."
    );
    
    Ok(timestamp)
}

#[instrument(name = "get_relevant_proposals", skip_all)]
async fn get_relevant_proposals(governor_id: Uuid, dao_id: Uuid, last_vote_created: i64) -> Result<Vec<String>> {
    let db = DB.get().context("DB not initialized")?;

    let last_vote_created_datetime = DateTime::<Utc>::from_timestamp(last_vote_created, 0).context("Invalid last vote created timestamp")?;
    // Fetch proposals created up to three years ago - some proposals might still get votes after a long
    // time
    let three_years_ago_datetime = last_vote_created_datetime - Duration::from_secs(3 * 52 * 7 * 24 * 60 * 60);

    let relevant_proposals = proposal::Entity::find()
        .select()
        .filter(proposal::Column::GovernorId.eq(governor_id))
        .filter(proposal::Column::DaoId.eq(dao_id))
        // More permissive filtering: include proposals that ended recently OR might still be getting votes
        // Remove strict EndAt filter as Snapshot allows late votes
        .filter(
            Condition::any()
                .add(proposal::Column::EndAt.gt(last_vote_created_datetime.naive_utc()))
                .add(proposal::Column::EndAt.gt((last_vote_created_datetime - Duration::from_secs(7 * 24 * 60 * 60)).naive_utc())), // Include proposals that ended within last week
        )
        // Fetch proposals that started within the last three years
        .filter(proposal::Column::StartAt.gt(three_years_ago_datetime.naive_utc()))
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
        lookback_duration_days = 3 * 365,
        "Relevant proposals retrieved from DB with expanded filtering."
    );
    Ok(ids)
}

#[instrument(name = "refresh_shutter_votes", skip(dao_id, governor_id, space))]
async fn refresh_closed_shutter_votes(dao_id: Uuid, governor_id: Uuid, space: String) -> Result<()> {
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
async fn refresh_votes_for_proposal(proposal_external_id: &str, governor_id: Uuid, dao_id: Uuid) -> Result<()> {
    info!(proposal_external_id = %proposal_external_id, "Fetching all votes for proposal.");
    let mut current_skip = 0;
    const BATCH_SIZE: usize = 1000;
    let mut all_votes_data: Vec<SnapshotVote> = Vec::new();

    loop {
        let graphql_query = format!(
            r#"
            {{
                votes(
                    first: {},
                    skip: {},
                    orderBy: "created",
                    orderDirection: asc,
                    where: {{
                        proposal: "{}"
                    }}
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
            }}"#,
            BATCH_SIZE, current_skip, proposal_external_id
        );

        debug!(proposal_external_id = %proposal_external_id, query = graphql_query, "Fetching vote batch for proposal");

        let response: SnapshotVotesResponse = SNAPSHOT_API_HANDLER
            .get()
            .context("Snapshot API handler not initialized")?
            .fetch("https://hub.snapshot.org/graphql", graphql_query)
            .await
            .context(format!(
                "Failed to fetch votes from Snapshot API for proposal {}",
                proposal_external_id
            ))?;

        let mut votes_data: Vec<SnapshotVote> = response.data.and_then(|d| d.votes).unwrap_or_default();

        if votes_data.is_empty() {
            debug!(proposal_external_id = %proposal_external_id, "No more votes found for proposal, finished fetching.");
            break; // No more votes for this proposal
        }

        info!(
            batch_size = votes_data.len(),
            skip = current_skip,
            proposal_external_id = %proposal_external_id,
            "Processing batch of votes for proposal."
        );
        all_votes_data.append(&mut votes_data);
        current_skip += BATCH_SIZE;
    }

    if !all_votes_data.is_empty() {
        let mut votes_to_store = vec![];
        for vote_data in &all_votes_data {
            let created_at = DateTime::from_timestamp(vote_data.created, 0)
                .context("Invalid created timestamp")?
                .naive_utc();

            let choice_value = if vote_data.choice.is_number() {
                (vote_data
                    .choice
                    .as_i64()
                    .ok_or_else(|| anyhow::anyhow!("Invalid choice value"))?
                    - 1)
                .into()
            } else {
                vote_data.choice.clone()
            };

            let vote_model = vote::ActiveModel {
                id: NotSet,
                governor_id: Set(governor_id),
                dao_id: Set(dao_id),
                proposal_external_id: Set(vote_data.proposal.id.clone()),
                voter_address: Set(vote_data.voter.clone()),
                voting_power: Set(vote_data.vp),
                choice: Set(choice_value),
                reason: Set(vote_data.reason.clone()),
                created_at: Set(created_at),
                block_created_at: NotSet,
                txid: Set(Some(vote_data.ipfs.clone())),
                proposal_id: NotSet, // Proposal id will be set in store_vote if proposal exists
            };

            votes_to_store.push(vote_model);
            debug!(voter = vote_data.voter, proposal_id = vote_data.proposal.id, created_at = ?created_at, "Snapshot vote created");
        }

        if !votes_to_store.is_empty() {
            store_votes(votes_to_store, governor_id).await?;
            info!(proposal_external_id = %proposal_external_id, "Stored/Updated votes for proposal.");
        }
    } else {
        info!(proposal_external_id = %proposal_external_id, "No votes found in total for proposal.");
    }

    Ok(())
}
