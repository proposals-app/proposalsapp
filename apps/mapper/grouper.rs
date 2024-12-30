use anyhow::Result;
use sea_orm::{
    prelude::Uuid, ActiveValue::NotSet, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter,
    QueryOrder, Set,
};
use seaorm::{dao_discourse, dao_indexer, discourse_topic, job_queue, proposal, proposal_group};
use std::time::Duration;
use tokio::time::{sleep, Instant};
use tracing::{error, info, warn};
use utils::types::{DiscussionJobData, JobType, ProposalGroupItem, ProposalJobData};

pub async fn run_group_task(db: &DatabaseConnection) -> Result<()> {
    let interval = Duration::from_secs(60);
    let mut next_tick = Instant::now() + interval;

    loop {
        if let Err(e) = process_jobs(db).await {
            error!(error = %e, "Error processing jobs");
        }

        sleep(next_tick.saturating_duration_since(Instant::now())).await;
        next_tick += interval;
    }
}

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
        .await?;

    for job in pending_jobs {
        info!(job_id = job.id, job_type = %job.r#type, "Processing job");

        let job_type: JobType = job.r#type.parse()?;

        match job_type {
            JobType::MapperNewProposalDiscussion => {
                let data: DiscussionJobData = serde_json::from_value(job.data.clone())?;
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
                let data: ProposalJobData = serde_json::from_value(job.data.clone())?;
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

async fn process_new_discussion_job(
    conn: &DatabaseConnection,
    job_id: i32,
    discourse_topic_id: Uuid,
) -> Result<()> {
    // Find the discourse topic
    let topic = match discourse_topic::Entity::find_by_id(discourse_topic_id)
        .one(conn)
        .await?
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
        .filter(proposal_group::Column::Items.contains(topic.id.to_string()))
        .all(conn)
        .await?
        .is_empty();

    if !topic_already_mapped {
        let discourse_indexer = dao_indexer::Entity::find_by_id(topic.dao_discourse_id)
            .one(conn)
            .await?;

        // Create new proposal group
        let new_group = proposal_group::ActiveModel {
            id: NotSet,
            dao_id: Set(discourse_indexer.clone().unwrap().dao_id),
            name: Set(topic.title.clone()),
            items: Set(serde_json::to_value(vec![ProposalGroupItem {
                id: topic.id.to_string(),
                type_field: "topic".to_string(),
                name: topic.title.clone(),
                indexer_name: discourse_indexer.unwrap().portal_url.unwrap().to_string(),
            }])
            .unwrap()),
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

async fn process_snapshot_proposal_job(
    conn: &DatabaseConnection,
    job_id: i32,
    proposal_id: Uuid,
) -> Result<()> {
    // Find the snapshot proposal
    let proposal = match proposal::Entity::find_by_id(proposal_id).one(conn).await? {
        Some(proposal) => proposal,
        None => {
            error!(
                job_id = job_id,
                proposal_id = %proposal_id,
                "Snapshot proposal not found"
            );
            return Ok(());
        }
    };

    // Extract discussion_id from discussion_url if it exists
    if let Some(ref discussion_url) = proposal.discussion_url {
        if let Some(topic_id) = extract_discourse_id(discussion_url) {
            let Some(dao_discourse) = dao_discourse::Entity::find()
                .filter(dao_discourse::Column::DaoId.eq(proposal.dao_id))
                .one(conn)
                .await?
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
                        .add(discourse_topic::Column::DaoDiscourseId.eq(dao_discourse.id)),
                )
                .one(conn)
                .await?;

            if let Some(topic) = discourse_topic {
                // Find the proposal group containing this topic directly
                let group = proposal_group::Entity::find()
                    .filter(proposal_group::Column::Items.contains(topic.id.to_string()))
                    .one(conn)
                    .await?;

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
                                .await?
                                .unwrap();

                            items.push(ProposalGroupItem {
                                id: proposal.id.to_string(),
                                type_field: "proposal".to_string(),
                                name: proposal.name.clone(),
                                indexer_name: format!("{:?}", indexer.indexer_variant),
                            });

                            // Update the group
                            let mut group: proposal_group::ActiveModel = group.into();
                            group.items = Set(serde_json::to_value(items)?);
                            proposal_group::Entity::update(group).exec(conn).await?;

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
