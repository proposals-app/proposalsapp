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
use seaorm::{dao_handler, proposal, sea_orm_active_enums::DaoHandlerEnumV2};
use tokio::time::{self, Duration};
use tracing::{error, instrument, warn};
use utils::{
    errors::*,
    rabbitmq_callbacks::{AppChannelCallback, AppConnectionCallback},
    tracing::setup_tracing,
    types::VotesJob,
    warnings::*,
};

const QUEUE_NAME: &str = "detective:votes";
const JOB_INTERVAL: Duration = Duration::from_secs(60);
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
    let all_dao_handlers = fetch_dao_handlers(&db).await?;
    let (snapshot_dao_handlers, chain_dao_handlers) = split_dao_handlers(&all_dao_handlers);

    let snapshot_proposals = fetch_proposals(&db, &snapshot_dao_handlers).await?;

    queue_jobs(&channel, &chain_dao_handlers, &snapshot_proposals).await?;

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
        .partition(|p| p.handler_type == DaoHandlerEnumV2::Snapshot)
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

#[instrument(skip(channel))]
async fn queue_jobs(
    channel: &amqprs::channel::Channel,
    dao_handlers: &[&dao_handler::Model],
    proposals: &[proposal::Model],
) -> Result<()> {
    queue_dao_jobs(channel, dao_handlers).await?;
    queue_proposal_jobs(channel, proposals).await?;
    Ok(())
}

#[instrument(skip(channel))]
async fn queue_dao_jobs(
    channel: &amqprs::channel::Channel,
    dao_handlers: &[&dao_handler::Model],
) -> Result<()> {
    for dao_handler in dao_handlers {
        publish_job(
            channel,
            VotesJob {
                dao_handler_id: dao_handler.id,
                proposal_id: None,
            },
        )
        .await?;
    }
    Ok(())
}

#[instrument(skip(channel))]
async fn queue_proposal_jobs(
    channel: &amqprs::channel::Channel,
    proposals: &[proposal::Model],
) -> Result<()> {
    for proposal in proposals {
        publish_job(
            channel,
            VotesJob {
                dao_handler_id: proposal.dao_handler_id,
                proposal_id: Some(proposal.id),
            },
        )
        .await?;
    }
    Ok(())
}

async fn publish_job(channel: &amqprs::channel::Channel, job: VotesJob) -> Result<()> {
    let content = serde_json::to_string(&job)?.into_bytes();
    let args = BasicPublishArguments::new("", QUEUE_NAME);
    channel
        .basic_publish(BasicProperties::default(), content, args)
        .await
        .context(PUBLISH_JOB_FAILED)
}
