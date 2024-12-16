#![warn(unused_extern_crates)]

use anyhow::Result;
use dotenv::dotenv;
use sea_orm::{
    prelude::Uuid, ActiveValue::NotSet, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter,
    QueryOrder, Set,
};
use seaorm::{dao_indexer, discourse_topic, job_queue, proposal_group};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::{error, info};
use utils::tracing::setup_tracing;

#[derive(Debug, Serialize, Deserialize)]
struct MapperNewProposalJob {
    discourse_topic: Uuid,
    category_id: i32,
}

struct Mapper {
    conn: DatabaseConnection,
}

impl Mapper {
    async fn new(database_url: &str) -> Result<Self> {
        let conn = sea_orm::Database::connect(database_url).await?;
        Ok(Self { conn })
    }

    async fn process_jobs(&self) -> Result<()> {
        // Find all pending MAPPER_NEW_PROPOSAL jobs
        let pending_jobs = job_queue::Entity::find()
            .filter(job_queue::Column::Type.eq("MAPPER_NEW_PROPOSAL_DISCUSSION"))
            .filter(job_queue::Column::Status.eq("PENDING"))
            .order_by_asc(job_queue::Column::CreatedAt)
            .all(&self.conn)
            .await?;

        for job in pending_jobs {
            info!(job_id = job.id, "Processing job");

            // Parse job data
            let job_data: MapperNewProposalJob = match serde_json::from_value(job.data.clone()) {
                Ok(data) => data,
                Err(e) => {
                    error!(
                        error = %e,
                        job_id = job.id,
                        "Failed to parse job data"
                    );
                    continue;
                }
            };

            // Find the discourse topic
            let topic = match discourse_topic::Entity::find_by_id(job_data.discourse_topic)
                .one(&self.conn)
                .await?
            {
                Some(topic) => topic,
                None => {
                    error!(
                        job_id = job.id,
                        discourse_topic_id = %job_data.discourse_topic,
                        "Discourse topic not found"
                    );
                    continue;
                }
            };

            // Check if topic is already part of a proposal group
            let existing_groups = proposal_group::Entity::find().all(&self.conn).await?;

            let topic_already_mapped = existing_groups.iter().any(|group| {
                if let Ok(items) =
                    serde_json::from_value::<Vec<ProposalGroupItem>>(group.items.clone())
                {
                    items
                        .iter()
                        .any(|item| item.id == topic.id.to_string() && item.type_field == "topic")
                } else {
                    false
                }
            });

            if !topic_already_mapped {
                let discourse_indexer = dao_indexer::Entity::find_by_id(topic.dao_discourse_id)
                    .one(&self.conn)
                    .await?;

                // Create new proposal group
                let new_group = proposal_group::ActiveModel {
                    id: NotSet,
                    name: Set(topic.title.clone()),
                    items: Set(serde_json::to_value(vec![ProposalGroupItem {
                        id: topic.id.to_string(),
                        type_field: "topic".to_string(),
                        name: topic.title.clone(),
                        indexer_name: discourse_indexer.unwrap().portal_url.unwrap().to_string(),
                    }])
                    .unwrap()),
                    created_at: sea_orm::Set(chrono::Utc::now().naive_utc()),
                };

                if let Err(e) = proposal_group::Entity::insert(new_group)
                    .exec(&self.conn)
                    .await
                {
                    error!(
                        error = %e,
                        job_id = job.id,
                        discourse_topic_id = %job_data.discourse_topic,
                        "Failed to create proposal group"
                    );
                    continue;
                }

                info!(
                    job_id = job.id,
                    discourse_topic_id = %job_data.discourse_topic,
                    "Created new proposal group"
                );
            }

            // Update job status to COMPLETED
            let job_id = job.id; // Store the job ID before converting to ActiveModel
            let mut job: job_queue::ActiveModel = job.into();
            job.status = sea_orm::Set("COMPLETED".to_string());
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

    async fn run(&self) -> Result<()> {
        let mut interval = tokio::time::interval(Duration::from_secs(60));
        loop {
            interval.tick().await;
            if let Err(e) = self.process_jobs().await {
                error!(error = %e, "Error processing jobs");
            }
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct ProposalGroupItem {
    id: String,
    #[serde(rename = "type")]
    type_field: String,
    name: String,
    indexer_name: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    let _tracing = setup_tracing();

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    // Start health check server
    let app = axum::Router::new().route("/", axum::routing::get(|| async { "OK" }));
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
    mapper.run().await?;

    Ok(())
}
