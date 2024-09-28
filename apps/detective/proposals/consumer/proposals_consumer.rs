use anyhow::{Context, Result};
use async_trait::async_trait;
use axum::{routing::get, Router};
use dotenv::dotenv;
use itertools::Itertools;
use reqwest::Client;
use sea_orm::{
    sea_query::{LockBehavior, LockType},
    ColumnTrait, Condition, ConnectOptions, Database, DatabaseConnection, EntityTrait, Order,
    QueryFilter, QueryOrder, QuerySelect, Set, TransactionTrait,
};
use seaorm::{
    dao, dao_handler, job_queue, proposal,
    sea_orm_active_enums::{DaoHandlerEnumV4, ProposalStateEnum},
};
use std::collections::HashSet;
use tokio::time::{self, Duration};
use tracing::error;
use tracing::{info, instrument, warn};
use utils::{
    errors::*,
    tracing::setup_tracing,
    types::{JobType, ProposalsJob},
};

mod handlers;

pub struct ProposalsResult {
    proposals: Vec<proposal::ActiveModel>,
    to_index: Option<i32>,
}

#[async_trait]
pub trait ProposalHandler: Send + Sync {
    async fn get_proposals(
        &self,
        dao_handler: &dao_handler::Model,
        dao: &dao::Model,
        from_index: i32,
    ) -> Result<ProposalsResult>;
    fn min_refresh_speed(&self) -> i32;
    fn max_refresh_speed(&self) -> i32;
}

#[tokio::main]
#[instrument]
async fn main() -> Result<()> {
    dotenv().ok();
    setup_tracing();

    let app = Router::new().route("/", get("OK"));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000")
        .await
        .context("Failed to bind TCP listener")?;
    tokio::spawn(async move {
        info!("Starting health check server");
        if let Err(e) = axum::serve(listener, app).await {
            error!("Health check server error: {}", e);
        }
    });
    info!(port = 3000, "Health check server running");

    let db: DatabaseConnection = setup_database().await?;

    // Spawn the consumer task
    tokio::spawn(async move {
        let mut backoff = 1;
        loop {
            match consume_jobs(&db).await {
                Ok(true) => {
                    backoff = 1;
                    info!("Jobs processed successfully");
                }
                Ok(false) => {
                    info!(backoff_seconds = backoff, "No jobs to process, backing off");
                    time::sleep(Duration::from_secs(backoff)).await;
                    backoff = (backoff * 2).min(60);
                }
                Err(e) => {
                    error!(error = %e, backoff_seconds = backoff, "Failed to consume jobs");
                    time::sleep(Duration::from_secs(backoff)).await;
                    backoff = (backoff * 2).min(60);
                }
            }
        }
    });

    tokio::spawn(async move {
        let client = Client::new();
        match std::env::var("ONEUPTIME_KEY") {
            Ok(oneuptime_key) => loop {
                let start_time = std::time::Instant::now();
                match client.get(&oneuptime_key).send().await {
                    Ok(response) => {
                        let duration = start_time.elapsed();
                        info!(
                            status = %response.status(),
                            duration_ms = duration.as_millis(),
                            "Uptime ping sent successfully"
                        );
                    }
                    Err(e) => {
                        error!(error = %e, "Failed to send uptime ping");
                    }
                }
                tokio::time::sleep(Duration::from_secs(10)).await;
            },
            Err(e) => {
                error!("Failed to get ONEUPTIME_KEY: {}", e);
            }
        }
    });

    tokio::signal::ctrl_c().await?;
    info!("Shutting down...");

    Ok(())
}

#[instrument]
async fn setup_database() -> Result<DatabaseConnection> {
    let database_url = std::env::var("DATABASE_URL").context(DATABASE_URL_NOT_SET)?;
    let mut opt = ConnectOptions::new(database_url.to_string());
    opt.sqlx_logging(false);
    Database::connect(opt)
        .await
        .context(DATABASE_CONNECTION_FAILED)
}

#[instrument(skip(db), fields(job_count))]
async fn consume_jobs(db: &DatabaseConnection) -> Result<bool> {
    let jobs = get_next_jobs(db).await?;
    let job_count = jobs.len();
    tracing::Span::current().record("job_count", job_count);

    if jobs.is_empty() {
        info!("No jobs to process");
        return Ok(false);
    }

    info!(job_count = job_count, "Processing jobs");

    let tasks: Vec<_> = jobs
        .into_iter()
        .map(|job| {
            let db = db.clone();
            tokio::spawn(async move {
                let job_type_str = job.job_type.as_str();
                match job_type_str {
                    t if t == JobType::Proposals.as_str() => {
                        let proposaljob: ProposalsJob =
                            serde_json::from_value(job.job).context(DESERIALIZE_JOB_FAILED)?;
                        if let Err(e) = process_proposals_job(&proposaljob, &db).await {
                            error!(
                                error = %e,
                                job_id = job.id,
                                dao_handler_id = %proposaljob.dao_handler_id,
                                "Failed to process proposals job"
                            );
                            decrease_refresh_speed(&proposaljob, &db).await?;
                            mark_job_failed(job.id, &db).await?;
                        } else {
                            info!(
                                job_id = job.id,
                                dao_handler_id = %proposaljob.dao_handler_id,
                                "Proposals job processed successfully"
                            );
                            increase_refresh_speed(&proposaljob, &db).await?;
                            mark_job_processed(job.id, &db).await?;
                        }
                    }
                    _ => {
                        error!(
                            job_type = %job.job_type,
                            job_id = job.id,
                            "Unknown job type"
                        );
                        mark_job_failed(job.id, &db).await?;
                    }
                }
                Ok::<(), anyhow::Error>(())
            })
        })
        .collect();

    for (index, task) in tasks.into_iter().enumerate() {
        if let Err(e) = task.await {
            error!(
                error = %e,
                task_index = index,
                "Task failed"
            );
        }
    }

    info!(job_count = job_count, "All jobs processed");
    Ok(true)
}

#[instrument(skip(db))]
async fn get_next_jobs(db: &DatabaseConnection) -> Result<Vec<job_queue::Model>> {
    let transaction = db.begin().await.context(DATABASE_ERROR)?;

    let jobs = job_queue::Entity::find()
        .filter(job_queue::Column::Processed.eq(false))
        .filter(job_queue::Column::JobType.eq(JobType::Proposals.as_str()))
        .order_by(job_queue::Column::CreatedAt, Order::Asc)
        .lock_with_behavior(LockType::Update, LockBehavior::SkipLocked)
        .limit(5)
        .all(&transaction)
        .await
        .context(DATABASE_ERROR)?;

    transaction.commit().await.context(DATABASE_ERROR)?;
    Ok(jobs)
}

#[instrument(skip(db))]
async fn mark_job_processed(job_id: i32, db: &DatabaseConnection) -> Result<()> {
    job_queue::Entity::update(job_queue::ActiveModel {
        id: Set(job_id),
        processed: Set(Some(true)),
        ..Default::default()
    })
    .exec(db)
    .await
    .context(DATABASE_ERROR)?;

    Ok(())
}

#[instrument(skip(db))]
async fn mark_job_failed(job_id: i32, db: &DatabaseConnection) -> Result<()> {
    job_queue::Entity::update(job_queue::ActiveModel {
        id: Set(job_id),
        processed: Set(Some(false)),
        ..Default::default()
    })
    .exec(db)
    .await
    .context(DATABASE_ERROR)?;

    Ok(())
}

#[instrument(skip(db), fields(dao_handler_id = %job.dao_handler_id, from_index = job.from_index))]
async fn process_proposals_job(job: &ProposalsJob, db: &DatabaseConnection) -> Result<()> {
    info!(
        dao_handler_id = %job.dao_handler_id,
        from_index = job.from_index,
        "Processing proposals job"
    );

    let dao_handler = dao_handler::Entity::find()
        .filter(dao_handler::Column::Id.eq(job.dao_handler_id))
        .one(db)
        .await
        .context(DATABASE_ERROR)?
        .context(DAOHANDLER_NOT_FOUND_ERROR)?;

    let dao = dao::Entity::find()
        .filter(dao::Column::Id.eq(dao_handler.dao_id))
        .one(db)
        .await
        .context(DATABASE_ERROR)?
        .context(DAOHANDLER_NOT_FOUND_ERROR)?;

    let handler = handlers::get_handler(&dao_handler.handler_type);

    let ProposalsResult {
        proposals,
        to_index,
    } = handler
        .get_proposals(&dao_handler, &dao, job.from_index)
        .await?;

    let StoredProposals {
        inserted_proposals,
        updated_proposals,
    } = store_proposals(&proposals, db).await?;

    let new_index = update_index(&proposals, &dao_handler, to_index, db).await?;

    info!(
        new_index,
        inserted_proposals, updated_proposals, "Proposals job processed successfully"
    );

    Ok(())
}

#[instrument(skip(parsed_proposals, db), fields(dao_handler_id = %dao_handler.id, current_index = dao_handler.proposals_index))]
async fn update_index(
    parsed_proposals: &[proposal::ActiveModel],
    dao_handler: &dao_handler::Model,
    to_index: Option<i32>,
    db: &DatabaseConnection,
) -> Result<i32> {
    let mut new_index =
        to_index.unwrap_or(dao_handler.proposals_index + dao_handler.proposals_refresh_speed);

    let sorted_proposals = parsed_proposals
        .iter()
        .sorted_by(|a, b| a.index_created.as_ref().cmp(b.index_created.as_ref()))
        .collect_vec();

    for proposal in sorted_proposals.iter() {
        if proposal.proposal_state.as_ref() == &ProposalStateEnum::Active
            || (proposal.proposal_state.as_ref() == &ProposalStateEnum::Pending
                && dao_handler.handler_type == DaoHandlerEnumV4::Snapshot)
                && proposal.index_created.is_set()
                && proposal.index_created.clone().unwrap() < new_index
        {
            new_index = proposal.index_created.clone().unwrap();
            break;
        }
    }

    dao_handler::Entity::update(dao_handler::ActiveModel {
        id: Set(dao_handler.id),
        proposals_index: Set(new_index),
        ..Default::default()
    })
    .exec(db)
    .await
    .context(DATABASE_ERROR)?;

    info!(
        dao_handler_id = %dao_handler.id,
        new_index,
        "Index updated successfully"
    );

    Ok(new_index)
}

struct StoredProposals {
    inserted_proposals: u32,
    updated_proposals: u32,
}

#[instrument(skip(db, parsed_proposals), fields(proposal_count = parsed_proposals.len()))]
async fn store_proposals(
    parsed_proposals: &[proposal::ActiveModel],
    db: &DatabaseConnection,
) -> Result<StoredProposals> {
    info!(proposal_count = parsed_proposals.len(), "Storing proposals");

    let mut inserted_proposals = 0;
    let mut updated_proposals = 0;

    let mut proposals_to_insert = vec![];
    let mut insert_ids_unique = HashSet::new();

    for proposal in parsed_proposals.iter().cloned() {
        let existing_proposal = proposal::Entity::find()
            .filter(
                Condition::all()
                    .add(proposal::Column::ExternalId.eq(proposal.external_id.clone().take()))
                    .add(proposal::Column::DaoHandlerId.eq(proposal.dao_handler_id.clone().take())),
            )
            .one(db)
            .await
            .context(PROPOSAL_NOT_FOUND_ERROR)?;

        if let Some(existing) = existing_proposal {
            let mut updated_proposal = proposal.clone();
            updated_proposal.id = Set(existing.id);

            proposal::Entity::update(updated_proposal.clone())
                .exec(db)
                .await
                .context(DATABASE_ERROR)?;

            updated_proposals += 1;
        } else if insert_ids_unique.insert(proposal.external_id.clone().take()) {
            proposals_to_insert.push(proposal);
            inserted_proposals += 1;
        }
    }

    if !proposals_to_insert.is_empty() {
        proposal::Entity::insert_many(proposals_to_insert)
            .on_empty_do_nothing()
            .exec(db)
            .await
            .context(DATABASE_ERROR)?;
    }

    info!(
        inserted_proposals,
        updated_proposals, "Proposals stored successfully"
    );

    Ok(StoredProposals {
        inserted_proposals,
        updated_proposals,
    })
}

#[instrument(fields(dao_handler_id = job.dao_handler_id.to_string()))]
async fn decrease_refresh_speed(job: &ProposalsJob, db: &DatabaseConnection) -> Result<()> {
    let dao_handler = dao_handler::Entity::find()
        .filter(dao_handler::Column::Id.eq(job.dao_handler_id))
        .one(db)
        .await
        .context(DATABASE_ERROR)?
        .context(DAOHANDLER_NOT_FOUND_ERROR)?;

    let handler = handlers::get_handler(&dao_handler.handler_type);
    let mut new_refresh_speed = (dao_handler.proposals_refresh_speed as f32 * 0.5) as i32;

    if new_refresh_speed < handler.min_refresh_speed() {
        new_refresh_speed = handler.min_refresh_speed();
    }

    info!(
        dao_handler_id = %job.dao_handler_id,
        new_refresh_speed,
        "Decreasing refresh speed for DAO handler"
    );

    dao_handler::Entity::update(dao_handler::ActiveModel {
        id: Set(dao_handler.id),
        proposals_refresh_speed: Set(new_refresh_speed),
        ..Default::default()
    })
    .exec(db)
    .await
    .context(DATABASE_ERROR)?;

    Ok(())
}

#[instrument(fields(dao_handler_id = job.dao_handler_id.to_string()))]
async fn increase_refresh_speed(job: &ProposalsJob, db: &DatabaseConnection) -> Result<()> {
    let dao_handler = dao_handler::Entity::find()
        .filter(dao_handler::Column::Id.eq(job.dao_handler_id))
        .one(db)
        .await
        .context(DATABASE_ERROR)?
        .context(DAOHANDLER_NOT_FOUND_ERROR)?;

    let handler = handlers::get_handler(&dao_handler.handler_type);
    let mut new_refresh_speed = (dao_handler.proposals_refresh_speed as f32 * 1.2) as i32;

    if new_refresh_speed > handler.max_refresh_speed() {
        new_refresh_speed = handler.max_refresh_speed();
    }

    info!(
        dao_handler_id = %job.dao_handler_id,
        new_refresh_speed,
        "Increasing refresh speed for DAO handler"
    );

    dao_handler::Entity::update(dao_handler::ActiveModel {
        id: Set(dao_handler.id),
        proposals_refresh_speed: Set(new_refresh_speed),
        ..Default::default()
    })
    .exec(db)
    .await
    .context(DATABASE_ERROR)?;

    Ok(())
}
