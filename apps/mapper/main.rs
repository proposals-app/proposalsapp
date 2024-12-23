#![warn(unused_extern_crates)]

use anyhow::{Context, Result};
use axum::Router;
use dotenv::dotenv;
use reqwest::Client;
use sea_orm::{
    prelude::Uuid, ActiveValue::NotSet, ColumnTrait, ConnectOptions, Database, DatabaseConnection,
    EntityTrait, QueryFilter, QueryOrder, Set,
};
use seaorm::{dao_discourse, dao_indexer, discourse_topic, job_queue, proposal, proposal_group};
use serde::{Deserialize, Serialize};
use std::{fmt::Debug, time::Duration};
use tracing::{error, info, warn};
use utils::{
    tracing::setup_tracing,
    types::{DiscussionJobData, JobType, ProposalJobData},
};
mod karma;

#[derive(Debug, Serialize, Deserialize)]
struct ProposalGroupItem {
    id: String,
    #[serde(rename = "type")]
    type_field: String,
    name: String,
    indexer_name: String,
}

struct Mapper {
    conn: DatabaseConnection,
}

impl Mapper {
    async fn new(database_url: &str) -> Result<Self> {
        let mut opt = ConnectOptions::new(database_url.to_string());
        opt.sqlx_logging(false);
        let conn = Database::connect(opt).await?;

        Ok(Self { conn })
    }

    async fn process_jobs(&self) -> Result<()> {
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
            .all(&self.conn)
            .await?;

        for job in pending_jobs {
            info!(job_id = job.id, "Processing job");

            let job_type: JobType = job.r#type.parse()?;

            match job_type {
                JobType::MapperNewProposalDiscussion => {
                    let data: DiscussionJobData = serde_json::from_value(job.data.clone())?;
                    if let Err(e) = self
                        .process_new_discussion_job(job.id, data.discourse_topic_id)
                        .await
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
                    if let Err(e) = self
                        .process_snapshot_proposal_job(job.id, data.proposal_id)
                        .await
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
            if let Err(e) = job_queue::Entity::update(job).exec(&self.conn).await {
                error!(
                    error = %e,
                    job_id = job_id,
                    "Failed to update job status"
                );
            }
        }

        Ok(())
    }

    async fn process_new_discussion_job(
        &self,
        job_id: i32,
        discourse_topic_id: Uuid,
    ) -> Result<()> {
        // Find the discourse topic
        let topic = match discourse_topic::Entity::find_by_id(discourse_topic_id)
            .one(&self.conn)
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
        let topic_already_mapped = proposal_group::Entity::find()
            .filter(proposal_group::Column::Items.contains(topic.id.to_string()))
            .all(&self.conn)
            .await?
            .len()
            > 0;

        if !topic_already_mapped {
            let discourse_indexer = dao_indexer::Entity::find_by_id(topic.dao_discourse_id)
                .one(&self.conn)
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

            if let Err(e) = proposal_group::Entity::insert(new_group)
                .exec(&self.conn)
                .await
            {
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

    async fn process_snapshot_proposal_job(&self, job_id: i32, proposal_id: Uuid) -> Result<()> {
        // Find the snapshot proposal
        let proposal = match proposal::Entity::find_by_id(proposal_id)
            .one(&self.conn)
            .await?
        {
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
                    .one(&self.conn)
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
                    .one(&self.conn)
                    .await?;

                if let Some(topic) = discourse_topic {
                    // Find the proposal group containing this topic directly
                    let group = proposal_group::Entity::find()
                        .filter(proposal_group::Column::Items.contains(topic.id.to_string()))
                        .one(&self.conn)
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
                                let indexer =
                                    dao_indexer::Entity::find_by_id(proposal.dao_indexer_id)
                                        .one(&self.conn)
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
                                proposal_group::Entity::update(group)
                                    .exec(&self.conn)
                                    .await?;

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

    async fn run(&self) -> Result<()> {
        let mut interval = tokio::time::interval(Duration::from_secs(60));
        loop {
            interval.tick().await;
            info!("Mapping");
            if let Err(e) = self.process_jobs().await {
                error!(error = %e, "Error processing jobs");
            }
        }
    }
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

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    let _tracing = setup_tracing();

    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL must be set")?;

    // Start health check server
    let app = Router::new().route("/", axum::routing::get(|| async { "OK" }));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        info!(address = %addr, "Starting health check server");
        if let Err(e) = axum::serve(listener, app).await {
            error!(error = %e, "Health check server error");
        }
    });

    // Create and run mapper
    let mapper = Mapper::new(&database_url).await?;
    let mapper_handle = tokio::spawn(async move {
        if let Err(e) = mapper.run().await {
            error!(error = %e, "Mapper runtime error");
        }
    });

    // Start karma task
    let karma_handle = tokio::spawn(async move {
        if let Err(e) = karma::run_karma_task(&database_url).await {
            error!(error = %e, "Karma task runtime error");
        }
    });

    // Uptime ping task
    let uptime_key = std::env::var("BETTERSTACK_KEY").context("BETTERSTACK_KEY must be set")?;
    let client = Client::new();
    let uptime_handle = tokio::spawn(async move {
        loop {
            match client.get(uptime_key.clone()).send().await {
                Ok(_) => info!("Uptime ping sent successfully"),
                Err(e) => warn!("Failed to send uptime ping: {:?}", e),
            }
            tokio::time::sleep(Duration::from_secs(10)).await;
        }
    });

    // Join the handles to keep the main thread running
    futures::future::join_all(vec![mapper_handle, karma_handle, uptime_handle]).await;

    Ok(())
}

#[test]
fn test_extract_discourse_id() {
    // Pattern 1: Simple URL
    let url1 = "https://governance.aave.com/t/arfc-chaos-labs-risk-stewards-increase-caps-reth-and-wsteth-on-v3-arbitrum/13817";
    assert_eq!(extract_discourse_id(url1), Some(13817));

    // Pattern 2: URL with query parameters
    let url2 = "https://governance.aave.com/t/bgd-retroactive-bug-bounties-proposal-pre-immunefi/15989?u=marczeller";
    assert_eq!(extract_discourse_id(url2), Some(15989));

    // Pattern 3: URL with post number
    let url3 = "https://governance.aave.com/t/arfc-add-mai-to-arbitrum-aave-v3-market/12759/8";
    assert_eq!(extract_discourse_id(url3), Some(12759));

    // Invalid URL
    let invalid_url = "https://governance.aave.com/t/invalid";
    assert_eq!(extract_discourse_id(invalid_url), None);
}
