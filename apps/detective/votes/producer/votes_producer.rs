use amqprs::{
    channel::{BasicPublishArguments, QueueDeclareArguments},
    connection::{Connection, OpenConnectionArguments},
    BasicProperties,
};
use anyhow::{Context, Result};
use dotenv::dotenv;
use sea_orm::{
    prelude::Uuid, ColumnTrait, ConnectOptions, Database, DatabaseConnection, EntityTrait,
    QueryFilter,
};
use seaorm::{dao_handler, proposal, sea_orm_active_enums::DaoHandlerEnum};
use tokio::time;
use tracing::info;
use utils::{
    rabbitmq_callbacks::{AppChannelCallback, AppConnectionCallback},
    telemetry::setup_telemetry,
    types::VotesJob,
};

const QUEUE_NAME: &str = "detective:votes";

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    setup_telemetry();

    let mut interval = time::interval(std::time::Duration::from_secs(60 * 10));

    loop {
        interval.tick().await;
        tokio::spawn(async { produce_jobs().await });
    }
}

async fn produce_jobs() -> Result<()> {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL not set!");
    let rabbitmq_url = std::env::var("RABBITMQ_URL").expect("RABBITMQ_URL not set!");

    let connection = setup_rabbitmq_connection(&rabbitmq_url).await?;
    let channel = setup_rabbitmq_channel(&connection).await?;

    let queue = QueueDeclareArguments::durable_client_named(QUEUE_NAME)
        .no_wait(false)
        .finish();
    let (_, message_count, _) = channel.queue_declare(queue).await?.unwrap();

    if message_count > 1000 {
        return Ok(());
    }

    let db = setup_database(&database_url).await?;
    let dao_handlers = fetch_dao_handlers(&db).await?;
    let proposals = fetch_proposals(&db, &dao_handlers).await?;

    queue_jobs(&channel, &dao_handlers, &proposals).await?;

    Ok(())
}

async fn setup_rabbitmq_connection(rabbitmq_url: &str) -> Result<Connection> {
    let args: OpenConnectionArguments = rabbitmq_url.try_into()?;
    let connection = Connection::open(&args).await?;
    connection.register_callback(AppConnectionCallback).await?;
    Ok(connection)
}

async fn setup_rabbitmq_channel(connection: &Connection) -> Result<amqprs::channel::Channel> {
    let channel = connection.open_channel(None).await?;
    channel.register_callback(AppChannelCallback).await?;
    Ok(channel)
}

async fn setup_database(database_url: &str) -> Result<DatabaseConnection> {
    let mut opt = ConnectOptions::new(database_url.to_string());
    opt.sqlx_logging(false);
    Database::connect(opt)
        .await
        .context("Failed to connect to database")
}

async fn fetch_dao_handlers(db: &DatabaseConnection) -> Result<Vec<dao_handler::Model>> {
    dao_handler::Entity::find()
        .filter(dao_handler::Column::HandlerType.ne(DaoHandlerEnum::Snapshot))
        .filter(dao_handler::Column::RefreshEnabled.eq(true))
        .all(db)
        .await
        .context("DB error")
}

async fn fetch_proposals(
    db: &DatabaseConnection,
    dao_handlers: &[dao_handler::Model],
) -> Result<Vec<proposal::Model>> {
    let dao_handler_ids = dao_handlers.iter().map(|dh| dh.id.clone());
    proposal::Entity::find()
        .filter(proposal::Column::VotesFetched.eq(false))
        .filter(proposal::Column::DaoHandlerId.is_not_in(dao_handler_ids))
        .all(db)
        .await
        .context("DB error")
}

async fn queue_jobs(
    channel: &amqprs::channel::Channel,
    dao_handlers: &[dao_handler::Model],
    proposals: &[proposal::Model],
) -> Result<()> {
    queue_dao_jobs(channel, dao_handlers).await?;
    queue_proposal_jobs(channel, proposals).await?;

    info!("Queued {} DAOs", dao_handlers.len());
    info!(
        "Queued {:?} DAOs",
        dao_handlers
            .iter()
            .map(|d| d.id.clone())
            .collect::<Vec<Uuid>>()
    );
    info!("Queued {} proposals", proposals.len());
    info!(
        "Queued {:?} proposals",
        proposals
            .iter()
            .map(|p| p.id.clone())
            .collect::<Vec<Uuid>>()
    );

    Ok(())
}

async fn queue_dao_jobs(
    channel: &amqprs::channel::Channel,
    dao_handlers: &[dao_handler::Model],
) -> Result<()> {
    for dao_handler in dao_handlers {
        let job = VotesJob {
            dao_handler_id: dao_handler.id,
            proposal_id: None,
        };
        let content = serde_json::to_string(&job)?.into_bytes();
        let args = BasicPublishArguments::new("", QUEUE_NAME);
        channel
            .basic_publish(BasicProperties::default(), content, args)
            .await?;
    }
    Ok(())
}

async fn queue_proposal_jobs(
    channel: &amqprs::channel::Channel,
    proposals: &[proposal::Model],
) -> Result<()> {
    for proposal in proposals {
        let job = VotesJob {
            dao_handler_id: proposal.dao_handler_id,
            proposal_id: Some(proposal.id),
        };
        let content = serde_json::to_string(&job)?.into_bytes();
        let args = BasicPublishArguments::new("", QUEUE_NAME);
        channel
            .basic_publish(BasicProperties::default(), content, args)
            .await?;
    }
    Ok(())
}
