use anyhow::{Context, Result};
use axum::{routing::get, Router};
use dotenv::dotenv;
use sea_orm::{
    ColumnTrait, ConnectOptions, Database, DatabaseConnection, EntityTrait, QueryFilter, Set,
};
use seaorm::{dao_handler, job_queue, proposal, sea_orm_active_enums::DaoHandlerEnumV4};
use serde_json::json;
use tokio::time::{self, Duration};
use tracing::{error, info, instrument, warn};
use utils::{
    errors::*,
    tracing::setup_tracing,
    types::{JobType, VotesJob},
};

const JOB_INTERVAL: Duration = Duration::from_secs(60);

struct Config {
    database_url: String,
}

impl Config {
    fn from_env() -> Result<Self> {
        Ok(Self {
            database_url: std::env::var("DATABASE_URL").context(DATABASE_URL_NOT_SET)?,
        })
    }
}

#[tokio::main]
#[instrument]
async fn main() -> Result<()> {
    dotenv().ok();
    setup_tracing();

    let app = Router::new().route("/", get("OK"));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
    info!("Health check server running on {}", 3000);

    tokio::spawn(async {
        let mut interval = time::interval(JOB_INTERVAL);
        loop {
            interval.tick().await;
            if let Err(e) = produce_jobs().await {
                error!(PRODUCE_JOBS_FAILED, error = %e);
            }
        }
    });

    tokio::signal::ctrl_c().await?;
    println!("Shutting down...");

    Ok(())
}

#[instrument]
async fn produce_jobs() -> Result<()> {
    let config = Config::from_env()?;

    let db = setup_database(&config.database_url).await?;
    let all_dao_handlers = fetch_dao_handlers(&db).await?;
    let (snapshot_dao_handlers, chain_dao_handlers) = split_dao_handlers(&all_dao_handlers);

    let snapshot_proposals = fetch_proposals(&db, &snapshot_dao_handlers).await?;

    queue_jobs(&db, &chain_dao_handlers, &snapshot_proposals).await?;

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
async fn fetch_dao_handlers(db: &DatabaseConnection) -> Result<Vec<dao_handler::Model>> {
    dao_handler::Entity::find()
        .filter(dao_handler::Column::RefreshEnabled.eq(true))
        .all(db)
        .await
        .context(DAOHANDLER_NOT_FOUND_ERROR)
}

fn split_dao_handlers(
    all_dao_handlers: &[dao_handler::Model],
) -> (Vec<&dao_handler::Model>, Vec<&dao_handler::Model>) {
    all_dao_handlers
        .iter()
        .partition(|p| p.handler_type == DaoHandlerEnumV4::Snapshot)
}

#[instrument(skip(db))]
async fn fetch_proposals(
    db: &DatabaseConnection,
    dao_handlers: &[&dao_handler::Model],
) -> Result<Vec<proposal::Model>> {
    let dao_handler_ids: Vec<_> = dao_handlers.iter().map(|dh| dh.id).collect();
    proposal::Entity::find()
        .filter(proposal::Column::VotesFetched.eq(false))
        .filter(proposal::Column::DaoHandlerId.is_in(dao_handler_ids))
        .all(db)
        .await
        .context(DATABASE_FETCH_PROPOSALS_FAILED)
}

#[instrument(skip(db,))]
async fn queue_jobs(
    db: &DatabaseConnection,

    dao_handlers: &[&dao_handler::Model],
    proposals: &[proposal::Model],
) -> Result<()> {
    queue_dao_jobs(db, dao_handlers).await?;
    queue_proposal_jobs(db, proposals).await?;
    Ok(())
}

#[instrument(skip(db))]
async fn queue_dao_jobs(
    db: &DatabaseConnection,

    dao_handlers: &[&dao_handler::Model],
) -> Result<()> {
    for dao_handler in dao_handlers {
        let job = VotesJob {
            dao_handler_id: dao_handler.id,
            proposal_id: None,
        };

        job_queue::Entity::insert(job_queue::ActiveModel {
            job: Set(json!(job)),
            job_type: Set(JobType::Votes.as_str().to_string()),
            processed: Set(Some(false)),
            ..Default::default()
        })
        .exec(db)
        .await
        .context(DATABASE_ERROR)?;
    }
    Ok(())
}

#[instrument(skip(db))]
async fn queue_proposal_jobs(db: &DatabaseConnection, proposals: &[proposal::Model]) -> Result<()> {
    for proposal in proposals {
        let job = VotesJob {
            dao_handler_id: proposal.dao_handler_id,
            proposal_id: Some(proposal.id),
        };

        job_queue::Entity::insert(job_queue::ActiveModel {
            job: Set(json!(job)),
            job_type: Set(JobType::Votes.as_str().to_string()),
            processed: Set(Some(false)),
            ..Default::default()
        })
        .exec(db)
        .await
        .context(DATABASE_ERROR)?;
    }
    Ok(())
}
