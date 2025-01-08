use anyhow::{Context, Result};
use chrono::Duration;
use sea_orm::{
    prelude::{Expr, Uuid},
    sea_query::Alias,
    ActiveValue::NotSet,
    ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
};
use seaorm::{dao_discourse, dao_indexer, discourse_topic, job_queue, proposal, proposal_group};
use std::time::Duration as StdDuration;
use tokio::time::{sleep, Instant};
use tracing::{error, info, instrument, warn, Span};
use utils::types::{DiscussionJobData, JobType, ProposalGroupItem, ProposalJobData};

#[instrument(skip(db))]
pub async fn run_group_task(db: &DatabaseConnection) -> Result<()> {
    let interval = Duration::minutes(1);
    let mut next_tick = Instant::now() + StdDuration::from_secs(interval.num_seconds() as u64);

    loop {
        if let Err(e) = process_jobs(db).await {
            error!(error = %e, "Error processing jobs");
        }

        sleep(next_tick.saturating_duration_since(Instant::now())).await;
        next_tick += StdDuration::from_secs(interval.num_seconds() as u64);
    }
}

#[instrument(skip(conn), fields(job_count = 0))]
async fn process_jobs(conn: &DatabaseConnection) -> Result<()> {
    let pending_jobs = job_queue::Entity::find()
        .filter(
            job_queue::Column::Status
                .eq("PENDING")
                .and(job_queue::Column::Type.is_in(vec![
                    JobType::MapperNewProposalDiscussion.to_string(),
                    JobType::MapperNewSnapshotProposal.to_string(),
                ])),
        )
        .order_by_asc(job_queue::Column::CreatedAt)
        .all(conn)
        .await
        .context("Failed to fetch pending jobs")?;

    Span::current().record("job_count", pending_jobs.len());

    for job in pending_jobs {
        let span = Span::current();
        span.record("job_id", job.id);
        span.record("job_type", &job.r#type);

        info!(job_id = job.id, job_type = %job.r#type, "Processing job");

        let job_type: JobType = job.r#type.parse().context("Failed to parse job type")?;

        match job_type {
            JobType::MapperNewProposalDiscussion => {
                let data: DiscussionJobData = serde_json::from_value(job.data.clone())
                    .context("Failed to deserialize discussion job data")?;
                if let Err(e) =
                    process_new_discussion_job(conn, job.id, data.discourse_topic_id).await
                {
                    error!(
                        error = %e,
                        job_id = job.id,
                        discourse_topic_id = %data.discourse_topic_id,
                        "Failed to process new discussion job"
                    );
                    continue;
                }
            }
            JobType::MapperNewSnapshotProposal => {
                let data: ProposalJobData = serde_json::from_value(job.data.clone())
                    .context("Failed to deserialize proposal job data")?;
                if let Err(e) = process_snapshot_proposal_job(conn, job.id, data.proposal_id).await
                {
                    error!(
                        error = %e,
                        job_id = job.id,
                        proposal_id = %data.proposal_id,
                        "Failed to process snapshot proposal job"
                    );
                    continue;
                }
            }
        }

        // Update job status to COMPLETED
        let job_id = job.id;
        let mut job: job_queue::ActiveModel = job.into();
        job.status = Set("COMPLETED".to_string());
        if let Err(e) = job_queue::Entity::update(job).exec(conn).await {
            error!(
                error = %e,
                job_id = job_id,
                "Failed to update job status"
            );
        } else {
            info!(job_id = job_id, "Job completed successfully");
        }
    }

    Ok(())
}

#[instrument(skip(conn), fields(job_id = job_id, discourse_topic_id = %discourse_topic_id))]
async fn process_new_discussion_job(
    conn: &DatabaseConnection,
    job_id: i32,
    discourse_topic_id: Uuid,
) -> Result<()> {
    // Find the discourse topic
    let topic = match discourse_topic::Entity::find_by_id(discourse_topic_id)
        .one(conn)
        .await
        .context("Failed to find discourse topic")?
    {
        Some(topic) => topic,
        None => {
            error!(
                job_id = job_id,
                discourse_topic_id = %discourse_topic_id,
                "Discourse topic not found"
            );
            return Ok(());
        }
    };

    // Check if topic is already part of a proposal group
    let topic_already_mapped = !proposal_group::Entity::find()
        .filter(
            Expr::expr(Expr::col(proposal_group::Column::Items).cast_as(Alias::new("text")))
                .like(format!("%{}%", discourse_topic_id)),
        )
        .all(conn)
        .await
        .context("Failed to check if topic is already mapped")?
        .is_empty();

    if !topic_already_mapped {
        let discourse_indexer = dao_discourse::Entity::find_by_id(topic.dao_discourse_id)
            .one(conn)
            .await
            .context("Failed to find discourse indexer")?;

        // Create new proposal group
        let new_group = proposal_group::ActiveModel {
            id: NotSet,
            dao_id: Set(discourse_indexer.clone().unwrap().dao_id),
            name: Set(topic.title.clone()),
            items: Set(serde_json::to_value(vec![ProposalGroupItem {
                id: topic.id.to_string(),
                type_field: "topic".to_string(),
                name: topic.title.clone(),
                indexer_name: discourse_indexer.unwrap().discourse_base_url,
            }])
            .context("Failed to serialize proposal group items")?),
            created_at: NotSet,
        };

        if let Err(e) = proposal_group::Entity::insert(new_group).exec(conn).await {
            error!(
                error = %e,
                job_id = job_id,
                discourse_topic_id = %discourse_topic_id,
                "Failed to create proposal group"
            );
            return Ok(());
        }

        info!(
            job_id = job_id,
            discourse_topic_id = %discourse_topic_id,
            "Created new proposal group"
        );
    }

    Ok(())
}

#[instrument(skip(conn), fields(job_id = job_id, proposal_id = %proposal_id))]
async fn process_snapshot_proposal_job(
    conn: &DatabaseConnection,
    job_id: i32,
    proposal_id: Uuid,
) -> Result<()> {
    // Find the snapshot proposal
    let proposal = match proposal::Entity::find_by_id(proposal_id).one(conn).await {
        Ok(Some(proposal)) => proposal,
        Ok(None) => {
            error!(
                job_id = job_id,
                proposal_id = %proposal_id,
                "Snapshot proposal not found"
            );
            return Ok(());
        }
        Err(e) => {
            return Err(e).context("Failed to find snapshot proposal")?;
        }
    };

    // Extract discussion_id from discussion_url if it exists
    if let Some(ref discussion_url) = proposal.discussion_url {
        if let Some(topic_id) = extract_discourse_id(discussion_url) {
            let Some(dao_discourse) = dao_discourse::Entity::find()
                .filter(dao_discourse::Column::DaoId.eq(proposal.dao_id))
                .one(conn)
                .await
                .context("Failed to find DAO discourse configuration")?
            else {
                error!(
                    job_id = job_id,
                    proposal_id = %proposal_id,
                    dao_id = %proposal.dao_id,
                    "No DAO discourse configuration found for proposal's DAO"
                );
                return Ok(());
            };

            // Find the discourse topic with this external_id
            let discourse_topic = discourse_topic::Entity::find()
                .filter(
                    discourse_topic::Column::ExternalId
                        .eq(topic_id)
                        .and(discourse_topic::Column::DaoDiscourseId.eq(dao_discourse.id)),
                )
                .one(conn)
                .await
                .context("Failed to find discourse topic")?;

            if let Some(topic) = discourse_topic {
                // Find the proposal group containing this topic directly
                let group = proposal_group::Entity::find()
                    .filter(
                        Expr::expr(
                            Expr::col(proposal_group::Column::Items).cast_as(Alias::new("text")),
                        )
                        .like(format!("%{}%", topic.id)),
                    )
                    .one(conn)
                    .await
                    .context("Failed to find proposal group")?;

                if let Some(group) = group {
                    if let Ok(mut items) =
                        serde_json::from_value::<Vec<ProposalGroupItem>>(group.items.clone())
                    {
                        // Check if proposal is not already in the group
                        if !items.iter().any(|item| {
                            item.id == proposal.id.to_string() && item.type_field == "proposal"
                        }) {
                            // Add the proposal to the group
                            let indexer = dao_indexer::Entity::find_by_id(proposal.dao_indexer_id)
                                .one(conn)
                                .await
                                .context("Failed to find DAO indexer")?
                                .unwrap();

                            items.push(ProposalGroupItem {
                                id: proposal.id.to_string(),
                                type_field: "proposal".to_string(),
                                name: proposal.name.clone(),
                                indexer_name: format!("{:?}", indexer.indexer_variant),
                            });

                            // Update the group
                            let mut group: proposal_group::ActiveModel = group.into();
                            group.items = Set(serde_json::to_value(items)
                                .context("Failed to serialize proposal group items")?);
                            proposal_group::Entity::update(group)
                                .exec(conn)
                                .await
                                .context("Failed to update proposal group")?;

                            info!(
                                job_id = job_id,
                                proposal_id = %proposal_id,
                                discourse_topic_id = %topic.id,
                                "Added snapshot proposal to existing group"
                            );
                        }
                    }
                }
            }
        } else {
            warn!(
                job_id = job_id,
                proposal_id = %proposal_id,
                "Failed to extract discourse_id from discussion_url"
            );
        }
    } else {
        warn!(job_id = job_id, proposal_id = %proposal_id, "No discussion_url provided");
    }

    Ok(())
}

fn extract_discourse_id(url: &str) -> Option<i32> {
    url.split('?') // First split by ? to remove query parameters
        .next() // Take the part before any query parameters
        .and_then(|url| {
            let parts: Vec<&str> = url.split('/').collect();
            parts
                .iter()
                .filter_map(|part| part.parse::<i32>().ok())
                .next()
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_discourse_id_valid_url() {
        let url = "https://example.com/t/12345";
        assert_eq!(extract_discourse_id(url), Some(12345));
    }

    #[test]
    fn test_extract_discourse_id_valid_url_with_query() {
        let url = "https://example.com/t/12345?param=value";
        assert_eq!(extract_discourse_id(url), Some(12345));
    }

    #[test]
    fn test_extract_discourse_id_valid_url_with_multiple_numbers() {
        let url = "https://example.com/t/12345/67890";
        assert_eq!(extract_discourse_id(url), Some(12345));
    }

    #[test]
    fn test_extract_discourse_id_invalid_url_no_number() {
        let url = "https://example.com/t/";
        assert_eq!(extract_discourse_id(url), None);
    }

    #[test]
    fn test_extract_discourse_id_invalid_url_non_numeric() {
        let url = "https://example.com/t/abcde";
        assert_eq!(extract_discourse_id(url), None);
    }

    #[test]
    fn test_extract_discourse_id_invalid_url_empty() {
        let url = "";
        assert_eq!(extract_discourse_id(url), None);
    }

    #[test]
    fn test_extract_discourse_id_invalid_url_no_path() {
        let url = "https://example.com";
        assert_eq!(extract_discourse_id(url), None);
    }

    #[test]
    fn test_extract_discourse_id_valid_url_with_multiple_slashes() {
        let url = "https://example.com/t///12345";
        assert_eq!(extract_discourse_id(url), Some(12345));
    }

    #[test]
    fn test_extract_discourse_id_valid_url_with_trailing_slash() {
        let url = "https://example.com/t/12345/";
        assert_eq!(extract_discourse_id(url), Some(12345));
    }
}
