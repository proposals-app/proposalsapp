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
use tracing::info;
use utils::{
    rabbitmq_callbacks::{AppChannelCallback, AppConnectionCallback},
    telemetry::setup_telemetry,
    types::ProposalsJob,
};

const QUEUE_NAME: &str = "detective:proposals";

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    setup_telemetry();

    let mut interval = time::interval(std::time::Duration::from_secs(5 * 60));

    loop {
        interval.tick().await;
        if let Err(e) = produce_jobs().await {
            info!("Error producing jobs: {:?}", e);
        }
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

    queue_dao_jobs(&channel, &dao_handlers).await?;

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
        .filter(dao_handler::Column::HandlerType.is_not_in(vec![
            DaoHandlerEnum::MakerPollArbitrum,
            DaoHandlerEnum::AaveV3PolygonPos,
            DaoHandlerEnum::AaveV3Avalanche,
        ]))
        .filter(dao_handler::Column::RefreshEnabled.eq(1))
        .all(db)
        .await
        .context("DB error")
}

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
            .await?;
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
