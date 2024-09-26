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
use tracing::{info, instrument, warn};
use utils::{
    errors::*,
    tracing::setup_tracing,
    types::{JobType, ProposalsJob, ProposalsResponse},
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
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    info!("Health check server running on {}", 3000);

    let database_url = std::env::var("DATABASE_URL").expect(DATABASE_URL_NOT_SET);
    let mut opt = ConnectOptions::new(database_url);
    opt.sqlx_logging(false);
    let db: DatabaseConnection = Database::connect(opt)
        .await
        .context(DATABASE_CONNECTION_FAILED)?;

    // Spawn the consumer task
    tokio::spawn(async move {
        let mut backoff = 1;
        loop {
            match consume_jobs(&db).await {
                Ok(true) => {
                    backoff = 1;
                }
                Ok(false) => {
                    // No jobs processed, apply exponential backoff
                    time::sleep(Duration::from_secs(backoff)).await;
                    backoff = (backoff * 2).min(60);
                }
                Err(e) => {
                    warn!("Failed to consume jobs: {:?}", e);
                    time::sleep(Duration::from_secs(backoff)).await;
                    backoff = (backoff * 2).min(60);
                }
            }
        }
    });

    tokio::spawn(async move {
        let client = Client::new();
        loop {
            match client
                .get(format!(
                    "https://oneuptime.com/heartbeat/{}",
                    std::env::var("ONEUPTIME_KEY").expect("ONEUPTIME_KEY missing")
                ))
                .send()
                .await
            {
                Ok(_) => info!("Uptime ping sent successfully"),
                Err(e) => warn!("Failed to send uptime ping: {:?}", e),
            }
            tokio::time::sleep(Duration::from_secs(10)).await;
        }
    });

    tokio::signal::ctrl_c().await?;
    println!("Shutting down...");

    Ok(())
}

#[instrument(skip(database_url))]
async fn setup_database(database_url: &str) -> Result<DatabaseConnection> {
    let mut opt = ConnectOptions::new(database_url.to_string());
    opt.sqlx_logging(false);
    Database::connect(opt)
        .await
        .context(DATABASE_CONNECTION_FAILED)
}

#[instrument(skip(db))]
async fn consume_jobs(db: &DatabaseConnection) -> Result<bool> {
    let jobs = get_next_jobs(db).await?;
    if jobs.is_empty() {
        return Ok(false);
    }

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
                            warn!("Failed to process proposals job: {:?}", e);
                            decrease_refresh_speed(&proposaljob, &db).await?;
                            mark_job_failed(job.id, &db).await?;
                        } else {
                            increase_refresh_speed(&proposaljob, &db).await?;
                            mark_job_processed(job.id, &db).await?;
                        }
                    }
                    _ => {
                        warn!("Unknown job type: {}", job.job_type);
                        mark_job_failed(job.id, &db).await?;
                    }
                }
                Ok::<(), anyhow::Error>(())
            })
        })
        .collect();

    for task in tasks {
        if let Err(e) = task.await {
            warn!("Task failed: {:?}", e);
        }
    }

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

#[instrument]
async fn process_proposals_job(job: &ProposalsJob, db: &DatabaseConnection) -> Result<()> {
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

    let response = ProposalsResponse {
        inserted_proposals,
        updated_proposals,
        new_index,
        dao_handler_id: dao_handler.id,
    };

    info!("{:?}", response);

    Ok(())
}

#[instrument(skip(parsed_proposals, db))]
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

    Ok(new_index)
}

struct StoredProposals {
    inserted_proposals: u32,
    updated_proposals: u32,
}

#[instrument(skip(db))]
async fn store_proposals(
    parsed_proposals: &[proposal::ActiveModel],
    db: &DatabaseConnection,
) -> Result<StoredProposals> {
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

    Ok(StoredProposals {
        inserted_proposals,
        updated_proposals,
    })
}

#[instrument]
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

#[instrument]
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
