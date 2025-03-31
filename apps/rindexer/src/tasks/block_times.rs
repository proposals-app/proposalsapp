use crate::extensions::{block_time::estimate_timestamp, db_extension::DB};
use anyhow::{Context, Result};
use chrono::Utc;
use proposalsapp_db_indexer::models::proposal;
use sea_orm::{ColumnTrait, Condition, DatabaseConnection, EntityTrait, QueryFilter, Set};
use std::time::Duration;
use tokio::time;
use tracing::{error, info, instrument};

#[instrument(name = "tasks_update_ended_proposals_block_times", skip_all)]
pub async fn update_ended_proposals_block_times() -> Result<()> {
    info!("Running task to update block times.");
    let db: &DatabaseConnection = DB.get().context("DB not initialized")?;

    let proposals_with_block_times = proposal::Entity::find()
        .filter(
            Condition::any()
                .add(proposal::Column::BlockStartAt.is_not_null())
                .add(proposal::Column::BlockEndAt.is_not_null()),
        )
        .filter(proposal::Column::EndAt.gt(Utc::now().naive_utc() - Duration::from_secs(3 * 60 * 60)))
        .all(db)
        .await?;

    for proposal in proposals_with_block_times {
        let start_at = match estimate_timestamp("ethereum", proposal.block_start_at.unwrap() as u64).await {
            Ok(ts) => ts,
            Err(e) => {
                error!(proposal_id = %proposal.id, block_number = proposal.block_start_at, error = %e,  "Failed to estimate start_at timestamp");
                continue;
            }
        };

        let end_at = match estimate_timestamp("ethereum", proposal.block_end_at.unwrap() as u64).await {
            Ok(ts) => ts,
            Err(e) => {
                error!(proposal_id = %proposal.id, block_number = proposal.block_end_at, error = %e,  "Failed to estimate end_at timestamp");
                continue;
            }
        };

        let mut proposal_active_model: proposal::ActiveModel = proposal.clone().into();
        proposal_active_model.start_at = Set(start_at);
        proposal_active_model.end_at = Set(end_at);

        proposal::Entity::update(proposal_active_model)
            .exec(db)
            .await?;
    }

    info!("Task to update block times completed.");
    Ok(())
}

#[instrument(name = "run_periodic_block_times_update", skip_all)]
pub async fn run_periodic_block_times_update() -> Result<()> {
    info!("Starting periodic task for block times updates.");
    let mut interval = time::interval(time::Duration::from_secs(60 * 60));

    loop {
        match update_ended_proposals_block_times().await {
            Ok(_) => {
                info!("Successfully updated block times in periodic task.");
            }
            Err(e) => {
                error!(
                    error = %e,
                    "Failed to update block times in periodic task"
                );
            }
        }
        interval.tick().await;
    }
}
