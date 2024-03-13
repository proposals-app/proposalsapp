use anyhow::{Context, Result};
use axum::Router;
use dotenv::dotenv;
use rsmq_async::MultiplexedRsmq;
use rsmq_async::RsmqConnection;
use sea_orm::ColumnTrait;
use sea_orm::ConnectOptions;
use sea_orm::EntityTrait;
use sea_orm::QueryFilter;
use sea_orm::{Database, DatabaseConnection};
use seaorm::sea_orm_active_enums::HandlerType;
use seaorm::{dao_handler, proposal};
use serde_json::json;
use tokio::time;
use tracing::info;
use utils::telemetry::setup_telemetry;
use utils::types::VotesJob;

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    setup_telemetry();

    let mut interval = time::interval(std::time::Duration::from_secs(60 * 10));

    let app = Router::new().route("/", axum::routing::get(|| async { "ok" }));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    tokio::spawn(async { axum::serve(listener, app).await.unwrap() });

    loop {
        interval.tick().await;
        tokio::spawn(async { produce_jobs().await });
    }
}

async fn produce_jobs() -> Result<()> {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL not set!");
    let redis_url = std::env::var("REDIS_URL").expect("REDIS_URL not set!");

    let redis = redis::Client::open(redis_url)?
        .get_multiplexed_async_connection()
        .await?;

    let mut rsmq = MultiplexedRsmq::new_with_connection(redis, false, None);

    rsmq.create_queue("votes", None, None, None)
        .await
        .expect("failed to create queue");

    let queue_len = rsmq.get_queue_attributes("votes").await?.msgs;
    if queue_len > 250 {
        return Ok(());
    }

    let mut opt = ConnectOptions::new(database_url);
    opt.sqlx_logging(false);

    let db: DatabaseConnection = Database::connect(opt).await?;

    let dao_handlers = dao_handler::Entity::find()
        .filter(dao_handler::Column::HandlerType.ne(HandlerType::Snapshot))
        .all(&db)
        .await
        .context("DB error")?;

    let dao_handler_ids = dao_handlers.iter().map(|dh| dh.id.clone());

    let proposals = proposal::Entity::find()
        .filter(proposal::Column::VotesFetched.eq(false))
        .filter(proposal::Column::DaoHandlerId.is_not_in(dao_handler_ids))
        .all(&db)
        .await
        .context("DB error")?;

    for dao_handler in dao_handlers.clone() {
        let job = VotesJob {
            dao_handler_id: dao_handler.id.clone(),
            proposal_id: None,
        };

        rsmq.send_message("votes", serde_json::to_string(&job)?, None)
            .await?;
    }

    for proposal in proposals.clone() {
        let job = VotesJob {
            dao_handler_id: proposal.dao_handler_id.clone(),
            proposal_id: Some(proposal.id.clone()),
        };

        rsmq.send_message("votes", serde_json::to_string(&job)?, None)
            .await?;
    }

    info!("Queued {} DAOs cnt", dao_handlers.len());
    info!(
        "Queued {:?} DAOs",
        dao_handlers
            .iter()
            .map(|d| d.id.clone())
            .collect::<Vec<String>>()
    );
    info!("Queued {} proposals cnt", proposals.len());
    info!(
        "Queued {:?} proposals",
        proposals
            .iter()
            .map(|p| p.id.clone())
            .collect::<Vec<String>>()
    );

    Ok(())
}
