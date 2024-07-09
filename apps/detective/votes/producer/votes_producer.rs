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
use seaorm::{dao_handler, proposal, sea_orm_active_enums::DaoHandlerEnum};
use tokio::time;
use tracing::{error, instrument, warn};
use utils::{
    errors::*,
    rabbitmq_callbacks::{AppChannelCallback, AppConnectionCallback},
    tracing::setup_tracing,
    types::VotesJob,
    warnings::*,
};

const QUEUE_NAME: &str = "detective:votes";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();

    setup_tracing();

    tokio::spawn(async move {
        let mut interval = time::interval(std::time::Duration::from_secs(60));
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
async fn produce_jobs() -> Result<(), anyhow::Error> {
    let database_url = std::env::var("DATABASE_URL").context(DATABASE_URL_NOT_SET)?;
    let rabbitmq_url = std::env::var("RABBITMQ_URL").context(RABBITMQ_URL_NOT_SET)?;

    let connection = setup_rabbitmq_connection(&rabbitmq_url).await?;
    let channel = setup_rabbitmq_channel(&connection).await?;

    let queue = QueueDeclareArguments::durable_client_named(QUEUE_NAME)
        .no_wait(false)
        .finish();
    let (_, message_count, _) = channel
        .queue_declare(queue)
        .await?
        .ok_or_else(|| anyhow::anyhow!(RABBITMQ_DECLARE_QUEUE_FAILED))?;

    if message_count > 1000 {
        warn!(QUEUE_MESSAGE_COUNT_EXCEEDED);
        return Ok(());
    }

    let db = setup_database(&database_url).await?;
    let all_dao_handlers = fetch_dao_handlers(&db).await?;
    let snapshot_dao_handlers: Vec<&dao_handler::Model> = all_dao_handlers
        .iter()
        .filter(|p| p.handler_type == DaoHandlerEnum::Snapshot)
        .collect();

    let chain_dao_handlers: Vec<&dao_handler::Model> = all_dao_handlers
        .iter()
        .filter(|p| p.handler_type != DaoHandlerEnum::Snapshot)
        .collect();

    let snapshot_proposals = fetch_proposals(&db, &snapshot_dao_handlers).await?;

    queue_jobs(&channel, &chain_dao_handlers, &snapshot_proposals).await?;

    Ok(())
}

#[instrument(skip_all)]
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

#[instrument(skip_all)]
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

#[instrument]
async fn setup_database(database_url: &str) -> Result<DatabaseConnection> {
    let mut opt = ConnectOptions::new(database_url.to_string());
    opt.sqlx_logging(false);
    let db = Database::connect(opt)
        .await
        .context(DATABASE_CONNECTION_FAILED)?;

    Ok(db)
}

#[instrument(skip_all)]
async fn fetch_dao_handlers(db: &DatabaseConnection) -> Result<Vec<dao_handler::Model>> {
    let dao_handlers = dao_handler::Entity::find()
        .filter(dao_handler::Column::RefreshEnabled.eq(true))
        .all(db)
        .await
        .context(DAOHANDLER_NOT_FOUND_ERROR)?;

    Ok(dao_handlers)
}

#[instrument(skip(db))]
async fn fetch_proposals(
    db: &DatabaseConnection,
    dao_handlers: &[&dao_handler::Model],
) -> Result<Vec<proposal::Model>> {
    let dao_handler_ids = dao_handlers.iter().map(|dh| dh.id).collect::<Vec<_>>();
    let proposals = proposal::Entity::find()
        .filter(proposal::Column::VotesFetched.eq(false))
        .filter(proposal::Column::DaoHandlerId.is_in(dao_handler_ids))
        .all(db)
        .await
        .context(DATABASE_FETCH_PROPOSALS_FAILED)?;

    Ok(proposals)
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
        let job = VotesJob {
            dao_handler_id: dao_handler.id,
            proposal_id: None,
        };
        let content = serde_json::to_string(&job)?.into_bytes();
        let args = BasicPublishArguments::new("", QUEUE_NAME);
        channel
            .basic_publish(BasicProperties::default(), content, args)
            .await
            .context(PUBLISH_JOB_FAILED)?;
    }
    Ok(())
}

#[instrument(skip(channel))]
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
            .await
            .context(PUBLISH_JOB_FAILED)?;
    }
    Ok(())
}
