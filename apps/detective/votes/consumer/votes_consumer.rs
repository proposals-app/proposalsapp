use amqprs::channel::{
    BasicAckArguments, BasicConsumeArguments, BasicNackArguments, BasicQosArguments,
    BasicRejectArguments, Channel, QueueDeclareArguments,
};
use amqprs::connection::{Connection, OpenConnectionArguments};
use amqprs::consumer::AsyncConsumer;
use amqprs::{BasicProperties, Deliver};
use anyhow::{bail, Context, Result};
use async_trait::async_trait;
use axum::Router;
use dotenv::dotenv;
use sea_orm::ActiveValue::{NotSet, Set};
use sea_orm::{
    ColumnTrait, Condition, ConnectOptions, Database, DatabaseConnection, EntityTrait, QueryFilter,
    TransactionTrait,
};
use seaorm::sea_orm_active_enums::HandlerType;
use seaorm::sea_orm_active_enums::ProposalState;
use seaorm::{dao_handler, proposal, vote, voter};
use std::cmp::Reverse;
use std::collections::{HashMap, HashSet};
use tokio::sync::Notify;
use tracing::{info, instrument, warn};
use utils::rabbitmq_callbacks::{AppChannelCallback, AppConnectionCallback};
use utils::telemetry::setup_telemetry;
use utils::types::{VotesJob, VotesResponse};

mod handlers {
    pub mod aave_v2;
    pub mod aave_v3_avalanche;
    pub mod aave_v3_mainnet;
    pub mod aave_v3_polygon;
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
    pub mod maker_poll_arbitrum;
    pub mod nouns_proposals;
    pub mod optimism;
    pub mod snapshot;
    pub mod uniswap;
    pub mod zerox_treasury;
}

pub struct ChainVotesResult {
    votes: Vec<vote::ActiveModel>,
    to_index: Option<i64>,
}

const QUEUE_NAME: &str = "detective:votes";

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

    let queue = QueueDeclareArguments::durable_client_named(QUEUE_NAME);
    channel.queue_declare(queue).await.ok();

    tokio::spawn(async {
        let app = Router::new().route("/", axum::routing::get(|| async { "OK" }));
        let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
        axum::serve(listener, app).await.unwrap()
    });

    // 5 workers
    channel
        .basic_qos(BasicQosArguments::new(0, 5, false))
        .await?;

    channel
        .basic_consume(
            VotesConsumer::new(),
            BasicConsumeArguments::new(QUEUE_NAME, ""),
        )
        .await
        .unwrap();

    // consume forever
    let guard = Notify::new();
    guard.notified().await;

    Ok(())
}

pub struct VotesConsumer {}
impl VotesConsumer {
    pub fn new() -> Self {
        Self {}
    }
}
#[async_trait]
impl AsyncConsumer for VotesConsumer {
    async fn consume(
        &mut self,
        channel: &Channel,
        deliver: Deliver,
        _basic_properties: BasicProperties,
        content: Vec<u8>,
    ) {
        let job_str = String::from_utf8(content).ok();
        let job: VotesJob = serde_json::from_str(job_str.unwrap().as_str()).unwrap();

        let _ = match run(job.clone()).await {
            Ok(_) => {
                let args = BasicAckArguments::new(deliver.delivery_tag(), false);
                channel.basic_ack(args).await.unwrap();
            }
            Err(e) => {
                channel
                    .basic_nack(BasicNackArguments::new(deliver.delivery_tag(), false, true))
                    .await
                    .unwrap();
                warn!("votes_consumer error: {:?}", e);
                decrease_refresh_speed(job.clone()).await.unwrap();
            }
        };
    }
}

async fn run(job: VotesJob) -> Result<()> {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL not set!");

    let mut opt = ConnectOptions::new(database_url);
    opt.sqlx_logging(false);

    let db: DatabaseConnection = Database::connect(opt).await.context("DB connection")?;

    let dao_handler = dao_handler::Entity::find()
        .filter(dao_handler::Column::Id.eq(job.dao_handler_id.clone()))
        .one(&db)
        .await
        .context("DB error")?
        .context("DAO not found")?;

    match job.proposal_id.clone() {
        Some(proposal_id) => {
            let proposal = proposal::Entity::find()
                .filter(proposal::Column::Id.eq(proposal_id))
                .one(&db)
                .await
                .context("DB error")?
                .context("Proposal not found")?;

            let ChainVotesResult { votes, to_index: _ } =
                get_proposal_votes(&dao_handler, &proposal).await?;

            store_voters(&votes, &db).await?;

            let StoredVotes {
                inserted_votes,
                updated_votes,
            } = store_proposal_votes(&votes, &db).await?;

            let new_index = update_proposal_index(&votes, &proposal, &dao_handler, &db).await?;

            let response = VotesResponse {
                inserted_votes,
                updated_votes,
                new_index,
                dao_handler_id: dao_handler.id,
                proposal_id: Some(proposal.id),
            };

            info!("{:?}", response);
            Ok(())
        }
        None => {
            let ChainVotesResult { votes, to_index } = get_dao_votes(&dao_handler).await?;

            store_voters(&votes, &db).await?;

            let StoredVotes {
                inserted_votes,
                updated_votes,
            } = store_dao_votes(&votes, &dao_handler, &db).await?;

            let new_index = update_dao_index(&votes, &dao_handler, to_index, &db).await?;

            let response = VotesResponse {
                inserted_votes,
                updated_votes,
                new_index,
                dao_handler_id: dao_handler.id,
                proposal_id: None,
            };

            info!("{:?}", response);
            Ok(())
        }
    }
}

async fn decrease_refresh_speed(job: VotesJob) -> Result<()> {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL not set!");

    let mut opt = ConnectOptions::new(database_url);
    opt.sqlx_logging(false);

    let db: DatabaseConnection = Database::connect(opt).await.context("DB connection")?;

    let dao_handler = dao_handler::Entity::find()
        .filter(dao_handler::Column::Id.eq(job.dao_handler_id.clone()))
        .one(&db)
        .await
        .context("DB error")?
        .context("DAO not found")?;

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

    match job.proposal_id.clone() {
        Some(proposal_id) => {
            let proposal = proposal::Entity::find()
                .filter(proposal::Column::Id.eq(proposal_id))
                .one(&db)
                .await
                .context("DB error")?
                .context("DAO not found")?;

            let mut new_refresh_speed = (proposal.votes_refresh_speed as f32 * 0.5) as i64;

            if new_refresh_speed < min_refresh_speed {
                new_refresh_speed = min_refresh_speed;
            }

            info!(
                "Votes refresh speed decreased to {} for proposal {}",
                new_refresh_speed, proposal.id
            );

            proposal::Entity::update(proposal::ActiveModel {
                id: Set(proposal.id.clone()),
                votes_refresh_speed: Set(new_refresh_speed),
                ..Default::default()
            })
            .exec(&db)
            .await
            .context("DB error")?;

            Ok(())
        }
        None => {
            let mut new_refresh_speed = (dao_handler.votes_refresh_speed as f32 * 0.5) as i64;

            if new_refresh_speed < min_refresh_speed {
                new_refresh_speed = min_refresh_speed;
            }

            info!(
                "Votes refresh speed decreased to {} for DAO {}",
                new_refresh_speed, dao_handler.dao_id
            );

            dao_handler::Entity::update(dao_handler::ActiveModel {
                id: Set(dao_handler.id),
                votes_refresh_speed: Set(new_refresh_speed),
                ..Default::default()
            })
            .exec(&db)
            .await
            .context("DB error")?;

            Ok(())
        }
    }
}

#[instrument(skip_all)]
async fn store_voters(parsed_votes: &[vote::ActiveModel], db: &DatabaseConnection) -> Result<()> {
    let voters = parsed_votes
        .iter()
        .map(|v| v.voter_address.clone().take().unwrap())
        .collect::<HashSet<String>>();

    let txn = db.begin().await?;

    let existing_voters = voter::Entity::find()
        .filter(voter::Column::Address.is_in(voters.clone()))
        .all(&txn)
        .await
        .context("DB error")
        .context("store_voters")?;

    let existing_voters_addresses: Vec<String> =
        existing_voters.into_iter().map(|v| v.address).collect();

    let new_voters: Vec<String> = voters
        .into_iter()
        .filter(|v| !existing_voters_addresses.contains(v))
        .collect();

    let voters_to_insert = new_voters
        .into_iter()
        .map(|v| voter::ActiveModel {
            id: NotSet,
            address: Set(v.clone()),
            ens: NotSet,
        })
        .collect::<Vec<voter::ActiveModel>>();

    let _ = voter::Entity::insert_many(voters_to_insert)
        .on_empty_do_nothing()
        .exec(&txn)
        .await
        .context("DB error")
        .context("store_voters")?;

    txn.commit().await?;

    Ok(())
}

#[instrument(skip_all)]
async fn update_dao_index(
    parsed_votes: &[vote::ActiveModel],
    dao_handler: &dao_handler::Model,
    to_index: Option<i64>,
    db: &DatabaseConnection,
) -> Result<i64> {
    let mut new_index = *parsed_votes
        .iter()
        .map(|v| v.index_created.as_ref())
        .max()
        .unwrap_or(&dao_handler.votes_index);

    if dao_handler.handler_type != HandlerType::Snapshot {
        new_index = to_index.unwrap_or(dao_handler.votes_index + dao_handler.votes_refresh_speed);
    }

    let mut new_refresh_speed = (dao_handler.votes_refresh_speed as f32 * 1.2) as i64;

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

    if new_index > dao_handler.proposals_index
        && dao_handler.handler_type != HandlerType::MakerPollArbitrum
        && dao_handler.handler_type != HandlerType::AaveV3PolygonPos
        && dao_handler.handler_type != HandlerType::AaveV3Avalanche
    {
        new_index = dao_handler.proposals_index;
    }

    dao_handler::Entity::update(dao_handler::ActiveModel {
        id: Set(dao_handler.id.clone()),
        votes_index: Set(new_index),
        votes_refresh_speed: Set(new_refresh_speed),
        ..Default::default()
    })
    .exec(db)
    .await
    .context("DB error")
    .context("update_dao_index")?;

    Ok(new_index)
}

#[instrument(skip_all)]
async fn update_proposal_index(
    parsed_votes: &[vote::ActiveModel],
    proposal: &proposal::Model,
    dao_handler: &dao_handler::Model,
    db: &DatabaseConnection,
) -> Result<i64> {
    let new_index = parsed_votes
        .iter()
        .map(|v| v.index_created.as_ref())
        .max()
        .unwrap_or(&proposal.votes_index);

    let mut new_refresh_speed = (proposal.votes_refresh_speed as f32 * 1.2) as i64;

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

    let fetched_votes = proposal.proposal_state != ProposalState::Active
        && proposal.proposal_state != ProposalState::Pending
        && parsed_votes.is_empty();

    proposal::Entity::update(proposal::ActiveModel {
        id: Set(proposal.id.clone()),
        votes_index: Set(*new_index),
        votes_refresh_speed: Set(new_refresh_speed),
        votes_fetched: Set(fetched_votes.into()),
        ..Default::default()
    })
    .exec(db)
    .await
    .context("DB error")
    .context("update_proposal_index")?;

    Ok(*new_index)
}

struct StoredVotes {
    inserted_votes: u32,
    updated_votes: u32,
}

#[instrument(skip_all)]
async fn store_dao_votes(
    parsed_votes: &[vote::ActiveModel],
    dao_handler: &dao_handler::Model,
    db: &DatabaseConnection,
) -> Result<StoredVotes> {
    let mut inserted_votes = 0;
    let mut updated_votes = 0;

    // group votes by proposal so we can filter next
    let mut grouped_votes: HashMap<(String, String), Vec<vote::ActiveModel>> = HashMap::new();
    for vote in parsed_votes {
        let key = (
            vote.proposal_external_id.clone().take().unwrap(),
            vote.voter_address.clone().take().unwrap(),
        );
        grouped_votes.entry(key).or_default().push(vote.clone());
    }

    // filter only the newest vote, this will be used from now on
    let last_votes: Vec<vote::ActiveModel> = grouped_votes
        .into_iter()
        .flat_map(|(_, mut votes)| {
            votes.sort_by_key(|v| Reverse(v.index_created.clone().take()));
            votes.into_iter().last()
        })
        .collect();

    let proposal_external_ids = last_votes
        .clone()
        .into_iter()
        .map(|v| v.proposal_external_id.clone().unwrap())
        .collect::<HashSet<String>>();

    // the proposal might be on different chain
    // ex: aave mainnet proposal with aave polygon votes
    let proposal_handler_id = match dao_handler.handler_type {
        HandlerType::AaveV2Mainnet
        | HandlerType::AaveV3Mainnet
        | HandlerType::CompoundMainnet
        | HandlerType::UniswapMainnet
        | HandlerType::EnsMainnet
        | HandlerType::GitcoinMainnet
        | HandlerType::GitcoinV2Mainnet
        | HandlerType::HopMainnet
        | HandlerType::DydxMainnet
        | HandlerType::InterestProtocolMainnet
        | HandlerType::ZeroxProtocolMainnet
        | HandlerType::FraxAlphaMainnet
        | HandlerType::FraxOmegaMainnet
        | HandlerType::NounsProposalsMainnet
        | HandlerType::OpOptimism
        | HandlerType::ArbCoreArbitrum
        | HandlerType::ArbTreasuryArbitrum
        | HandlerType::MakerExecutiveMainnet
        | HandlerType::MakerPollMainnet
        | HandlerType::Snapshot => dao_handler.id.clone(),
        HandlerType::AaveV3PolygonPos => {
            dao_handler::Entity::find()
                .filter(dao_handler::Column::HandlerType.eq(HandlerType::AaveV3Mainnet))
                .one(db)
                .await
                .context("DB error")?
                .context("DAO not found")?
                .id
        }
        HandlerType::AaveV3Avalanche => {
            dao_handler::Entity::find()
                .filter(dao_handler::Column::HandlerType.eq(HandlerType::AaveV3Mainnet))
                .one(db)
                .await
                .context("DB error")?
                .context("DAO not found")?
                .id
        }
        HandlerType::MakerPollArbitrum => {
            dao_handler::Entity::find()
                .filter(dao_handler::Column::HandlerType.eq(HandlerType::MakerPollMainnet))
                .one(db)
                .await
                .context("DB error")?
                .context("DAO not found")?
                .id
        }
    };

    let proposals = proposal::Entity::find()
        .filter(
            Condition::all()
                .add(proposal::Column::ExternalId.is_in(proposal_external_ids.clone()))
                .add(proposal::Column::DaoHandlerId.eq(proposal_handler_id)),
        )
        .all(db)
        .await
        .context("DB error")
        .context("store_dao_votes 2")?;

    if proposals.len() != proposal_external_ids.len() {
        bail!(
            "One of these proposals was not found ${:?}",
            proposal_external_ids.clone()
        );
    }

    let proposal_map: HashMap<String, String> = proposals
        .clone()
        .into_iter()
        .map(|p| (p.external_id, p.id.clone()))
        .collect();

    let mut votes_to_process: Vec<vote::ActiveModel> = vec![];

    for vote in last_votes {
        if let Some(proposal_id) = proposal_map.get(&vote.proposal_external_id.clone().unwrap()) {
            let mut vote_clone = vote.clone();
            vote_clone.proposal_id = Set(proposal_id.clone());
            votes_to_process.push(vote_clone);
        }
    }

    let mut votes_to_insert = vec![];

    for vote in votes_to_process.clone() {
        let existing_vote = vote::Entity::find()
            .filter(
                Condition::all()
                    .add(vote::Column::ProposalId.eq(vote.proposal_id.clone().take().unwrap()))
                    .add(vote::Column::VoterAddress.eq(vote.voter_address.clone().take().unwrap())),
            )
            .one(db)
            .await
            .context("DB error")
            .context("store_dao_votes 3")?;

        if let Some(existing) = existing_vote {
            let mut updated_vote = vote.clone();
            updated_vote.id = Set(existing.id);

            vote::Entity::update(updated_vote.clone())
                .exec(db)
                .await
                .context("DB error")
                .context("store_dao_votes 4")?;

            updated_votes += 1;
        } else {
            votes_to_insert.push(vote);
            inserted_votes += 1;
        }
    }

    vote::Entity::insert_many(votes_to_insert)
        .on_empty_do_nothing()
        .exec(db)
        .await
        .context("DB error")
        .context("store_dao_votes 5")?;

    Ok(StoredVotes {
        inserted_votes,
        updated_votes,
    })
}

#[instrument(skip_all)]
async fn store_proposal_votes(
    parsed_votes: &[vote::ActiveModel],
    db: &DatabaseConnection,
) -> Result<StoredVotes> {
    let mut inserted_votes = 0;
    let mut updated_votes = 0;

    let mut votes_to_insert = vec![];

    for vote in parsed_votes.iter().cloned() {
        let existing_vote = vote::Entity::find()
            .filter(
                Condition::all()
                    .add(vote::Column::ProposalId.eq(vote.proposal_id.clone().take()))
                    .add(vote::Column::VoterAddress.eq(vote.voter_address.clone().take())),
            )
            .one(db)
            .await
            .context("DB error")
            .context("store_proposal_votes 1")?;

        if existing_vote.is_some() {
            let mut updated_vote = vote.clone();
            updated_vote.id = Set(existing_vote.unwrap().id);

            vote::Entity::update(updated_vote.clone())
                .exec(db)
                .await
                .context("DB error")
                .context("store_proposal_votes 2")?;

            updated_votes += 1;
        } else {
            votes_to_insert.push(vote);
            inserted_votes += 1;
        }
    }

    vote::Entity::insert_many(votes_to_insert)
        .on_empty_do_nothing()
        .exec(db)
        .await
        .context("DB error")
        .context("store_proposal_votes 3")?;

    Ok(StoredVotes {
        inserted_votes,
        updated_votes,
    })
}

#[instrument(skip_all)]
async fn get_dao_votes(dao_handler: &dao_handler::Model) -> Result<ChainVotesResult> {
    let votes = match dao_handler.handler_type {
        HandlerType::Snapshot => todo!(),
        HandlerType::AaveV2Mainnet => handlers::aave_v2::aave_v2_votes(dao_handler)
            .await
            .context("aave_v2_votes error")?,
        HandlerType::AaveV3Mainnet => handlers::aave_v3_mainnet::aave_v3_mainnet_votes(dao_handler)
            .await
            .context("aave_v3_mainnet_votes error")?,
        HandlerType::AaveV3PolygonPos => {
            handlers::aave_v3_polygon::aave_v3_polygon_votes(dao_handler)
                .await
                .context("aave_v3_polygon_votes error")?
        }
        HandlerType::AaveV3Avalanche => {
            handlers::aave_v3_avalanche::aave_v3_avalanche_votes(dao_handler)
                .await
                .context("aave_v3_avalanche_votes error")?
        }
        HandlerType::CompoundMainnet => handlers::compound::compound_votes(dao_handler)
            .await
            .context("compound_votes error")?,
        HandlerType::UniswapMainnet => handlers::uniswap::uniswap_votes(dao_handler)
            .await
            .context("uniswap_votes error")?,
        HandlerType::EnsMainnet => handlers::ens::ens_votes(dao_handler)
            .await
            .context("ens_votes error")?,
        HandlerType::GitcoinMainnet => handlers::gitcoin_v1::gitcoin_v1_votes(dao_handler)
            .await
            .context("gitcoin_v1_votes error")?,
        HandlerType::GitcoinV2Mainnet => handlers::gitcoin_v2::gitcoin_v2_votes(dao_handler)
            .await
            .context("gitcoin_v2_votes error")?,
        HandlerType::HopMainnet => handlers::hop::hop_votes(dao_handler)
            .await
            .context("hop_votes error")?,
        HandlerType::DydxMainnet => handlers::dydx::dydx_votes(dao_handler)
            .await
            .context("dydx_votes error")?,
        HandlerType::InterestProtocolMainnet => {
            handlers::interest_protocol::interest_protocol_votes(dao_handler)
                .await
                .context("interest_protocol_votes error")?
        }
        HandlerType::ZeroxProtocolMainnet => {
            handlers::zerox_treasury::zerox_treasury_votes(dao_handler)
                .await
                .context("zerox_treasury_votes error")?
        }
        HandlerType::FraxAlphaMainnet => handlers::frax_alpha::frax_alpha_votes(dao_handler)
            .await
            .context("frax_alpha_votes error")?,
        HandlerType::FraxOmegaMainnet => handlers::frax_omega::frax_omega_votes(dao_handler)
            .await
            .context("frax_omega_votes error")?,
        HandlerType::NounsProposalsMainnet => {
            handlers::nouns_proposals::nouns_proposals_votes(dao_handler)
                .await
                .context("nouns_proposals_votes error")?
        }
        HandlerType::MakerExecutiveMainnet => {
            handlers::maker_executive::maker_executive_votes(dao_handler)
                .await
                .context("maker_executive_votes error")?
        }
        HandlerType::MakerPollMainnet => handlers::maker_poll::maker_poll_votes(dao_handler)
            .await
            .context("maker_poll_votes error")?,
        HandlerType::MakerPollArbitrum => {
            handlers::maker_poll_arbitrum::maker_poll_arbitrum_votes(dao_handler)
                .await
                .context("maker_poll_arbitrum_votes error")?
        }
        HandlerType::OpOptimism => handlers::optimism::optimism_votes(dao_handler)
            .await
            .context("optimism_votes error")?,
        HandlerType::ArbCoreArbitrum => handlers::arbitrum_core::arbitrum_core_votes(dao_handler)
            .await
            .context("arbitrum_core_votes error")?,
        HandlerType::ArbTreasuryArbitrum => {
            handlers::arbitrum_treasury::arbitrum_treasury_votes(dao_handler)
                .await
                .context("arbitrum_treasury_votes error")?
        }
    };

    Ok(votes)
}

#[instrument(skip_all)]
async fn get_proposal_votes(
    dao_handler: &dao_handler::Model,
    proposal: &proposal::Model,
) -> Result<ChainVotesResult> {
    let votes = match dao_handler.handler_type {
        HandlerType::Snapshot => handlers::snapshot::snapshot_votes(dao_handler, proposal)
            .await
            .context("snapshot_votes error")?,
        HandlerType::AaveV2Mainnet => todo!(),
        HandlerType::AaveV3Mainnet => todo!(),
        HandlerType::AaveV3PolygonPos => todo!(),
        HandlerType::AaveV3Avalanche => todo!(),
        HandlerType::CompoundMainnet => todo!(),
        HandlerType::UniswapMainnet => todo!(),
        HandlerType::EnsMainnet => todo!(),
        HandlerType::GitcoinMainnet => todo!(),
        HandlerType::GitcoinV2Mainnet => todo!(),
        HandlerType::HopMainnet => todo!(),
        HandlerType::DydxMainnet => todo!(),
        HandlerType::InterestProtocolMainnet => todo!(),
        HandlerType::ZeroxProtocolMainnet => todo!(),
        HandlerType::FraxAlphaMainnet => todo!(),
        HandlerType::FraxOmegaMainnet => todo!(),
        HandlerType::NounsProposalsMainnet => todo!(),
        HandlerType::MakerExecutiveMainnet => todo!(),
        HandlerType::MakerPollMainnet => todo!(),
        HandlerType::MakerPollArbitrum => todo!(),
        HandlerType::OpOptimism => todo!(),
        HandlerType::ArbCoreArbitrum => todo!(),
        HandlerType::ArbTreasuryArbitrum => todo!(),
    };

    Ok(votes)
}
