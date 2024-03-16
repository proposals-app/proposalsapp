use amqprs::channel::{
    BasicAckArguments, BasicConsumeArguments, BasicNackArguments, Channel, QueueDeclareArguments,
};
use amqprs::connection::{Connection, OpenConnectionArguments};
use amqprs::consumer::AsyncConsumer;
use amqprs::{BasicProperties, Deliver, FieldTable};
use anyhow::{Context, Result};
use async_trait::async_trait;
use axum::Router;
use dotenv::dotenv;
use itertools::Itertools;
use sea_orm::{
    ColumnTrait, Condition, ConnectOptions, Database, DatabaseConnection, EntityTrait, QueryFilter,
    Set,
};
use seaorm::sea_orm_active_enums::{HandlerType, ProposalState};
use seaorm::{dao_handler, proposal};
use std::collections::HashSet;
use tokio::sync::Notify;
use tracing::{info, instrument, warn};
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
    to_index: Option<i64>,
}

const QUEUE_NAME: &str = "detective:proposals";

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    setup_telemetry();

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
        .passive(true)
        .finish();
    channel.queue_declare(queue).await?;

    tokio::spawn(async {
        let app = Router::new().route("/", axum::routing::get(|| async { "OK" }));
        let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
        axum::serve(listener, app).await.unwrap()
    });

    let args = BasicConsumeArguments::new(QUEUE_NAME, "")
        .manual_ack(true)
        .finish();

    channel
        .basic_consume(ProposalsConsumer::new(), args)
        .await
        .unwrap();

    // consume forever
    let guard = Notify::new();
    guard.notified().await;

    Ok(())
}

pub struct ProposalsConsumer {}
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
                let args = BasicAckArguments::new(deliver.delivery_tag(), false);
                channel.basic_ack(args).await.unwrap();
            }
            Err(e) => {
                let args = BasicNackArguments::new(deliver.delivery_tag(), false, true);
                channel.basic_nack(args).await.unwrap();
                warn!("proposals_consumer error: {:?}", e);
                decrease_refresh_speed(job.clone()).await.unwrap();
            }
        };
    }
}

async fn run(job: ProposalsJob) -> Result<()> {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL not set!");

    let mut opt = ConnectOptions::new(database_url);
    opt.sqlx_logging(false);

    let db: DatabaseConnection = Database::connect(opt).await.context("DB connection")?;

    let dao_handler = dao_handler::Entity::find()
        .filter(dao_handler::Column::Id.eq(job.dao_handler_id))
        .one(&db)
        .await
        .context("DB error")?
        .context("dao_handler error")?;

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
        dao_handler_id: dao_handler.id,
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
        .context("DB error")?
        .context("dao_handler error")?;

    let mut new_refresh_speed = (dao_handler.proposals_refresh_speed as f32 * 0.5) as i64;

    let min_refresh_speed = match dao_handler.handler_type {
        HandlerType::AaveV2Mainnet => 100,
        HandlerType::AaveV3Mainnet => 100,
        HandlerType::AaveV3PolygonPos => 100,
        HandlerType::AaveV3Avalanche => 100,
        HandlerType::CompoundMainnet => 100,
        HandlerType::UniswapMainnet => 100,
        HandlerType::EnsMainnet => 100,
        HandlerType::GitcoinMainnet => 100,
        HandlerType::GitcoinV2Mainnet => 100,
        HandlerType::HopMainnet => 100,
        HandlerType::DydxMainnet => 100,
        HandlerType::InterestProtocolMainnet => 100,
        HandlerType::ZeroxProtocolMainnet => 100,
        HandlerType::FraxAlphaMainnet => 100,
        HandlerType::FraxOmegaMainnet => 100,
        HandlerType::NounsProposalsMainnet => 100,
        HandlerType::MakerExecutiveMainnet => 100,
        HandlerType::MakerPollMainnet => 100,
        HandlerType::MakerPollArbitrum => 100,
        HandlerType::OpOptimism => 100,
        HandlerType::ArbCoreArbitrum => 100,
        HandlerType::ArbTreasuryArbitrum => 100,
        HandlerType::Snapshot => 1,
    };

    if new_refresh_speed < min_refresh_speed {
        new_refresh_speed = min_refresh_speed;
    }

    info!(
        "Proposals refresh speed decreased to {} for DAO {}",
        new_refresh_speed, dao_handler.dao_id
    );

    dao_handler::Entity::update(dao_handler::ActiveModel {
        id: Set(dao_handler.id.clone()),
        proposals_refresh_speed: Set(new_refresh_speed),
        ..Default::default()
    })
    .exec(&db)
    .await
    .context("DB error")
    .context("Failed to decrease refresh speed")?;

    Ok(())
}

#[instrument(skip_all)]
async fn update_index(
    parsed_proposals: &[proposal::ActiveModel],
    dao_handler: &dao_handler::Model,
    to_index: Option<i64>,
    db: &DatabaseConnection,
) -> Result<i64> {
    let mut new_index =
        to_index.unwrap_or(dao_handler.proposals_index + dao_handler.proposals_refresh_speed);

    let sorted_proposals = parsed_proposals
        .iter()
        .sorted_by(|a, b| a.index_created.as_ref().cmp(b.index_created.as_ref()))
        .collect_vec();

    for proposal in sorted_proposals.iter() {
        if proposal.proposal_state.as_ref() == &ProposalState::Active
            && proposal.index_created.is_set()
            && proposal.index_created.clone().unwrap() < new_index
        {
            new_index = proposal.index_created.clone().unwrap();
            break;
        }
    }

    let mut new_refresh_speed = (dao_handler.proposals_refresh_speed as f32 * 1.2) as i64;

    let max_refresh_speed = match dao_handler.handler_type {
        HandlerType::AaveV2Mainnet => 1_000_000,
        HandlerType::AaveV3Mainnet => 1_000_000,
        HandlerType::AaveV3PolygonPos => 1_000_000,
        HandlerType::AaveV3Avalanche => 1_000_000,
        HandlerType::CompoundMainnet => 1_000_000,
        HandlerType::UniswapMainnet => 1_000_000,
        HandlerType::EnsMainnet => 1_000_000,
        HandlerType::GitcoinMainnet => 1_000_000,
        HandlerType::GitcoinV2Mainnet => 1_000_000,
        HandlerType::HopMainnet => 1_000_000,
        HandlerType::DydxMainnet => 1_000_000,
        HandlerType::InterestProtocolMainnet => 1_000_000,
        HandlerType::ZeroxProtocolMainnet => 1_000_000,
        HandlerType::FraxAlphaMainnet => 1_000_000,
        HandlerType::FraxOmegaMainnet => 1_000_000,
        HandlerType::NounsProposalsMainnet => 1_000_000,
        HandlerType::MakerExecutiveMainnet => 1_000_000,
        HandlerType::MakerPollMainnet => 1_000_000,
        HandlerType::MakerPollArbitrum => 1_000_000,
        HandlerType::OpOptimism => 1_000_000,
        HandlerType::ArbCoreArbitrum => 1_000_000,
        HandlerType::ArbTreasuryArbitrum => 1_000_000,
        HandlerType::Snapshot => 1_000,
    };

    if new_refresh_speed > max_refresh_speed {
        new_refresh_speed = max_refresh_speed;
    }

    dao_handler::Entity::update(dao_handler::ActiveModel {
        id: Set(dao_handler.id.clone()),
        proposals_index: Set(new_index),
        proposals_refresh_speed: Set(new_refresh_speed),
        ..Default::default()
    })
    .exec(db)
    .await
    .context("DB error")?;

    Ok(new_index)
}

struct StoredProposals {
    inserted_proposals: u32,
    updated_proposals: u32,
}

#[instrument(skip_all)]
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

#[instrument(skip_all)]
async fn get_proposals(dao_handler: &dao_handler::Model) -> Result<ChainProposalsResult> {
    let proposals = match dao_handler.handler_type {
        HandlerType::Snapshot => handlers::snapshot::snapshot_proposals(dao_handler)
            .await
            .context("snapshot_proposals error")?,
        HandlerType::AaveV2Mainnet => handlers::aave_v2::aave_v2_proposals(dao_handler)
            .await
            .context("aave_v2_proposals error")?,
        HandlerType::AaveV3Mainnet => handlers::aave_v3::aave_v3_proposals(dao_handler)
            .await
            .context("aave_v3_proposals error")?,
        HandlerType::AaveV3PolygonPos => todo!(),
        HandlerType::AaveV3Avalanche => todo!(),
        HandlerType::CompoundMainnet => handlers::compound::compound_proposals(dao_handler)
            .await
            .context("compound_proposals error")?,
        HandlerType::UniswapMainnet => handlers::uniswap::uniswap_proposals(dao_handler)
            .await
            .context("uniswap_proposals error")?,
        HandlerType::EnsMainnet => handlers::ens::ens_proposals(dao_handler)
            .await
            .context("ens_proposals error")?,
        HandlerType::GitcoinMainnet => handlers::gitcoin_v1::gitcoin_v1_proposals(dao_handler)
            .await
            .context("gitcoin_v1_proposals error")?,
        HandlerType::GitcoinV2Mainnet => handlers::gitcoin_v2::gitcoin_v2_proposals(dao_handler)
            .await
            .context("gitcoin_v2_proposals error")?,
        HandlerType::HopMainnet => handlers::hop::hop_proposals(dao_handler)
            .await
            .context("hop_proposals error")?,
        HandlerType::DydxMainnet => handlers::dydx::dydx_proposals(dao_handler)
            .await
            .context("dydx_proposals error")?,
        HandlerType::InterestProtocolMainnet => {
            handlers::interest_protocol::interest_protocol_proposals(dao_handler)
                .await
                .context("interest_protocol_proposals error")?
        }
        HandlerType::ZeroxProtocolMainnet => {
            handlers::zerox_treasury::zerox_treasury_proposals(dao_handler)
                .await
                .context("zerox_treasury_proposals error")?
        }
        HandlerType::FraxAlphaMainnet => handlers::frax_alpha::frax_alpha_proposals(dao_handler)
            .await
            .context("frax_alpha_proposals error")?,
        HandlerType::FraxOmegaMainnet => handlers::frax_omega::frax_omega_proposals(dao_handler)
            .await
            .context("frax_omega_proposals error")?,
        HandlerType::NounsProposalsMainnet => {
            handlers::nouns_proposal::nouns_proposal_proposals(dao_handler)
                .await
                .context("nouns_proposal_proposals error")?
        }
        HandlerType::MakerExecutiveMainnet => {
            handlers::maker_executive::maker_executive_proposals(dao_handler)
                .await
                .context("maker_executive_proposals error")?
        }
        HandlerType::MakerPollMainnet => handlers::maker_poll::maker_poll_proposals(dao_handler)
            .await
            .context("maker_poll_proposals error")?,
        HandlerType::MakerPollArbitrum => todo!(),
        HandlerType::OpOptimism => handlers::optimism::optimism_proposals(dao_handler)
            .await
            .context("optimism_proposals error")?,
        HandlerType::ArbCoreArbitrum => {
            handlers::arbitrum_core::arbitrum_core_proposals(dao_handler)
                .await
                .context("arbitrum_core_proposals error")?
        }
        HandlerType::ArbTreasuryArbitrum => {
            handlers::arbitrum_treasury::arbitrum_treasury_proposals(dao_handler)
                .await
                .context("arbitrum_treasury_proposals error")?
        }
    };
    Ok(proposals)
}
