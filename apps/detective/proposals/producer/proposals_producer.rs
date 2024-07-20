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
use seaorm::{dao_handler, sea_orm_active_enums::DaoHandlerEnumV2};
use tokio::time::{self, Duration};
use tracing::{instrument, warn};
use utils::{
    errors::*,
    rabbitmq_callbacks::{AppChannelCallback, AppConnectionCallback},
    tracing::setup_tracing,
    types::ProposalsJob,
    warnings::*,
};

const QUEUE_NAME: &str = "detective:proposals";
const JOB_INTERVAL: Duration = Duration::from_secs(60 * 5);
const MAX_QUEUE_SIZE: u32 = 1000;

struct Config {
    database_url: String,
    rabbitmq_url: String,
}

impl Config {
    fn from_env() -> Result<Self> {
        Ok(Self {
            database_url: std::env::var("DATABASE_URL").context(DATABASE_URL_NOT_SET)?,
            rabbitmq_url: std::env::var("RABBITMQ_URL").context(RABBITMQ_URL_NOT_SET)?,
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
    let connection = setup_rabbitmq_connection(&config.rabbitmq_url).await?;
    let channel = setup_rabbitmq_channel(&connection).await?;

    let queue = QueueDeclareArguments::durable_client_named(QUEUE_NAME)
        .no_wait(false)
        .finish();

    let (_, message_count, _) = channel
        .queue_declare(queue)
        .await?
        .context(RABBITMQ_DECLARE_QUEUE_FAILED)?;

    if message_count > MAX_QUEUE_SIZE {
        warn!(QUEUE_MESSAGE_COUNT_EXCEEDED);
        return Ok(());
    }

    let db = setup_database(&config.database_url).await?;
    let dao_handlers = fetch_dao_handlers(&db).await?;

    queue_dao_jobs(&channel, &dao_handlers).await?;

    Ok(())
}

#[instrument(skip(rabbitmq_url))]
async fn setup_rabbitmq_connection(rabbitmq_url: &str) -> Result<Connection> {
    let args: OpenConnectionArguments = rabbitmq_url.try_into().context(RABBITMQ_URL_INVALID)?;
    let connection = Connection::open(&args)
        .await
        .context(RABBITMQ_CONNECT_FAILED)?;
    connection
        .register_callback(AppConnectionCallback)
        .await
        .context(RABBITMQ_REGISTER_FAILED)?;

    Ok(connection)
}

#[instrument(skip(connection))]
async fn setup_rabbitmq_channel(connection: &Connection) -> Result<amqprs::channel::Channel> {
    let channel = connection
        .open_channel(None)
        .await
        .context(RABBITMQ_CHANNEL_OPEN_FAILED)?;
    channel
        .register_callback(AppChannelCallback)
        .await
        .context(RABBITMQ_REGISTER_FAILED)?;

    Ok(channel)
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

#[instrument(skip(channel))]
async fn queue_dao_jobs(
    channel: &amqprs::channel::Channel,
    dao_handlers: &[dao_handler::Model],
) -> Result<()> {
    for dao_handler in dao_handlers {
        let job = ProposalsJob {
            dao_handler_id: dao_handler.id,
        };
        let content = serde_json::to_string(&job)?.into_bytes();
        let args = BasicPublishArguments::new("", QUEUE_NAME);
        channel
            .basic_publish(BasicProperties::default().finish(), content, args)
            .await
            .context(PUBLISH_JOB_FAILED)?;
    }

    Ok(())
}
