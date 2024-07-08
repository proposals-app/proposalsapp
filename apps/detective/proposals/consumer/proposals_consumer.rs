use amqprs::channel::{
    BasicAckArguments, BasicConsumeArguments, BasicNackArguments, BasicQosArguments, Channel,
    QueueDeclareArguments,
};
use amqprs::connection::{Connection, OpenConnectionArguments};
use amqprs::consumer::AsyncConsumer;
use amqprs::{BasicProperties, Deliver};
use anyhow::{Context, Result};
use async_trait::async_trait;
use dotenv::dotenv;
use itertools::Itertools;
use sea_orm::{
    ColumnTrait, Condition, ConnectOptions, Database, DatabaseConnection, EntityTrait, QueryFilter,
    Set,
};
use seaorm::sea_orm_active_enums::ProposalStateEnum;
use seaorm::{dao_handler, proposal};
use std::collections::HashSet;
use tokio::sync::Notify;
use tracing::{error, info, instrument, warn};
use utils::rabbitmq_callbacks::{AppChannelCallback, AppConnectionCallback};
use utils::tracing::setup_tracing;
use utils::types::{ProposalsJob, ProposalsResponse};

mod handlers;

pub struct ProposalsResult {
    proposals: Vec<proposal::ActiveModel>,
    to_index: Option<i32>,
}

#[async_trait]
pub trait ProposalHandler: Send + Sync {
    async fn get_proposals(&self, dao_handler: &dao_handler::Model) -> Result<ProposalsResult>;
    fn min_refresh_speed(&self) -> i32;
    fn max_refresh_speed(&self) -> i32;
}

const QUEUE_NAME: &str = "detective:proposals";
const JOB_TIMEOUT_SECONDS: u64 = 30;

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    setup_tracing();

    let rabbitmq_url = std::env::var("RABBITMQ_URL").expect("RABBITMQ_URL not set!");
    let args: OpenConnectionArguments = rabbitmq_url.as_str().try_into().unwrap();
    let connection = Connection::open(&args)
        .await
        .context("Failed to open RabbitMQ connection")?;

    connection
        .register_callback(AppConnectionCallback)
        .await
        .context("Failed to register RabbitMQ connection callback")?;

    let channel = connection
        .open_channel(None)
        .await
        .context("Failed to open RabbitMQ channel")?;
    channel
        .register_callback(AppChannelCallback)
        .await
        .context("Failed to register RabbitMQ channel callback")?;

    let queue = QueueDeclareArguments::durable_client_named(QUEUE_NAME);
    channel
        .queue_declare(queue)
        .await
        .context("Failed to declare RabbitMQ queue")?;

    // 5 workers
    channel
        .basic_qos(BasicQosArguments::new(0, 5, false))
        .await
        .context("Failed to set RabbitMQ QoS")?;

    channel
        .basic_consume(
            ProposalsConsumer::new(),
            BasicConsumeArguments::new(QUEUE_NAME, ""),
        )
        .await
        .context("Failed to start RabbitMQ consumer")?;

    // consume forever
    let guard = Notify::new();
    guard.notified().await;

    Ok(())
}

pub struct ProposalsConsumer {}
impl Default for ProposalsConsumer {
    fn default() -> Self {
        Self::new()
    }
}

impl ProposalsConsumer {
    pub fn new() -> Self {
        Self {}
    }
}

#[async_trait]
impl AsyncConsumer for ProposalsConsumer {
    async fn consume(
        &mut self,
        channel: &Channel,
        deliver: Deliver,
        _basic_properties: BasicProperties,
        content: Vec<u8>,
    ) {
        let job_str = String::from_utf8(content).ok();
        let job: ProposalsJob = serde_json::from_str(job_str.unwrap().as_str()).unwrap();

        // Set a timeout of 3 minutes for the job processing
        match tokio::time::timeout(
            tokio::time::Duration::from_secs(JOB_TIMEOUT_SECONDS),
            run(job.clone()),
        )
        .await
        {
            Ok(result) => match result {
                Ok(_) => {
                    if let Err(e) = increase_refresh_speed(job.clone()).await {
                        error!("Failed to increase refresh speed: {:?}", e);
                    }
                    if let Err(e) = channel
                        .basic_ack(BasicAckArguments::new(deliver.delivery_tag(), false))
                        .await
                    {
                        error!("Failed to acknowledge message: {:?}", e);
                    }
                }
                Err(e) => {
                    if let Err(err) = decrease_refresh_speed(job.clone()).await {
                        error!("Failed to decrease refresh speed: {:?}", err);
                    }
                    if let Err(err) = channel
                        .basic_nack(BasicNackArguments::new(deliver.delivery_tag(), false, true))
                        .await
                    {
                        error!("Failed to nack message: {:?}", err);
                    }
                    warn!("proposals_consumer error: {:?}", e);
                }
            },
            Err(_) => {
                // Timeout occurred
                if let Err(err) = decrease_refresh_speed(job.clone()).await {
                    error!("Failed to decrease refresh speed: {:?}", err);
                }
                if let Err(err) = channel
                    .basic_nack(BasicNackArguments::new(deliver.delivery_tag(), false, true))
                    .await
                {
                    error!("Failed to nack message: {:?}", err);
                }
                warn!(
                    "Job took more than {} seconds and was nacked",
                    JOB_TIMEOUT_SECONDS
                );
            }
        };
    }
}

#[instrument]
async fn run(job: ProposalsJob) -> Result<()> {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL not set!");

    let mut opt = ConnectOptions::new(database_url);
    opt.sqlx_logging(false);

    let db: DatabaseConnection = Database::connect(opt).await.context("DB connection")?;

    let dao_handler = dao_handler::Entity::find()
        .filter(dao_handler::Column::Id.eq(job.dao_handler_id))
        .one(&db)
        .await
        .context("DB error while fetching DAO handler")?
        .context("DAO handler not found")?;

    let handler = handlers::get_handler(&dao_handler.handler_type);

    let ProposalsResult {
        proposals,
        to_index,
    } = handler.get_proposals(&dao_handler).await?;

    let StoredProposals {
        inserted_proposals,
        updated_proposals,
    } = store_proposals(&proposals, &db).await?;

    let new_index = update_index(&proposals, &dao_handler, to_index, &db).await?;

    let response = ProposalsResponse {
        inserted_proposals,
        updated_proposals,
        new_index,
        dao_handler_id: dao_handler.id,
    };

    info!("{:?}", response);

    Ok(())
}

#[instrument]
async fn decrease_refresh_speed(job: ProposalsJob) -> Result<()> {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL not set!");

    let mut opt = ConnectOptions::new(database_url);
    opt.sqlx_logging(false);

    let db: DatabaseConnection = Database::connect(opt).await.context("DB connection")?;

    let dao_handler = dao_handler::Entity::find()
        .filter(dao_handler::Column::Id.eq(job.dao_handler_id))
        .one(&db)
        .await
        .context("DB error while fetching DAO handler")?
        .context("DAO handler not found")?;

    let handler = handlers::get_handler(&dao_handler.handler_type);
    let mut new_refresh_speed = (dao_handler.proposals_refresh_speed as f32 * 0.5) as i32;

    if new_refresh_speed < handler.min_refresh_speed() {
        new_refresh_speed = handler.min_refresh_speed();
    }

    info!(
        "Refresh speed decreased to {} for DAO {}",
        new_refresh_speed, dao_handler.dao_id
    );

    dao_handler::Entity::update(dao_handler::ActiveModel {
        id: Set(dao_handler.id),
        proposals_refresh_speed: Set(new_refresh_speed),
        ..Default::default()
    })
    .exec(&db)
    .await
    .context("DB error while updating DAO handler to decrease refresh speed")?;

    Ok(())
}

#[instrument]
async fn increase_refresh_speed(job: ProposalsJob) -> Result<()> {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL not set!");

    let mut opt = ConnectOptions::new(database_url);
    opt.sqlx_logging(false);

    let db: DatabaseConnection = Database::connect(opt).await.context("DB connection")?;

    let dao_handler = dao_handler::Entity::find()
        .filter(dao_handler::Column::Id.eq(job.dao_handler_id))
        .one(&db)
        .await
        .context("DB error while fetching DAO handler")?
        .context("DAO handler not found")?;

    let handler = handlers::get_handler(&dao_handler.handler_type);
    let mut new_refresh_speed = (dao_handler.proposals_refresh_speed as f32 * 1.2) as i32;

    if new_refresh_speed > handler.max_refresh_speed() {
        new_refresh_speed = handler.max_refresh_speed();
    }

    dao_handler::Entity::update(dao_handler::ActiveModel {
        id: Set(dao_handler.id),
        proposals_refresh_speed: Set(new_refresh_speed),
        ..Default::default()
    })
    .exec(&db)
    .await
    .context("DB error while updating DAO handler to increase refresh speed")?;

    Ok(())
}

#[instrument(skip(parsed_proposals, db))]
async fn update_index(
    parsed_proposals: &[proposal::ActiveModel],
    dao_handler: &dao_handler::Model,
    to_index: Option<i32>,
    db: &DatabaseConnection,
) -> Result<i32> {
    let mut new_index =
        to_index.unwrap_or(dao_handler.proposals_index + dao_handler.proposals_refresh_speed);

    let sorted_proposals = parsed_proposals
        .iter()
        .sorted_by(|a, b| a.index_created.as_ref().cmp(b.index_created.as_ref()))
        .collect_vec();

    for proposal in sorted_proposals.iter() {
        if proposal.proposal_state.as_ref() == &ProposalStateEnum::Active
            && proposal.index_created.is_set()
            && proposal.index_created.clone().unwrap() < new_index
        {
            new_index = proposal.index_created.clone().unwrap();
            break;
        }
    }

    dao_handler::Entity::update(dao_handler::ActiveModel {
        id: Set(dao_handler.id),
        proposals_index: Set(new_index),
        ..Default::default()
    })
    .exec(db)
    .await
    .context("DB error while updating proposals index")?;

    Ok(new_index)
}

struct StoredProposals {
    inserted_proposals: u32,
    updated_proposals: u32,
}

#[instrument(skip(db))]
async fn store_proposals(
    parsed_proposals: &[proposal::ActiveModel],
    db: &DatabaseConnection,
) -> Result<StoredProposals> {
    let mut inserted_proposals = 0;
    let mut updated_proposals = 0;

    let mut proposals_to_insert = vec![];
    let mut insert_ids_unique = HashSet::new();

    for proposal in parsed_proposals.iter().cloned() {
        let existing_proposal = proposal::Entity::find()
            .filter(
                Condition::all()
                    .add(proposal::Column::ExternalId.eq(proposal.external_id.clone().take()))
                    .add(proposal::Column::DaoHandlerId.eq(proposal.dao_handler_id.clone().take())),
            )
            .one(db)
            .await
            .context(format!("DB error finding proposal {:?}", proposal.id))?;

        if let Some(existing) = existing_proposal {
            let mut updated_proposal = proposal.clone();
            updated_proposal.id = Set(existing.id);

            proposal::Entity::update(updated_proposal.clone())
                .exec(db)
                .await
                .context(format!(
                    "DB error for existing proposal {:?}",
                    updated_proposal.id
                ))?;

            updated_proposals += 1;
        } else if insert_ids_unique.insert(proposal.external_id.clone().take()) {
            proposals_to_insert.push(proposal);
            inserted_proposals += 1;
        }
    }

    proposal::Entity::insert_many(proposals_to_insert)
        .on_empty_do_nothing()
        .exec(db)
        .await
        .context("DB error for new proposals")?;

    Ok(StoredProposals {
        inserted_proposals,
        updated_proposals,
    })
}
