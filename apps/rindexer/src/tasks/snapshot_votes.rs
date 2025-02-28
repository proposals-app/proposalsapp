use crate::extensions::{
    db_extension::{DAO_GOVERNOR_ID_MAP, DAO_ID_SLUG_MAP, DB, store_vote},
    snapshot_api::SNAPSHOT_API_HANDLER,
};
use anyhow::{Context, Result, anyhow};
use chrono::{DateTime, NaiveDateTime};
use proposalsapp_db::models::vote_new;
use sea_orm::{ActiveValue::NotSet, ColumnTrait, EntityTrait, FromQueryResult, QueryFilter, QuerySelect, Set, prelude::Uuid};
use serde::Deserialize;
use std::time::Duration;
use tokio::time;
use tracing::{error, info, instrument};

#[derive(Deserialize, Debug)]
struct SnapshotVotesResponse {
    data: Option<SnapshotVoteData>,
}

#[derive(Deserialize, Debug)]
struct SnapshotVoteData {
    votes: Vec<SnapshotVote>,
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

#[instrument]
pub async fn update_snapshot_votes() -> Result<()> {
    info!("Running task to fetch latest snapshot votes");

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
        .context("Snapshot votes governor not found")?;

    let mut last_vote_created = get_latest_vote_created(governor_id, dao_id).await?;
    let mut loop_count = 0;
    let max_loops = 10;

    loop {
        if loop_count >= max_loops {
            info!(
                "Reached maximum loop count of {}, exiting snapshot votes update loop.",
                max_loops
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
                        space: "arbitrumfoundation.eth"
                        created_gt: {}
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
            last_vote_created
        );

        let response: SnapshotVotesResponse = SNAPSHOT_API_HANDLER
            .get()
            .context("Snapshot API handler not initialized")?
            .fetch("https://hub.snapshot.org/graphql", graphql_query)
            .await
            .context("Failed to fetch votes from Snapshot API")?;

        let votes_data = response.data.map(|d| d.votes).unwrap_or_default();

        if votes_data.is_empty() {
            info!("No new snapshot votes to process");
            break; // No more new votes, exit loop
        }

        info!("Processing batch of {} snapshot votes", votes_data.len());

        for vote_data in &votes_data {
            store_snapshot_vote(vote_data, governor_id, dao_id).await?;
            last_vote_created = vote_data.created; // Update last created timestamp
        }
        loop_count += 1;
    }

    info!("Successfully updated snapshot votes");
    Ok(())
}

async fn store_snapshot_vote(vote_data: &SnapshotVote, governor_id: Uuid, dao_id: Uuid) -> Result<()> {
    let created_at = DateTime::from_timestamp(vote_data.created, 0)
        .context("Invalid created timestamp")?
        .naive_utc();

    let vote_model = vote_new::ActiveModel {
        id: NotSet,
        governor_id: Set(governor_id),
        dao_id: Set(dao_id),
        proposal_external_id: Set(vote_data.proposal.id.clone()),
        voter_address: Set(vote_data.voter.clone()),
        voting_power: Set(vote_data.vp),
        choice: Set(vote_data.choice.clone()),
        reason: Set(vote_data.reason.clone()),
        created_at: Set(created_at),
        block_created_at: NotSet, // Block number is not relevant for snapshot votes
        txid: Set(Some(vote_data.ipfs.clone())),
        proposal_id: NotSet, // Proposal id will be set in store_vote if proposal exists
    };

    // Assuming store_vote is adapted or a new function is created to handle snapshot votes
    store_vote(vote_model, governor_id).await?;

    Ok(())
}

#[instrument]
pub async fn run_periodic_snapshot_votes_update() -> Result<()> {
    info!("Starting periodic task for fetching latest snapshot votes");
    let mut interval = time::interval(Duration::from_secs(60));

    loop {
        match update_snapshot_votes().await {
            Ok(_) => info!("Successfully updated snapshot votes"),
            Err(e) => error!("Failed to update snapshot votes: {:?}", e),
        }

        interval.tick().await;
    }
}

#[derive(FromQueryResult)]
struct LastCreatedValue {
    last_created: Option<NaiveDateTime>,
}

async fn get_latest_vote_created(governor_id: Uuid, dao_id: Uuid) -> Result<i64> {
    let db = DB.get().context("DB not initialized")?;

    let last_vote = vote_new::Entity::find()
        .select_only()
        .column_as(vote_new::Column::CreatedAt.max(), "last_created")
        .filter(vote_new::Column::GovernorId.eq(governor_id))
        .filter(vote_new::Column::DaoId.eq(dao_id))
        .group_by(vote_new::Column::GovernorId)
        .into_model::<LastCreatedValue>()
        .one(db)
        .await?;

    let timestamp = last_vote
        .and_then(|v| v.last_created)
        .map(|dt| dt.and_utc().timestamp())
        .unwrap_or(0);
    Ok(timestamp)
}
