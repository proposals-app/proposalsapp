use amqprs::{
    channel::{BasicPublishArguments, QueueDeclareArguments},
    connection::{Connection, OpenConnectionArguments},
    BasicProperties,
};
use anyhow::{Context, Result};
use dotenv::dotenv;
use sea_orm::{
    ColumnTrait, ConnectOptions, Database, DatabaseConnection, EntityTrait, QueryFilter,
};
use seaorm::{dao_handler, sea_orm_active_enums::DaoHandlerEnum};
use tokio::time;
use tracing::{info, instrument};
use utils::{
    rabbitmq_callbacks::{AppChannelCallback, AppConnectionCallback},
    tracing::setup_tracing,
    types::ProposalsJob,
};

const QUEUE_NAME: &str = "detective:proposals";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();

    setup_tracing();

    tokio::spawn(async move {
        let mut interval = time::interval(std::time::Duration::from_secs(60));
        loop {
            interval.tick().await;
            let _ = produce_jobs().await;
        }
    });

    tokio::signal::ctrl_c().await?;
    println!("Shutting down...");

    Ok(())
}

#[instrument]
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

    queue_dao_jobs(&channel, &dao_handlers).await?;

    Ok(())
}

#[instrument(skip(rabbitmq_url))]
async fn setup_rabbitmq_connection(rabbitmq_url: &str) -> Result<Connection> {
    let args: OpenConnectionArguments = rabbitmq_url
        .try_into()
        .context("Failed to parse RabbitMQ URL")?;
    let connection = Connection::open(&args)
        .await
        .context("Failed to open RabbitMQ connection")?;
    connection
        .register_callback(AppConnectionCallback)
        .await
        .context("Failed to register RabbitMQ connection callback")?;
    Ok(connection)
}

#[instrument(skip(connection))]
async fn setup_rabbitmq_channel(connection: &Connection) -> Result<amqprs::channel::Channel> {
    let channel = connection
        .open_channel(None)
        .await
        .context("Failed to open RabbitMQ channel")?;
    channel
        .register_callback(AppChannelCallback)
        .await
        .context("Failed to register RabbitMQ channel callback")?;
    Ok(channel)
}

#[instrument(skip(database_url))]
async fn setup_database(database_url: &str) -> Result<DatabaseConnection> {
    let mut opt = ConnectOptions::new(database_url.to_string());
    opt.sqlx_logging(false);
    Database::connect(opt)
        .await
        .context("Failed to connect to database")
}

#[instrument(skip(db))]
async fn fetch_dao_handlers(db: &DatabaseConnection) -> Result<Vec<dao_handler::Model>> {
    dao_handler::Entity::find()
        .filter(dao_handler::Column::HandlerType.is_not_in(vec![
            DaoHandlerEnum::MakerPollArbitrum,
            DaoHandlerEnum::AaveV3PolygonPos,
            DaoHandlerEnum::AaveV3Avalanche,
        ]))
        .filter(dao_handler::Column::RefreshEnabled.eq(true))
        .all(db)
        .await
        .context("Failed to fetch DAO handlers from database")
}

#[instrument(skip(channel))]
async fn queue_dao_jobs(
    channel: &amqprs::channel::Channel,
    dao_handlers: &[dao_handler::Model],
) -> Result<()> {
    for dao_handler in dao_handlers {
        let job = ProposalsJob {
            dao_handler_id: dao_handler.id.clone(),
        };
        let content = serde_json::to_string(&job)?.into_bytes();
        let args = BasicPublishArguments::new("", QUEUE_NAME);
        channel
            .basic_publish(BasicProperties::default().finish(), content, args)
            .await
            .context(format!(
                "Failed to publish job for DAO handler ID: {:?}",
                dao_handler.id
            ))?;
    }

    info!("Queued {} DAOs", dao_handlers.len());
    info!(
        "Queued {:?} DAOs",
        dao_handlers
            .iter()
            .map(|d| d.id.clone().into())
            .collect::<Vec<String>>()
    );

    Ok(())
}
