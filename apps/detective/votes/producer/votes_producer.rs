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
use tracing::{info, instrument, warn};

use utils::{
    rabbitmq_callbacks::{AppChannelCallback, AppConnectionCallback},
    tracing::setup_tracing,
    types::VotesJob,
};

const QUEUE_NAME: &str = "detective:votes";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();

    setup_tracing();

    tokio::spawn(async move {
        let mut interval = time::interval(std::time::Duration::from_secs(60 * 10));
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
async fn produce_jobs() -> Result<(), anyhow::Error> {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL not set!");
    let rabbitmq_url = std::env::var("RABBITMQ_URL").expect("RABBITMQ_URL not set!");

    let connection = setup_rabbitmq_connection(&rabbitmq_url).await?;
    let channel = setup_rabbitmq_channel(&connection).await?;

    let queue = QueueDeclareArguments::durable_client_named(QUEUE_NAME)
        .no_wait(false)
        .finish();
    let (_, message_count, _) = channel.queue_declare(queue).await?.unwrap();

    if message_count > 1000 {
        warn!("Message count in queue exceeds 1000, skipping job production");
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

#[instrument(skip_all)]
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

#[instrument]
async fn setup_database(database_url: &str) -> Result<DatabaseConnection> {
    let mut opt = ConnectOptions::new(database_url.to_string());
    opt.sqlx_logging(false);
    Database::connect(opt)
        .await
        .context("Failed to connect to database")
}

#[instrument(skip_all)]
async fn fetch_dao_handlers(db: &DatabaseConnection) -> Result<Vec<dao_handler::Model>> {
    dao_handler::Entity::find()
        .filter(dao_handler::Column::RefreshEnabled.eq(true))
        .all(db)
        .await
        .context("Failed to fetch DAO handlers from database")
}

#[instrument(skip(db))]
async fn fetch_proposals(
    db: &DatabaseConnection,
    dao_handlers: &[&dao_handler::Model],
) -> Result<Vec<proposal::Model>> {
    let dao_handler_ids = dao_handlers
        .iter()
        .map(|dh| dh.id.clone())
        .collect::<Vec<_>>();
    proposal::Entity::find()
        .filter(proposal::Column::VotesFetched.eq(false))
        .filter(proposal::Column::DaoHandlerId.is_in(dao_handler_ids))
        .all(db)
        .await
        .context("Failed to fetch proposals from database")
}

#[instrument(skip(channel))]
async fn queue_jobs(
    channel: &amqprs::channel::Channel,
    dao_handlers: &[&dao_handler::Model],
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
            .context(format!(
                "Failed to publish job for DAO handler ID: {:?}",
                dao_handler.id
            ))?;
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
            .context(format!(
                "Failed to publish job for proposal ID: {:?}",
                proposal.id
            ))?;
    }
    Ok(())
}
