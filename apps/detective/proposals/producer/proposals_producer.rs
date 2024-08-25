use anyhow::{Context, Result};
use dotenv::dotenv;
use sea_orm::{
    ColumnTrait, ConnectOptions, Database, DatabaseConnection, EntityTrait, QueryFilter, Set,
};
use seaorm::{dao_handler, job_queue, sea_orm_active_enums::DaoHandlerEnumV2};
use serde_json::json;
use tokio::time::{self, Duration};
use tracing::{instrument, warn};
use utils::{
    errors::*,
    tracing::setup_tracing,
    types::{JobType, ProposalsJob},
};

const JOB_INTERVAL: Duration = Duration::from_secs(60 * 5);

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

    tokio::spawn(async {
        let mut interval = time::interval(JOB_INTERVAL);
        loop {
            interval.tick().await;
            if let Err(e) = produce_jobs().await {
                warn!("Failed to produce jobs: {:?}", e);
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
    let dao_handlers = fetch_dao_handlers(&db).await?;

    queue_dao_jobs(&db, &dao_handlers).await?;

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
        .filter(dao_handler::Column::HandlerType.is_not_in(vec![
            DaoHandlerEnumV2::MakerPollArbitrum,
            DaoHandlerEnumV2::AaveV3PolygonPos,
            DaoHandlerEnumV2::AaveV3Avalanche,
        ]))
        .filter(dao_handler::Column::RefreshEnabled.eq(true))
        .all(db)
        .await
        .context(DATABASE_FETCH_DAO_HANDLERS_FAILED)
}

#[instrument(skip(db))]
async fn queue_dao_jobs(
    db: &DatabaseConnection,
    dao_handlers: &[dao_handler::Model],
) -> Result<()> {
    for dao_handler in dao_handlers {
        let job = ProposalsJob {
            dao_handler_id: dao_handler.id,
        };

        // Insert job into PostgreSQL queue
        job_queue::Entity::insert(job_queue::ActiveModel {
            job: Set(json!(job)),
            job_type: Set(JobType::Proposals.as_str().to_string()),
            processed: Set(Some(false)),
            ..Default::default()
        })
        .exec(db)
        .await
        .context(DATABASE_ERROR)?;
    }

    Ok(())
}
