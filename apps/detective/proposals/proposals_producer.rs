use anyhow::{Context, Result};
use dotenv::dotenv;
use redis_work_queue::Item;
use redis_work_queue::KeyPrefix;
use redis_work_queue::WorkQueue;
use sea_orm::ColumnTrait;
use sea_orm::ConnectOptions;
use sea_orm::EntityTrait;
use sea_orm::QueryFilter;
use sea_orm::{Database, DatabaseConnection};
use seaorm::dao_handler;
use seaorm::sea_orm_active_enums::HandlerType;
use tokio::time;
use tracing::info;
use utils::telemetry::setup_telemetry;
use utils::types::ProposalsJob;

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    setup_telemetry();

    let mut interval = time::interval(std::time::Duration::from_secs(30));

    loop {
        interval.tick().await;
        tokio::spawn(async { produce_jobs().await });
    }
}

async fn produce_jobs() -> Result<()> {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL not set!");
    let redis_url = std::env::var("REDIS_URL").expect("REDIS_URL not set!");

    let redis = &mut redis::Client::open(redis_url)?
        .get_multiplexed_async_connection()
        .await?;

    let work_queue = WorkQueue::new(KeyPrefix::from("proposals"));

    let mut opt = ConnectOptions::new(database_url);
    opt.sqlx_logging(false);

    let db: DatabaseConnection = Database::connect(opt).await.context("DB error")?;

    let dao_handlers = dao_handler::Entity::find()
        .filter(dao_handler::Column::HandlerType.is_not_in(vec![
            HandlerType::MakerPollArbitrum,
            HandlerType::AaveV3PolygonPos,
            HandlerType::AaveV3Avalanche,
        ]))
        .all(&db)
        .await
        .context("DB error")?;

    for dao_handler in dao_handlers.clone() {
        let job = Item::from_json_data(&ProposalsJob {
            dao_handler_id: dao_handler.id.clone(),
        })
        .unwrap();

        work_queue
            .add_item(redis, &job)
            .await
            .expect("failed to add item to work queue");
    }

    info!("Queued {} DAOs cnt", dao_handlers.len());
    info!(
        "Queued {:?} DAOs",
        dao_handlers
            .iter()
            .map(|d| d.id.clone())
            .collect::<Vec<String>>()
    );

    Ok(())
}
