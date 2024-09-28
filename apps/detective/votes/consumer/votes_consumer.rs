use anyhow::{bail, Context, Result};
use async_trait::async_trait;
use axum::{routing::get, Router};
use dotenv::dotenv;
use reqwest::Client;
use sea_orm::{
    prelude::Uuid,
    sea_query::{LockBehavior, LockType},
    ActiveValue::NotSet,
    ColumnTrait, Condition, ConnectOptions, Database, DatabaseConnection, EntityTrait, Order,
    QueryFilter, QueryOrder, QuerySelect, Set, TransactionTrait,
};
use seaorm::{
    dao, dao_handler, job_queue, proposal,
    sea_orm_active_enums::{DaoHandlerEnumV4, ProposalStateEnum},
    vote, voter,
};
use std::{
    cmp::Reverse,
    collections::{HashMap, HashSet},
};
use tokio::time::{self, Duration};
use tracing::{error, info, instrument, warn};
use utils::{
    errors::*,
    tracing::setup_tracing,
    types::{JobType, VotesJob},
};

mod handlers;

pub struct VotesResult {
    votes: Vec<vote::ActiveModel>,
    to_index: Option<i32>,
}

#[async_trait]
pub trait VotesHandler: Send + Sync {
    async fn get_proposal_votes(
        &self,
        dao_handler: &dao_handler::Model,
        dao: &dao::Model,
        proposal: &proposal::Model,
    ) -> Result<VotesResult>;
    async fn get_dao_votes(&self, dao_handler: &dao_handler::Model) -> Result<VotesResult>;
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
                    t if t == JobType::Votes.as_str() => {
                        let votesjob: VotesJob =
                            serde_json::from_value(job.job).context(DESERIALIZE_JOB_FAILED)?;
                        if let Err(e) = process_votes_job(&votesjob, &db).await {
                            error!(
                                error = %e,
                                job_id = job.id,
                                dao_handler_id = %votesjob.dao_handler_id,
                                proposal_id = ?votesjob.proposal_id,
                                "Failed to process votes job"
                            );
                            decrease_refresh_speed(&votesjob, &db).await?;
                            mark_job_failed(job.id, &db).await?;
                        } else {
                            info!(
                                job_id = job.id,
                                job_type = %job.job_type,
                                dao_handler_id = %votesjob.dao_handler_id,
                                proposal_id = ?votesjob.proposal_id,
                                "Successfully processed votes job"
                            );
                            increase_refresh_speed(&votesjob, &db).await?;
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

    for task in tasks {
        if let Err(e) = task.await {
            error!(
                error = %e,
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
        .filter(job_queue::Column::JobType.eq(JobType::Votes.as_str()))
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

#[instrument(skip(db), fields(dao_handler_id = job.dao_handler_id.to_string(), proposal_id = ?job.proposal_id))]
async fn process_votes_job(job: &VotesJob, db: &DatabaseConnection) -> Result<()> {
    info!(
        dao_handler_id = %job.dao_handler_id,
        proposal_id = ?job.proposal_id,
        "Processing votes job"
    );

    let dao_handler = dao_handler::Entity::find()
        .filter(dao_handler::Column::Id.eq(job.dao_handler_id))
        .one(db)
        .await
        .context(DATABASE_ERROR)?
        .context(DAOHANDLER_NOT_FOUND_ERROR)?;

    let handler = handlers::get_handler(&dao_handler.handler_type);

    match job.proposal_id {
        Some(proposal_id) => {
            let dao = dao::Entity::find()
                .filter(dao::Column::Id.eq(dao_handler.dao_id))
                .one(db)
                .await
                .context(DATABASE_ERROR)?
                .context(DAOHANDLER_NOT_FOUND_ERROR)?;

            let proposal = proposal::Entity::find()
                .filter(proposal::Column::Id.eq(proposal_id))
                .one(db)
                .await
                .context(DATABASE_ERROR)?
                .context(PROPOSAL_NOT_FOUND_ERROR)?;

            let VotesResult { votes, to_index: _ } = handler
                .get_proposal_votes(&dao_handler, &dao, &proposal)
                .await?;

            store_voters(&votes, db).await?;

            let StoredVotes {
                inserted_votes,
                updated_votes,
            } = store_proposal_votes(&votes, db).await?;

            let new_index = update_proposal_index(&votes, &proposal, db).await?;

            info!(
                dao_handler_id = %dao_handler.id,
                proposal_id = ?proposal.id,
                inserted_votes = inserted_votes,
                updated_votes = updated_votes,
                new_index = new_index,
                "Proposal votes job processed successfully"
            );
            Ok(())
        }
        None => {
            let VotesResult { votes, to_index } = handler.get_dao_votes(&dao_handler).await?;

            store_voters(&votes, db).await?;

            let StoredVotes {
                inserted_votes,
                updated_votes,
            } = store_dao_votes(&votes, &dao_handler, db).await?;

            let new_index = update_dao_index(&votes, &dao_handler, to_index, db).await?;

            info!(
                dao_handler_id = %dao_handler.id,
                inserted_votes = inserted_votes,
                updated_votes = updated_votes,
                new_index = new_index,
                "DAO votes job processed successfully"
            );
            Ok(())
        }
    }
}

#[instrument(skip(parsed_votes, db), fields(dao_handler_id = %dao_handler.id, current_index = dao_handler.votes_index))]
async fn update_dao_index(
    parsed_votes: &[vote::ActiveModel],
    dao_handler: &dao_handler::Model,
    to_index: Option<i32>,
    db: &DatabaseConnection,
) -> Result<i32> {
    let mut new_index = *parsed_votes
        .iter()
        .map(|v| v.index_created.as_ref())
        .max()
        .unwrap_or(&dao_handler.votes_index);

    if dao_handler.handler_type != DaoHandlerEnumV4::Snapshot {
        new_index = to_index.unwrap_or(dao_handler.votes_index + dao_handler.votes_refresh_speed);
    }

    if new_index > dao_handler.proposals_index
        && dao_handler.handler_type != DaoHandlerEnumV4::MakerPollArbitrum
        && dao_handler.handler_type != DaoHandlerEnumV4::AaveV3PolygonPos
        && dao_handler.handler_type != DaoHandlerEnumV4::AaveV3Avalanche
    {
        new_index = dao_handler.proposals_index;
    }

    dao_handler::Entity::update(dao_handler::ActiveModel {
        id: Set(dao_handler.id),
        votes_index: Set(new_index),
        ..Default::default()
    })
    .exec(db)
    .await
    .context(DATABASE_ERROR)?;

    info!(
        dao_handler_id = %dao_handler.id,
        old_index = dao_handler.votes_index,
        new_index,
       "Index updated successfully"
    );

    Ok(new_index)
}

#[instrument(skip(parsed_votes, db), fields(proposal_id = %proposal.id, current_index = proposal.votes_index))]
async fn update_proposal_index(
    parsed_votes: &[vote::ActiveModel],
    proposal: &proposal::Model,
    db: &DatabaseConnection,
) -> Result<i32> {
    let new_index = parsed_votes
        .iter()
        .map(|v| v.index_created.as_ref())
        .max()
        .unwrap_or(&proposal.votes_index);

    let fetched_votes = proposal.proposal_state != ProposalStateEnum::Active
        && proposal.proposal_state != ProposalStateEnum::Pending
        && parsed_votes.is_empty();

    proposal::Entity::update(proposal::ActiveModel {
        id: Set(proposal.id),
        votes_index: Set(*new_index),
        votes_fetched: Set(fetched_votes),
        ..Default::default()
    })
    .exec(db)
    .await
    .context(DATABASE_ERROR)?;

    info!(
        proposal_id = %proposal.id,
        old_index = proposal.votes_index,
        new_index = *new_index,
        fetched_votes,
        "Index updated successfully"
    );

    Ok(*new_index)
}

#[instrument(skip(parsed_votes, db), fields(voter_count = parsed_votes.len()))]
async fn store_voters(parsed_votes: &[vote::ActiveModel], db: &DatabaseConnection) -> Result<()> {
    let voters = parsed_votes
        .iter()
        .map(|v| v.voter_address.clone().take().unwrap())
        .collect::<HashSet<String>>();

    info!(voter_count = voters.len(), "Storing voters");

    let txn = db.begin().await.context(DB_TRANSACTION_BEGIN_FAILED)?;

    let existing_voters = voter::Entity::find()
        .filter(voter::Column::Address.is_in(voters.clone()))
        .all(&txn)
        .await
        .context(DATABASE_ERROR)?;

    let existing_voters_addresses: Vec<String> =
        existing_voters.into_iter().map(|v| v.address).collect();

    let new_voters: Vec<String> = voters
        .into_iter()
        .filter(|v| !existing_voters_addresses.contains(v))
        .collect();

    let voters_to_insert = new_voters
        .iter()
        .map(|v| voter::ActiveModel {
            id: NotSet,
            address: Set(v.clone()),
            ens: NotSet,
        })
        .collect::<Vec<voter::ActiveModel>>();

    // Insert voters in batches to avoid exceeding parameter limit
    const BATCH_SIZE: usize = 1000;
    for (i, chunk) in voters_to_insert.chunks(BATCH_SIZE).enumerate() {
        voter::Entity::insert_many(chunk.to_vec())
            .on_empty_do_nothing()
            .exec(&txn)
            .await
            .context(DATABASE_ERROR)?;

        info!(
            batch = i + 1,
            batch_size = chunk.len(),
            "Inserted voter batch"
        );
    }

    txn.commit().await.context(DB_TRANSACTION_COMMIT_FAILED)?;

    info!(new_voters = new_voters.len(), "Voters stored successfully");
    Ok(())
}

struct StoredVotes {
    inserted_votes: u32,
    updated_votes: u32,
}

#[instrument(skip(parsed_votes, db))]
async fn store_dao_votes(
    parsed_votes: &[vote::ActiveModel],
    dao_handler: &dao_handler::Model,
    db: &DatabaseConnection,
) -> Result<StoredVotes> {
    let mut inserted_votes = 0;
    let mut updated_votes = 0;

    // group votes by proposal so we can filter next
    let mut grouped_votes: HashMap<(String, String), Vec<vote::ActiveModel>> = HashMap::new();
    for vote in parsed_votes {
        let key = (
            vote.proposal_external_id.clone().take().unwrap(),
            vote.voter_address.clone().take().unwrap(),
        );
        grouped_votes.entry(key).or_default().push(vote.clone());
    }

    // filter only the newest vote, this will be used from now on
    let last_votes: Vec<vote::ActiveModel> = grouped_votes
        .into_iter()
        .flat_map(|(_, mut votes)| {
            votes.sort_by_key(|v| Reverse(v.index_created.clone().take()));
            votes.into_iter().last()
        })
        .collect();

    let proposal_external_ids = last_votes
        .clone()
        .into_iter()
        .map(|v| v.proposal_external_id.clone().unwrap())
        .collect::<HashSet<String>>();

    // the proposal might be on different chain
    // ex: aave mainnet proposal with aave polygon votes
    let proposal_handler_id = match dao_handler.handler_type {
        DaoHandlerEnumV4::AaveV2Mainnet
        | DaoHandlerEnumV4::AaveV3Mainnet
        | DaoHandlerEnumV4::CompoundMainnet
        | DaoHandlerEnumV4::UniswapMainnet
        | DaoHandlerEnumV4::EnsMainnet
        | DaoHandlerEnumV4::GitcoinMainnet
        | DaoHandlerEnumV4::GitcoinV2Mainnet
        | DaoHandlerEnumV4::HopMainnet
        | DaoHandlerEnumV4::DydxMainnet
        | DaoHandlerEnumV4::FraxAlphaMainnet
        | DaoHandlerEnumV4::FraxOmegaMainnet
        | DaoHandlerEnumV4::NounsProposalsMainnet
        | DaoHandlerEnumV4::ArbCoreArbitrum
        | DaoHandlerEnumV4::ArbTreasuryArbitrum
        | DaoHandlerEnumV4::MakerExecutiveMainnet
        | DaoHandlerEnumV4::MakerPollMainnet
        | DaoHandlerEnumV4::OpOptimism
        | DaoHandlerEnumV4::Snapshot => vec![dao_handler.id],
        DaoHandlerEnumV4::AaveV3PolygonPos => {
            vec![
                dao_handler::Entity::find()
                    .filter(dao_handler::Column::HandlerType.eq(DaoHandlerEnumV4::AaveV3Mainnet))
                    .one(db)
                    .await
                    .context(DATABASE_ERROR)?
                    .context(DAOHANDLER_NOT_FOUND_ERROR)?
                    .id,
            ]
        }
        DaoHandlerEnumV4::AaveV3Avalanche => {
            vec![
                dao_handler::Entity::find()
                    .filter(dao_handler::Column::HandlerType.eq(DaoHandlerEnumV4::AaveV3Mainnet))
                    .one(db)
                    .await
                    .context(DATABASE_ERROR)?
                    .context(DAOHANDLER_NOT_FOUND_ERROR)?
                    .id,
            ]
        }
        DaoHandlerEnumV4::MakerPollArbitrum => {
            vec![
                dao_handler::Entity::find()
                    .filter(dao_handler::Column::HandlerType.eq(DaoHandlerEnumV4::MakerPollMainnet))
                    .one(db)
                    .await
                    .context(DATABASE_ERROR)?
                    .context(DAOHANDLER_NOT_FOUND_ERROR)?
                    .id,
            ]
        }
    };

    let proposals = proposal::Entity::find()
        .filter(
            Condition::all()
                .add(proposal::Column::ExternalId.is_in(proposal_external_ids.clone()))
                .add(proposal::Column::DaoHandlerId.is_in(proposal_handler_id)),
        )
        .all(db)
        .await
        .context(DATABASE_ERROR)?;

    if proposals.len() != proposal_external_ids.len() {
        bail!(
            "One of these proposals was not found ${:?}",
            proposal_external_ids.clone()
        );
    }

    let proposal_map: HashMap<String, String> = proposals
        .clone()
        .into_iter()
        .map(|p| (p.external_id, p.id.into()))
        .collect();

    let mut votes_to_process: Vec<vote::ActiveModel> = vec![];

    for vote in last_votes {
        if let Some(proposal_id) = proposal_map.get(&vote.proposal_external_id.clone().unwrap()) {
            let mut vote_clone = vote.clone();
            vote_clone.proposal_id = Set(Uuid::parse_str(proposal_id.clone().as_str()).unwrap());
            votes_to_process.push(vote_clone);
        }
    }

    let mut votes_to_insert = vec![];

    for vote in votes_to_process.clone() {
        let existing_vote = vote::Entity::find()
            .filter(
                Condition::all()
                    .add(vote::Column::ProposalId.eq(vote.proposal_id.clone().take().unwrap()))
                    .add(vote::Column::VoterAddress.eq(vote.voter_address.clone().take().unwrap())),
            )
            .one(db)
            .await
            .context(DATABASE_ERROR)?;

        if let Some(existing) = existing_vote {
            let mut updated_vote = vote.clone();
            updated_vote.id = Set(existing.id);

            vote::Entity::update(updated_vote.clone())
                .exec(db)
                .await
                .context(DATABASE_ERROR)?;

            updated_votes += 1;
        } else {
            votes_to_insert.push(vote);
            inserted_votes += 1;
        }
    }

    // Insert votes in batches to avoid exceeding parameter limit
    const BATCH_SIZE: usize = 1000;
    for chunk in votes_to_insert.chunks(BATCH_SIZE) {
        vote::Entity::insert_many(chunk.to_vec())
            .on_empty_do_nothing()
            .exec(db)
            .await
            .context(DATABASE_ERROR)?;
    }

    info!(
        dao_handler_id = %dao_handler.id,
        inserted_votes,
        updated_votes,
        total_votes = inserted_votes + updated_votes,
        "Stored DAO votes"
    );

    Ok(StoredVotes {
        inserted_votes,
        updated_votes,
    })
}

#[instrument(skip(parsed_votes, db))]
async fn store_proposal_votes(
    parsed_votes: &[vote::ActiveModel],
    db: &DatabaseConnection,
) -> Result<StoredVotes> {
    let mut inserted_votes = 0;
    let mut updated_votes = 0;

    let mut votes_to_insert = vec![];

    for vote in parsed_votes.iter().cloned() {
        let existing_vote = vote::Entity::find()
            .filter(
                Condition::all()
                    .add(vote::Column::ProposalId.eq(vote.proposal_id.clone().take()))
                    .add(vote::Column::VoterAddress.eq(vote.voter_address.clone().take())),
            )
            .one(db)
            .await
            .context(DATABASE_ERROR)?;

        if existing_vote.is_some() {
            let mut updated_vote = vote.clone();
            updated_vote.id = Set(existing_vote.unwrap().id);

            vote::Entity::update(updated_vote.clone())
                .exec(db)
                .await
                .context(DATABASE_ERROR)?;

            updated_votes += 1;
        } else {
            votes_to_insert.push(vote);
            inserted_votes += 1;
        }
    }

    // Insert votes in batches to avoid exceeding parameter limit
    const BATCH_SIZE: usize = 1000;
    for chunk in votes_to_insert.chunks(BATCH_SIZE) {
        vote::Entity::insert_many(chunk.to_vec())
            .on_empty_do_nothing()
            .exec(db)
            .await
            .context(DATABASE_ERROR)?;
    }

    info!(
        proposal_id = %parsed_votes[0].proposal_id.clone().take().unwrap(),
        inserted_votes,
        updated_votes,
        total_votes = inserted_votes + updated_votes,
        "Stored proposal votes"
    );

    Ok(StoredVotes {
        inserted_votes,
        updated_votes,
    })
}

#[instrument(skip(db))]
async fn decrease_refresh_speed(job: &VotesJob, db: &DatabaseConnection) -> Result<()> {
    let dao_handler = dao_handler::Entity::find()
        .filter(dao_handler::Column::Id.eq(job.dao_handler_id))
        .one(db)
        .await
        .context(DATABASE_ERROR)?
        .context(DAOHANDLER_NOT_FOUND_ERROR)?;

    let handler = handlers::get_handler(&dao_handler.handler_type);

    match job.proposal_id {
        Some(proposal_id) => {
            let proposal = proposal::Entity::find()
                .filter(proposal::Column::Id.eq(proposal_id))
                .one(db)
                .await
                .context(DATABASE_ERROR)?
                .context(PROPOSAL_NOT_FOUND_ERROR)?;

            let mut new_refresh_speed = (proposal.votes_refresh_speed as f32 * 0.5) as i32;

            if new_refresh_speed < handler.min_refresh_speed() {
                new_refresh_speed = handler.min_refresh_speed();
            }

            proposal::Entity::update(proposal::ActiveModel {
                id: Set(proposal.id),
                votes_refresh_speed: Set(new_refresh_speed),
                ..Default::default()
            })
            .exec(db)
            .await
            .context(DATABASE_ERROR)?;

            info!(
                proposal_id = %proposal_id,
                old_speed = proposal.votes_refresh_speed,
                new_speed = new_refresh_speed,
                "Decreased proposal refresh speed"
            );

            Ok(())
        }
        None => {
            let mut new_refresh_speed = (dao_handler.votes_refresh_speed as f32 * 0.5) as i32;

            if new_refresh_speed < handler.min_refresh_speed() {
                new_refresh_speed = handler.min_refresh_speed();
            }

            dao_handler::Entity::update(dao_handler::ActiveModel {
                id: Set(dao_handler.id),
                votes_refresh_speed: Set(new_refresh_speed),
                ..Default::default()
            })
            .exec(db)
            .await
            .context(DATABASE_ERROR)?;

            info!(
                dao_handler_id = %dao_handler.id,
                old_speed = dao_handler.votes_refresh_speed,
                new_speed = new_refresh_speed,
                "Decreased DAO handler refresh speed"
            );
            Ok(())
        }
    }
}

#[instrument(skip(db))]
async fn increase_refresh_speed(job: &VotesJob, db: &DatabaseConnection) -> Result<()> {
    let dao_handler = dao_handler::Entity::find()
        .filter(dao_handler::Column::Id.eq(job.dao_handler_id))
        .one(db)
        .await
        .context(DATABASE_ERROR)?
        .context(DAOHANDLER_NOT_FOUND_ERROR)?;

    let handler = handlers::get_handler(&dao_handler.handler_type);

    match job.proposal_id {
        Some(proposal_id) => {
            let proposal = proposal::Entity::find()
                .filter(proposal::Column::Id.eq(proposal_id))
                .one(db)
                .await
                .context(DATABASE_ERROR)?
                .context(PROPOSAL_NOT_FOUND_ERROR)?;

            let mut new_refresh_speed = (proposal.votes_refresh_speed as f32 * 1.2) as i32;

            if new_refresh_speed > handler.max_refresh_speed() {
                new_refresh_speed = handler.max_refresh_speed();
            }

            proposal::Entity::update(proposal::ActiveModel {
                id: Set(proposal.id),
                votes_refresh_speed: Set(new_refresh_speed),
                ..Default::default()
            })
            .exec(db)
            .await
            .context(DATABASE_ERROR)?;

            info!(
                proposal_id = %proposal_id,
                old_speed = proposal.votes_refresh_speed,
                new_speed = new_refresh_speed,
                "Increased proposal refresh speed"
            );
            Ok(())
        }
        None => {
            let mut new_refresh_speed = (dao_handler.votes_refresh_speed as f32 * 1.2) as i32;

            if new_refresh_speed > handler.max_refresh_speed() {
                new_refresh_speed = handler.max_refresh_speed();
            }

            dao_handler::Entity::update(dao_handler::ActiveModel {
                id: Set(dao_handler.id),
                votes_refresh_speed: Set(new_refresh_speed),
                ..Default::default()
            })
            .exec(db)
            .await
            .context(DATABASE_ERROR)?;

            info!(
                dao_handler_id = %dao_handler.id,
                old_speed = dao_handler.votes_refresh_speed,
                new_speed = new_refresh_speed,
                "Increased DAO handler refresh speed"
            );
            Ok(())
        }
    }
}
