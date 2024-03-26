use amqprs::channel::BasicPublishArguments;
use amqprs::channel::QueueDeclareArguments;
use amqprs::connection::Connection;
use amqprs::connection::OpenConnectionArguments;
use amqprs::BasicProperties;
use anyhow::{Context, Result};
use dotenv::dotenv;
use sea_orm::ColumnTrait;
use sea_orm::ConnectOptions;
use sea_orm::EntityTrait;
use sea_orm::QueryFilter;
use sea_orm::{Database, DatabaseConnection};
use seaorm::sea_orm_active_enums::HandlerType;
use seaorm::{dao_handler, proposal};
use tokio::time;
use tracing::info;
use utils::rabbitmq_callbacks::AppChannelCallback;
use utils::rabbitmq_callbacks::AppConnectionCallback;
use utils::telemetry::setup_telemetry;
use utils::types::VotesJob;

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

    let args: OpenConnectionArguments = rabbitmq_url.as_str().try_into().unwrap();
    let connection = Connection::open(&args).await.unwrap();
    connection
        .register_callback(AppConnectionCallback)
        .await
        .unwrap();

    let channel = connection.open_channel(None).await.unwrap();
    channel.register_callback(AppChannelCallback).await.unwrap();

    let queue = QueueDeclareArguments::durable_client_named(QUEUE_NAME)
        .no_wait(false)
        .finish();
    let (_, message_count, _) = channel.queue_declare(queue).await.unwrap().unwrap();

    if message_count > 1000 {
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

        let content = serde_json::to_string(&job)?.into_bytes();

        let args = BasicPublishArguments::new("", QUEUE_NAME);

        channel
            .basic_publish(BasicProperties::default(), content, args)
            .await
            .unwrap();
    }

    for proposal in proposals.clone() {
        let job = VotesJob {
            dao_handler_id: proposal.dao_handler_id.clone(),
            proposal_id: Some(proposal.id.clone()),
        };

        let content = serde_json::to_string(&job)?.into_bytes();

        let args = BasicPublishArguments::new("", QUEUE_NAME);

        channel
            .basic_publish(BasicProperties::default(), content, args)
            .await
            .unwrap();
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
