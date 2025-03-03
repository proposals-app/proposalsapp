use anyhow::{Context, Result};
use chrono::Duration;
use proposalsapp_db::models::{dao_discourse, dao_indexer, discourse_topic, job_queue, proposal, proposal_group};
use sea_orm::{
    prelude::{Expr, Uuid},
    sea_query::Alias,
    ActiveValue::NotSet,
    ColumnTrait, EntityTrait, QueryFilter, QueryOrder, Set,
};
use std::time::Duration as StdDuration;
use tokio::time::{sleep, Instant};
use tracing::{error, info, instrument, warn, Span};
use utils::types::{DiscussionJobData, JobType, ProposalGroupItem, ProposalJobData};

use crate::{metrics::METRICS, DB};

pub async fn run_group_task() -> Result<()> {
    let interval = Duration::minutes(1);
    let mut next_tick = Instant::now() + StdDuration::from_secs(interval.num_seconds() as u64);

    loop {
        if let Err(e) = process_jobs().await {
            error!(error = %e, "Error processing jobs");
            METRICS.get().unwrap().job_processing_errors.add(1, &[]);
        }

        sleep(next_tick.saturating_duration_since(Instant::now())).await;
        next_tick += StdDuration::from_secs(interval.num_seconds() as u64);
    }
}

#[instrument(, fields(job_count = 0))]
async fn process_jobs() -> Result<()> {
    let start_time = Instant::now();
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
        .all(DB.get().unwrap())
        .await
        .context("Failed to fetch pending jobs")?;

    METRICS
        .get()
        .unwrap()
        .job_queue_size
        .add(pending_jobs.len() as i64, &[]);
    Span::current().record("job_count", pending_jobs.len());

    for job in pending_jobs {
        let span = Span::current();
        span.record("job_id", job.id);
        span.record("job_type", &job.r#type);

        info!(job_id = job.id, job_type = %job.r#type, "Processing job");

        let job_type: JobType = job.r#type.parse().context("Failed to parse job type")?;

        let job_result = match job_type {
            JobType::MapperNewProposalDiscussion => {
                let data: DiscussionJobData = serde_json::from_value(job.data.clone()).context("Failed to deserialize discussion job data")?;
                process_new_discussion_job(job.id, data.discourse_topic_id).await
            }
            JobType::MapperNewSnapshotProposal => {
                let data: ProposalJobData = serde_json::from_value(job.data.clone()).context("Failed to deserialize proposal job data")?;
                process_snapshot_proposal_job(job.id, data.proposal_id).await
            }
        };

        match job_result {
            Ok(_) => {
                // Update job status to COMPLETED only if processing was successful
                let job_id = job.id;
                let mut job: job_queue::ActiveModel = job.into();
                job.status = Set("COMPLETED".to_string());
                if let Err(e) = job_queue::Entity::update(job).exec(DB.get().unwrap()).await {
                    error!(
                        error = %e,
                        job_id = job_id,
                        "Failed to update job status"
                    );
                    METRICS.get().unwrap().db_updates.add(1, &[]);
                } else {
                    info!(job_id = job_id, "Job completed successfully");
                    METRICS.get().unwrap().job_processed_total.add(1, &[]);
                }
            }
            Err(e) => {
                error!(
                    error = %e,
                    job_id = job.id,
                    "Job processing failed"
                );
                METRICS.get().unwrap().job_processing_errors.add(1, &[]);
            }
        }
    }

    METRICS
        .get()
        .unwrap()
        .job_processing_duration
        .record(start_time.elapsed().as_secs_f64(), &[]);

    Ok(())
}

#[instrument(fields(job_id = job_id, discourse_topic_id = %discourse_topic_id))]
async fn process_new_discussion_job(job_id: i32, discourse_topic_id: Uuid) -> Result<()> {
    let start_time = Instant::now();

    info!(
        job_id = job_id,
        discourse_topic_id = %discourse_topic_id,
        "Starting to process new discussion job"
    );

    // Find the discourse topic
    let topic = match discourse_topic::Entity::find_by_id(discourse_topic_id)
        .one(DB.get().unwrap())
        .await
        .context("Failed to find discourse topic")?
    {
        Some(topic) => {
            info!(
                job_id = job_id,
                discourse_topic_id = %discourse_topic_id,
                "Discourse topic found"
            );
            topic
        }
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
    info!(
        job_id = job_id,
        discourse_topic_id = %discourse_topic_id,
        "Checking if topic is already part of a proposal group"
    );

    let topic_already_mapped = !proposal_group::Entity::find()
        .filter(Expr::expr(Expr::col(proposal_group::Column::Items).cast_as(Alias::new("text"))).like(format!("%{}%", discourse_topic_id)))
        .all(DB.get().unwrap())
        .await
        .context("Failed to check if topic is already mapped")?
        .is_empty();

    if topic_already_mapped {
        info!(
            job_id = job_id,
            discourse_topic_id = %discourse_topic_id,
            "Topic is already part of a proposal group"
        );
    } else {
        info!(
            job_id = job_id,
            discourse_topic_id = %discourse_topic_id,
            "Topic is not part of any proposal group, creating a new group"
        );

        let discourse_indexer = dao_discourse::Entity::find_by_id(topic.dao_discourse_id)
            .one(DB.get().unwrap())
            .await
            .context("Failed to find discourse indexer")?;

        if let Some(discourse_indexer) = discourse_indexer {
            info!(
                job_id = job_id,
                discourse_topic_id = %discourse_topic_id,
                dao_discourse_id = %discourse_indexer.id,
                "Found discourse indexer for the topic"
            );

            // Create new proposal group
            let new_group = proposal_group::ActiveModel {
                id: NotSet,
                dao_id: Set(discourse_indexer.dao_id),
                name: Set(topic.title.clone()),
                items: Set(serde_json::to_value(vec![ProposalGroupItem {
                    id: topic.id.to_string(),
                    type_field: "topic".to_string(),
                    name: topic.title.clone(),
                    indexer_name: discourse_indexer.discourse_base_url,
                }])
                .context("Failed to serialize proposal group items")?),
                created_at: NotSet,
            };

            if let Err(e) = proposal_group::Entity::insert(new_group)
                .exec(DB.get().unwrap())
                .await
            {
                error!(
                    error = %e,
                    job_id = job_id,
                    discourse_topic_id = %discourse_topic_id,
                    "Failed to create proposal group"
                );
                METRICS.get().unwrap().db_inserts.add(1, &[]);
                return Ok(());
            }

            info!(
                job_id = job_id,
                discourse_topic_id = %discourse_topic_id,
                "Created new proposal group"
            );
            METRICS.get().unwrap().db_inserts.add(1, &[]);
        } else {
            error!(
                job_id = job_id,
                discourse_topic_id = %discourse_topic_id,
                dao_discourse_id = %topic.dao_discourse_id,
                "No discourse indexer found for the topic"
            );
        }
    }

    METRICS
        .get()
        .unwrap()
        .db_query_duration
        .record(start_time.elapsed().as_secs_f64(), &[]);

    info!(
        job_id = job_id,
        discourse_topic_id = %discourse_topic_id,
        "Finished processing new discussion job"
    );

    Ok(())
}

#[instrument(fields(job_id = job_id, proposal_id = %proposal_id))]
async fn process_snapshot_proposal_job(job_id: i32, proposal_id: Uuid) -> Result<()> {
    let start_time = Instant::now();

    info!(
        job_id = job_id,
        proposal_id = %proposal_id,
        "Starting to process snapshot proposal job"
    );

    // Find the snapshot proposal
    let proposal = match proposal::Entity::find_by_id(proposal_id)
        .one(DB.get().unwrap())
        .await
    {
        Ok(Some(proposal)) => {
            info!(
                job_id = job_id,
                proposal_id = %proposal_id,
                "Snapshot proposal found"
            );
            proposal
        }
        Ok(None) => {
            error!(
                job_id = job_id,
                proposal_id = %proposal_id,
                "Snapshot proposal not found"
            );
            return Ok(());
        }
        Err(e) => {
            error!(
                job_id = job_id,
                proposal_id = %proposal_id,
                error = %e,
                "Failed to find snapshot proposal"
            );
            return Err(e).context("Failed to find snapshot proposal")?;
        }
    };

    // Extract discussion_id or slug from discussion_url if it exists
    if let Some(ref discussion_url) = proposal.discussion_url {
        info!(
            job_id = job_id,
            proposal_id = %proposal_id,
            discussion_url = %discussion_url,
            "Found discussion URL in proposal"
        );

        let (topic_id, topic_slug) = extract_discourse_id_or_slug(discussion_url);

        let Some(dao_discourse) = dao_discourse::Entity::find()
            .filter(dao_discourse::Column::DaoId.eq(proposal.dao_id))
            .one(DB.get().unwrap())
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

        info!(
            job_id = job_id,
            proposal_id = %proposal_id,
            dao_discourse_id = %dao_discourse.id,
            "Found DAO discourse configuration"
        );

        // Find the discourse topic by ID or slug
        let discourse_topic = if let Some(topic_id) = topic_id {
            discourse_topic::Entity::find()
                .filter(
                    discourse_topic::Column::ExternalId
                        .eq(topic_id)
                        .and(discourse_topic::Column::DaoDiscourseId.eq(dao_discourse.id)),
                )
                .one(DB.get().unwrap())
                .await
                .context("Failed to find discourse topic by ID")?
        } else if let Some(topic_slug) = topic_slug {
            discourse_topic::Entity::find()
                .filter(
                    discourse_topic::Column::Slug
                        .eq(topic_slug)
                        .and(discourse_topic::Column::DaoDiscourseId.eq(dao_discourse.id)),
                )
                .one(DB.get().unwrap())
                .await
                .context("Failed to find discourse topic by slug")?
        } else {
            None
        };

        if let Some(topic) = discourse_topic {
            info!(
                job_id = job_id,
                proposal_id = %proposal_id,
                discourse_topic_id = %topic.id,
                "Found discourse topic"
            );

            // Find the proposal group containing this topic directly
            let group = proposal_group::Entity::find()
                .filter(Expr::expr(Expr::col(proposal_group::Column::Items).cast_as(Alias::new("text"))).like(format!("%{}%", topic.id)))
                .one(DB.get().unwrap())
                .await
                .context("Failed to find proposal group")?;

            if let Some(group) = group {
                info!(
                    job_id = job_id,
                    proposal_id = %proposal_id,
                    group_id = %group.id,
                    "Found proposal group containing the discourse topic"
                );

                if let Ok(mut items) = serde_json::from_value::<Vec<ProposalGroupItem>>(group.items.clone()) {
                    // Check if proposal is not already in the group
                    if !items
                        .iter()
                        .any(|item| item.id == proposal.id.to_string() && item.type_field == "proposal")
                    {
                        info!(
                            job_id = job_id,
                            proposal_id = %proposal_id,
                            "Proposal is not in the group, adding it"
                        );

                        // Add the proposal to the group
                        let indexer = dao_indexer::Entity::find_by_id(proposal.dao_indexer_id)
                            .one(DB.get().unwrap())
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
                        group.items = Set(serde_json::to_value(items).context("Failed to serialize proposal group items")?);
                        proposal_group::Entity::update(group)
                            .exec(DB.get().unwrap())
                            .await
                            .context("Failed to update proposal group")?;

                        info!(
                            job_id = job_id,
                            proposal_id = %proposal_id,
                            discourse_topic_id = %topic.id,
                            "Added snapshot proposal to existing group"
                        );
                        METRICS.get().unwrap().db_updates.add(1, &[]);
                    } else {
                        info!(
                            job_id = job_id,
                            proposal_id = %proposal_id,
                            "Proposal is already in the group"
                        );
                    }
                } else {
                    error!(
                        job_id = job_id,
                        proposal_id = %proposal_id,
                        group_id = %group.id,
                        "Failed to deserialize proposal group items"
                    );
                }
            } else {
                warn!(
                    job_id = job_id,
                    proposal_id = %proposal_id,
                    "No proposal group found for the discourse topic"
                );
            }
        } else {
            warn!(
                job_id = job_id,
                proposal_id = %proposal_id,
                "No discourse topic found for the extracted topic ID or slug"
            );
        }
    } else {
        warn!(
            job_id = job_id,
            proposal_id = %proposal_id,
            "No discussion_url provided in the proposal"
        );
    }

    METRICS
        .get()
        .unwrap()
        .db_query_duration
        .record(start_time.elapsed().as_secs_f64(), &[]);

    info!(
        job_id = job_id,
        proposal_id = %proposal_id,
        "Finished processing snapshot proposal job"
    );

    Ok(())
}

fn extract_discourse_id_or_slug(url: &str) -> (Option<i32>, Option<String>) {
    let url_without_query = url.split('?').next().unwrap_or("");
    let parts: Vec<&str> = url_without_query
        .split('/')
        .filter(|&part| !part.is_empty())
        .collect();

    // Check if the URL contains the "t" segment, which is typical for Discourse
    // topic URLs
    if let Some(index) = parts.iter().position(|&part| part == "t") {
        // Try to extract the ID from the next segment
        let id = parts
            .get(index + 1)
            .and_then(|part| part.parse::<i32>().ok());

        // If no ID is found, try to extract the slug from the next segment
        let slug = if id.is_none() {
            parts.get(index + 1).and_then(|part| {
                if part.is_empty() {
                    None
                } else {
                    Some(part.to_string())
                }
            })
        } else {
            None
        };

        (id, slug)
    } else {
        // If the URL doesn't contain the "t" segment, return None for both ID and slug
        (None, None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_discourse_1() {
        let url = "https://example.com/t/12345";
        assert_eq!(extract_discourse_id_or_slug(url), (Some(12345), None));
    }

    #[test]
    fn test_extract_discourse_2() {
        let url = "https://example.com/t/12345?param=value";
        assert_eq!(extract_discourse_id_or_slug(url), (Some(12345), None));
    }

    #[test]
    fn test_extract_discourse_3() {
        let url = "https://example.com/t/12345/67890";
        assert_eq!(extract_discourse_id_or_slug(url), (Some(12345), None));
    }

    #[test]
    fn test_extract_discourse_4() {
        let url = "https://example.com/t/";
        assert_eq!(extract_discourse_id_or_slug(url), (None, None));
    }

    #[test]
    fn test_extract_discourse_5() {
        let url = "https://example.com/t/abcde";
        assert_eq!(
            extract_discourse_id_or_slug(url),
            (None, Some("abcde".to_string()))
        );
    }

    #[test]
    fn test_extract_discourse_6() {
        let url = "";
        assert_eq!(extract_discourse_id_or_slug(url), (None, None));
    }

    #[test]
    fn test_extract_discourse_7() {
        let url = "https://example.com";
        assert_eq!(extract_discourse_id_or_slug(url), (None, None));
    }

    #[test]
    fn test_extract_discourse_8() {
        let url = "https://example.com/t///12345";
        assert_eq!(extract_discourse_id_or_slug(url), (Some(12345), None));
    }

    #[test]
    fn test_extract_discourse_9() {
        let url = "https://example.com/t/12345/";
        assert_eq!(extract_discourse_id_or_slug(url), (Some(12345), None));
    }

    #[test]
    fn test_extract_discourse_10() {
        let url = "https://forum.arbitrum.foundation/t/non-constitutional-proposal-for-piloting-enhancements-and-strengthening-the-sustainability-of-arbitrumhub-in-the-year-ahead/";
        assert_eq!(
            extract_discourse_id_or_slug(url),
            (
                None,
                Some("non-constitutional-proposal-for-piloting-enhancements-and-strengthening-the-sustainability-of-arbitrumhub-in-the-year-ahead".to_string())
            )
        );
    }
}
