use anyhow::{Context, Result};
use axum::{routing::get, Router};
use dotenv::dotenv;
use sea_orm::{
    ColumnTrait, ConnectOptions, Database, DatabaseConnection, EntityTrait, QueryFilter, Set,
};
use seaorm::{dao_handler, job_queue, sea_orm_active_enums::DaoHandlerEnumV4};
use serde_json::json;
use tokio::time::{self, Duration};
use tracing::{info, instrument, warn};
use utils::{
    errors::*,
    tracing::setup_tracing,
    types::{JobType, ProposalsJob},
};

const REGULAR_JOB_INTERVAL: Duration = Duration::from_secs(60 * 5);
const BACKTRACK_JOB_INTERVAL: Duration = Duration::from_secs(3 * 60 * 60);

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

    let regular_job = tokio::spawn(async {
        let mut interval = time::interval(REGULAR_JOB_INTERVAL);
        loop {
            interval.tick().await;
            if let Err(e) = produce_jobs(false).await {
                warn!("Failed to produce regular jobs: {:?}", e);
            }
        }
    });

    let backtrack_job = tokio::spawn(async {
        let mut interval = time::interval(BACKTRACK_JOB_INTERVAL);
        loop {
            interval.tick().await;
            if let Err(e) = produce_jobs(true).await {
                warn!("Failed to produce backtrack jobs: {:?}", e);
            }
        }
    });

    tokio::select! {
        _ = tokio::signal::ctrl_c() => {
            println!("Shutting down...");
        }
        _ = regular_job => {}
        _ = backtrack_job => {}
    }

    Ok(())
}

#[instrument]
async fn produce_jobs(backtrack: bool) -> Result<()> {
    let database_url = std::env::var("DATABASE_URL").expect(DATABASE_URL_NOT_SET);

    let mut opt = ConnectOptions::new(database_url);
    opt.sqlx_logging(false);

    let db: DatabaseConnection = Database::connect(opt)
        .await
        .context(DATABASE_CONNECTION_FAILED)?;

    let dao_handlers = fetch_dao_handlers(&db).await?;

    queue_dao_jobs(&db, &dao_handlers, backtrack).await?;

    Ok(())
}

#[instrument(skip(db))]
async fn fetch_dao_handlers(db: &DatabaseConnection) -> Result<Vec<dao_handler::Model>> {
    dao_handler::Entity::find()
        .filter(dao_handler::Column::HandlerType.is_not_in(vec![
            DaoHandlerEnumV4::MakerPollArbitrum,
            DaoHandlerEnumV4::AaveV3PolygonPos,
            DaoHandlerEnumV4::AaveV3Avalanche,
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
    backtrack: bool,
) -> Result<()> {
    for dao_handler in dao_handlers {
        let from_index = if backtrack {
            let backtrack_index = (dao_handler.proposals_index as f64 * 0.9) as i32;
            std::cmp::max(backtrack_index, 0)
        } else {
            dao_handler.proposals_index
        };

        let job = ProposalsJob {
            dao_handler_id: dao_handler.id,
            from_index,
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
