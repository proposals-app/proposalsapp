use crate::extensions::{
    db_extension::{DAO_GOVERNOR_ID_MAP, DAO_ID_SLUG_MAP, DB, store_votes},
    snapshot_api::SNAPSHOT_API_HANDLER,
};
use anyhow::{Context, Result, anyhow};
use chrono::{DateTime, NaiveDateTime, Utc};
use proposalsapp_db_indexer::models::{proposal, vote};
use sea_orm::{ActiveValue::NotSet, ColumnTrait, EntityOrSelect, EntityTrait, FromQueryResult, Order, QueryFilter, QueryOrder, QuerySelect, Set, prelude::Uuid};
use serde::Deserialize;
use std::time::Duration;
use tracing::{debug, error, info, instrument};

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

    let relevant_proposals_vec = get_relevant_proposals(governor_id, dao_id, last_vote_created).await?;
    let relevant_proposals_str = format!(
        "[{}]",
        relevant_proposals_vec
            .iter()
            .map(|id| format!("\"{}\"", id))
            .collect::<Vec<_>>()
            .join(",")
    );

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
                    first: 1000,
                    orderBy: "created",
                    orderDirection: asc,
                    where: {{
                        space: "arbitrumfoundation.eth"
                        created_gt: {},
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
            last_vote_created, relevant_proposals_str
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

        let mut votes = vec![];

        for vote_data in &votes_data {
            let created_at = DateTime::from_timestamp(vote_data.created, 0)
                .context("Invalid created timestamp")?
                .naive_utc();

            let vote_model = vote::ActiveModel {
                id: NotSet,
                governor_id: Set(governor_id),
                dao_id: Set(dao_id),
                proposal_external_id: Set(vote_data.proposal.id.clone()),
                voter_address: Set(vote_data.voter.clone()),
                voting_power: Set(vote_data.vp),
                choice: Set(if vote_data.choice.is_number() {
                    (vote_data
                        .choice
                        .as_i64()
                        .ok_or_else(|| anyhow::anyhow!("Invalid choice value"))?
                        - 1)
                    .into()
                } else {
                    vote_data.choice.clone()
                }),
                reason: Set(vote_data.reason.clone()),
                created_at: Set(created_at),
                block_created_at: NotSet, // Block number is not relevant for snapshot votes
                txid: Set(Some(vote_data.ipfs.clone())),
                proposal_id: NotSet, // Proposal id will be set in store_vote if proposal exists
            };

            votes.push(vote_model);

            last_vote_created = vote_data.created; // Update last created timestamp
        }

        store_votes(votes, governor_id).await?;

        loop_count += 1;
    }

    info!("Successfully updated snapshot votes");
    Ok(())
}

#[instrument]
pub async fn run_periodic_snapshot_votes_update() -> Result<()> {
    info!("Starting periodic task for fetching latest snapshot votes");

    loop {
        match update_snapshot_votes().await {
            Ok(_) => debug!("Successfully updated snapshot votes"),
            Err(e) => error!("Failed to update snapshot votes: {:?}", e),
        }

        tokio::time::sleep(Duration::from_secs(5)).await;
    }
}

#[derive(FromQueryResult)]
struct LastCreatedValue {
    last_created: Option<NaiveDateTime>,
}

async fn get_latest_vote_created(governor_id: Uuid, dao_id: Uuid) -> Result<i64> {
    let db = DB.get().context("DB not initialized")?;

    let last_vote = vote::Entity::find()
        .select_only()
        .column_as(vote::Column::CreatedAt.max(), "last_created")
        .filter(vote::Column::GovernorId.eq(governor_id))
        .filter(vote::Column::DaoId.eq(dao_id))
        .into_model::<LastCreatedValue>()
        .one(db)
        .await?;

    let timestamp = last_vote
        .and_then(|v| v.last_created)
        .map(|dt| dt.and_utc().timestamp())
        .unwrap_or(0);

    Ok(timestamp)
}

async fn get_relevant_proposals(governor_id: Uuid, dao_id: Uuid, last_vote_created: i64) -> Result<Vec<String>> {
    let db = DB.get().context("DB not initialized")?;

    let last_vote_created_datetime = DateTime::<Utc>::from_timestamp(last_vote_created, 0).context("Invalid last vote created timestamp")?;
    let one_year_ago_datetime = last_vote_created_datetime - Duration::from_secs(52 * 7 * 24 * 60 * 60);

    let relevant_proposals = proposal::Entity::find()
        .select()
        .filter(proposal::Column::EndAt.gt(last_vote_created_datetime.naive_utc()))
        .filter(proposal::Column::StartAt.gt(one_year_ago_datetime.naive_utc()))
        .filter(proposal::Column::GovernorId.eq(governor_id))
        .filter(proposal::Column::DaoId.eq(dao_id))
        .order_by(proposal::Column::EndAt, Order::Asc)
        .limit(100)
        .all(db)
        .await?;

    let ids = relevant_proposals
        .iter()
        .map(|rp| rp.external_id.clone())
        .collect();

    Ok(ids)
}
