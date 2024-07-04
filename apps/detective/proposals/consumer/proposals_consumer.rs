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
use seaorm::sea_orm_active_enums::{DaoHandlerEnum, ProposalStateEnum};
use seaorm::{dao_handler, proposal};
use std::collections::HashSet;
use tokio::sync::Notify;
use tracing::{error, info, warn}; // Added error for better logging
use utils::rabbitmq_callbacks::{AppChannelCallback, AppConnectionCallback};
use utils::telemetry::setup_telemetry;
use utils::types::{ProposalsJob, ProposalsResponse};

mod handlers {
    pub mod aave_v2;
    pub mod aave_v3;
    pub mod arbitrum_core;
    pub mod arbitrum_treasury;
    pub mod compound;
    pub mod dydx;
    pub mod ens;
    pub mod frax_alpha;
    pub mod frax_omega;
    pub mod gitcoin_v1;
    pub mod gitcoin_v2;
    pub mod hop;
    pub mod interest_protocol;
    pub mod maker_executive;
    pub mod maker_poll;
    pub mod nouns_proposal;
    pub mod optimism;
    pub mod snapshot;
    pub mod uniswap;
    pub mod zerox_treasury;
}

pub struct ChainProposalsResult {
    proposals: Vec<proposal::ActiveModel>,
    to_index: Option<i32>,
}

const QUEUE_NAME: &str = "detective:proposals";

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    setup_telemetry();

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

        let _ = match run(job.clone()).await {
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
        };
    }
}

async fn run(job: ProposalsJob) -> Result<()> {
    info!("{:?}", job);
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

    let ChainProposalsResult {
        proposals,
        to_index,
    } = get_proposals(&dao_handler).await?;

    let StoredProposals {
        inserted_proposals,
        updated_proposals,
    } = store_proposals(&proposals, &db).await?;

    let new_index = update_index(&proposals, &dao_handler, to_index, &db).await?;

    let response = ProposalsResponse {
        inserted_proposals,
        updated_proposals,
        new_index,
        dao_handler_id: dao_handler.id.into(),
    };

    info!("{:?}", response);

    Ok(())
}

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

    let mut new_refresh_speed = (dao_handler.proposals_refresh_speed as f32 * 0.5) as i32;

    let min_refresh_speed = match dao_handler.handler_type {
        DaoHandlerEnum::AaveV2Mainnet => 100,
        DaoHandlerEnum::AaveV3Mainnet => 100,
        DaoHandlerEnum::AaveV3PolygonPos => 100,
        DaoHandlerEnum::AaveV3Avalanche => 100,
        DaoHandlerEnum::CompoundMainnet => 100,
        DaoHandlerEnum::UniswapMainnet => 100,
        DaoHandlerEnum::EnsMainnet => 100,
        DaoHandlerEnum::GitcoinMainnet => 100,
        DaoHandlerEnum::GitcoinV2Mainnet => 100,
        DaoHandlerEnum::HopMainnet => 100,
        DaoHandlerEnum::DydxMainnet => 100,
        DaoHandlerEnum::InterestProtocolMainnet => 100,
        DaoHandlerEnum::ZeroxProtocolMainnet => 100,
        DaoHandlerEnum::FraxAlphaMainnet => 100,
        DaoHandlerEnum::FraxOmegaMainnet => 100,
        DaoHandlerEnum::NounsProposalsMainnet => 100,
        DaoHandlerEnum::MakerExecutiveMainnet => 100,
        DaoHandlerEnum::MakerPollMainnet => 100,
        DaoHandlerEnum::MakerPollArbitrum => 100,
        DaoHandlerEnum::OpOptimism => 100,
        DaoHandlerEnum::ArbCoreArbitrum => 100,
        DaoHandlerEnum::ArbTreasuryArbitrum => 100,
        DaoHandlerEnum::Snapshot => 10,
    };

    if new_refresh_speed < min_refresh_speed {
        new_refresh_speed = min_refresh_speed;
    }

    info!(
        "Refresh speed decreased to {} for DAO {}",
        new_refresh_speed, dao_handler.dao_id
    );

    dao_handler::Entity::update(dao_handler::ActiveModel {
        id: Set(dao_handler.id.clone()),
        proposals_refresh_speed: Set(new_refresh_speed),
        ..Default::default()
    })
    .exec(&db)
    .await
    .context("DB error while updating DAO handler to decrease refresh speed")?;

    Ok(())
}

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

    let mut new_refresh_speed = (dao_handler.proposals_refresh_speed as f32 * 1.2) as i32;

    let max_refresh_speed = match dao_handler.handler_type {
        DaoHandlerEnum::AaveV2Mainnet => 1_000_000,
        DaoHandlerEnum::AaveV3Mainnet => 1_000_000,
        DaoHandlerEnum::AaveV3PolygonPos => 1_000_000,
        DaoHandlerEnum::AaveV3Avalanche => 1_000_000,
        DaoHandlerEnum::CompoundMainnet => 1_000_000,
        DaoHandlerEnum::UniswapMainnet => 1_000_000,
        DaoHandlerEnum::EnsMainnet => 1_000_000,
        DaoHandlerEnum::GitcoinMainnet => 1_000_000,
        DaoHandlerEnum::GitcoinV2Mainnet => 1_000_000,
        DaoHandlerEnum::HopMainnet => 1_000_000,
        DaoHandlerEnum::DydxMainnet => 1_000_000,
        DaoHandlerEnum::InterestProtocolMainnet => 1_000_000,
        DaoHandlerEnum::ZeroxProtocolMainnet => 1_000_000,
        DaoHandlerEnum::FraxAlphaMainnet => 1_000_000,
        DaoHandlerEnum::FraxOmegaMainnet => 1_000_000,
        DaoHandlerEnum::NounsProposalsMainnet => 1_000_000,
        DaoHandlerEnum::MakerExecutiveMainnet => 1_000_000,
        DaoHandlerEnum::MakerPollMainnet => 1_000_000,
        DaoHandlerEnum::MakerPollArbitrum => 1_000_000,
        DaoHandlerEnum::OpOptimism => 1_000_000,
        DaoHandlerEnum::ArbCoreArbitrum => 1_000_000,
        DaoHandlerEnum::ArbTreasuryArbitrum => 1_000_000,
        DaoHandlerEnum::Snapshot => 1_000,
    };

    if new_refresh_speed > max_refresh_speed {
        new_refresh_speed = max_refresh_speed;
    }

    dao_handler::Entity::update(dao_handler::ActiveModel {
        id: Set(dao_handler.id.clone()),
        proposals_refresh_speed: Set(new_refresh_speed),
        ..Default::default()
    })
    .exec(&db)
    .await
    .context("DB error while updating DAO handler to increase refresh speed")?;

    Ok(())
}

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
        id: Set(dao_handler.id.clone()),
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

        if existing_proposal.is_some() {
            let mut updated_proposal = proposal.clone();
            updated_proposal.id = Set(existing_proposal.unwrap().id);

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

async fn get_proposals(dao_handler: &dao_handler::Model) -> Result<ChainProposalsResult> {
    let proposals = match dao_handler.handler_type {
        DaoHandlerEnum::Snapshot => handlers::snapshot::snapshot_proposals(dao_handler)
            .await
            .context("snapshot_proposals error")?,
        DaoHandlerEnum::AaveV2Mainnet => handlers::aave_v2::aave_v2_proposals(dao_handler)
            .await
            .context("aave_v2_proposals error")?,
        DaoHandlerEnum::AaveV3Mainnet => handlers::aave_v3::aave_v3_proposals(dao_handler)
            .await
            .context("aave_v3_proposals error")?,
        DaoHandlerEnum::AaveV3PolygonPos => todo!(),
        DaoHandlerEnum::AaveV3Avalanche => todo!(),
        DaoHandlerEnum::CompoundMainnet => handlers::compound::compound_proposals(dao_handler)
            .await
            .context("compound_proposals error")?,
        DaoHandlerEnum::UniswapMainnet => handlers::uniswap::uniswap_proposals(dao_handler)
            .await
            .context("uniswap_proposals error")?,
        DaoHandlerEnum::EnsMainnet => handlers::ens::ens_proposals(dao_handler)
            .await
            .context("ens_proposals error")?,
        DaoHandlerEnum::GitcoinMainnet => handlers::gitcoin_v1::gitcoin_v1_proposals(dao_handler)
            .await
            .context("gitcoin_v1_proposals error")?,
        DaoHandlerEnum::GitcoinV2Mainnet => handlers::gitcoin_v2::gitcoin_v2_proposals(dao_handler)
            .await
            .context("gitcoin_v2_proposals error")?,
        DaoHandlerEnum::HopMainnet => handlers::hop::hop_proposals(dao_handler)
            .await
            .context("hop_proposals error")?,
        DaoHandlerEnum::DydxMainnet => handlers::dydx::dydx_proposals(dao_handler)
            .await
            .context("dydx_proposals error")?,
        DaoHandlerEnum::InterestProtocolMainnet => {
            handlers::interest_protocol::interest_protocol_proposals(dao_handler)
                .await
                .context("interest_protocol_proposals error")?
        }
        DaoHandlerEnum::ZeroxProtocolMainnet => {
            handlers::zerox_treasury::zerox_treasury_proposals(dao_handler)
                .await
                .context("zerox_treasury_proposals error")?
        }
        DaoHandlerEnum::FraxAlphaMainnet => handlers::frax_alpha::frax_alpha_proposals(dao_handler)
            .await
            .context("frax_alpha_proposals error")?,
        DaoHandlerEnum::FraxOmegaMainnet => handlers::frax_omega::frax_omega_proposals(dao_handler)
            .await
            .context("frax_omega_proposals error")?,
        DaoHandlerEnum::NounsProposalsMainnet => {
            handlers::nouns_proposal::nouns_proposal_proposals(dao_handler)
                .await
                .context("nouns_proposal_proposals error")?
        }
        DaoHandlerEnum::MakerExecutiveMainnet => {
            handlers::maker_executive::maker_executive_proposals(dao_handler)
                .await
                .context("maker_executive_proposals error")?
        }
        DaoHandlerEnum::MakerPollMainnet => handlers::maker_poll::maker_poll_proposals(dao_handler)
            .await
            .context("maker_poll_proposals error")?,
        DaoHandlerEnum::MakerPollArbitrum => todo!(),
        DaoHandlerEnum::OpOptimism => handlers::optimism::optimism_proposals(dao_handler)
            .await
            .context("optimism_proposals error")?,
        DaoHandlerEnum::ArbCoreArbitrum => {
            handlers::arbitrum_core::arbitrum_core_proposals(dao_handler)
                .await
                .context("arbitrum_core_proposals error")?
        }
        DaoHandlerEnum::ArbTreasuryArbitrum => {
            handlers::arbitrum_treasury::arbitrum_treasury_proposals(dao_handler)
                .await
                .context("arbitrum_treasury_proposals error")?
        }
    };
    Ok(proposals)
}
