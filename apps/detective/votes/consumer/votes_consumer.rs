use amqprs::channel::{
    BasicAckArguments, BasicConsumeArguments, BasicNackArguments, BasicQosArguments, Channel,
    QueueDeclareArguments,
};
use amqprs::connection::{Connection, OpenConnectionArguments};
use amqprs::consumer::AsyncConsumer;
use amqprs::{BasicProperties, Deliver};
use anyhow::{bail, Context, Result};
use async_trait::async_trait;
use dotenv::dotenv;
use sea_orm::prelude::Uuid;
use sea_orm::ActiveValue::{NotSet, Set};
use sea_orm::{
    ColumnTrait, Condition, ConnectOptions, Database, DatabaseConnection, EntityTrait, QueryFilter,
    TransactionTrait,
};
use seaorm::sea_orm_active_enums::DaoHandlerEnum;
use seaorm::sea_orm_active_enums::ProposalStateEnum;
use seaorm::{dao_handler, proposal, vote, voter};
use std::cmp::Reverse;
use std::collections::{HashMap, HashSet};
use tokio::sync::Notify;
use tracing::{error, info, instrument, warn}; // Added error for better logging
use utils::rabbitmq_callbacks::{AppChannelCallback, AppConnectionCallback};
use utils::tracing::setup_tracing;

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
    to_index: Option<i32>,
}

const QUEUE_NAME: &str = "detective:votes";

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    setup_tracing();

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
impl Default for VotesConsumer {
    fn default() -> Self {
        Self::new()
    }
}

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
        let job: VotesJob = match serde_json::from_str(job_str.unwrap().as_str()) {
            Ok(job) => job,
            Err(e) => {
                error!("Failed to parse job: {:?}", e);
                return;
            }
        };

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
                warn!("votes_consumer error: {:?}", e);
            }
        };
    }
}

#[instrument]
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

            let new_index = update_proposal_index(&votes, &proposal, &db).await?;

            let response = VotesResponse {
                inserted_votes,
                updated_votes,
                new_index,
                dao_handler_id: dao_handler.id.into(),
                proposal_id: Some(proposal.id.into()),
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
                dao_handler_id: dao_handler.id.into(),
                proposal_id: None,
            };

            info!("{:?}", response);
            Ok(())
        }
    }
}

#[instrument]
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

    match job.proposal_id.clone() {
        Some(proposal_id) => {
            let proposal = proposal::Entity::find()
                .filter(proposal::Column::Id.eq(proposal_id))
                .one(&db)
                .await
                .context("DB error")?
                .context("Proposal not found")?;

            let mut new_refresh_speed = (proposal.votes_refresh_speed as f32 * 0.5) as i32;

            if new_refresh_speed < min_refresh_speed {
                new_refresh_speed = min_refresh_speed;
            }

            info!(
                "Refresh speed decreased to {} for proposal {}",
                new_refresh_speed, proposal.id
            );

            proposal::Entity::update(proposal::ActiveModel {
                id: Set(proposal.id.clone()),
                votes_refresh_speed: Set(new_refresh_speed),
                ..Default::default()
            })
            .exec(&db)
            .await
            .context("Failed to decrease refresh speed")?;

            Ok(())
        }
        None => {
            let mut new_refresh_speed = (dao_handler.votes_refresh_speed as f32 * 0.5) as i32;

            if new_refresh_speed < min_refresh_speed {
                new_refresh_speed = min_refresh_speed;
            }

            info!(
                "Refresh speed decreased to {} for DAO {}",
                new_refresh_speed, dao_handler.dao_id
            );

            dao_handler::Entity::update(dao_handler::ActiveModel {
                id: Set(dao_handler.id),
                votes_refresh_speed: Set(new_refresh_speed),
                ..Default::default()
            })
            .exec(&db)
            .await
            .context("Failed to decrease refresh speed")?;

            Ok(())
        }
    }
}

#[instrument]
async fn increase_refresh_speed(job: VotesJob) -> Result<()> {
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

    match job.proposal_id.clone() {
        Some(proposal_id) => {
            let proposal = proposal::Entity::find()
                .filter(proposal::Column::Id.eq(proposal_id))
                .one(&db)
                .await
                .context("DB error")?
                .context("Proposal not found")?;

            let mut new_refresh_speed = (proposal.votes_refresh_speed as f32 * 1.2) as i32;

            if new_refresh_speed > max_refresh_speed {
                new_refresh_speed = max_refresh_speed;
            }

            proposal::Entity::update(proposal::ActiveModel {
                id: Set(proposal.id.clone()),
                votes_refresh_speed: Set(new_refresh_speed),
                ..Default::default()
            })
            .exec(&db)
            .await
            .context("Failed to increase refresh speed")?;

            Ok(())
        }
        None => {
            let mut new_refresh_speed = (dao_handler.votes_refresh_speed as f32 * 1.2) as i32;

            if new_refresh_speed > max_refresh_speed {
                new_refresh_speed = max_refresh_speed;
            }

            dao_handler::Entity::update(dao_handler::ActiveModel {
                id: Set(dao_handler.id),
                votes_refresh_speed: Set(new_refresh_speed),
                ..Default::default()
            })
            .exec(&db)
            .await
            .context("Failed to increase refresh speed")?;

            Ok(())
        }
    }
}

#[instrument(skip(db))]
async fn store_voters(parsed_votes: &[vote::ActiveModel], db: &DatabaseConnection) -> Result<()> {
    let voters = parsed_votes
        .iter()
        .map(|v| v.voter_address.clone().take().unwrap())
        .collect::<HashSet<String>>();

    let txn = db
        .begin()
        .await
        .context("DB error: Failed to begin transaction for store_voters")?;

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

    // Insert voters in batches to avoid exceeding parameter limit
    const BATCH_SIZE: usize = 1000;
    for chunk in voters_to_insert.chunks(BATCH_SIZE) {
        voter::Entity::insert_many(chunk.to_vec())
            .on_empty_do_nothing()
            .exec(&txn)
            .await
            .context("DB error")
            .context("store_voters")?;
    }

    txn.commit()
        .await
        .context("DB error: Failed to commit transaction for store_voters")?;

    Ok(())
}

#[instrument(skip(db))]
async fn update_dao_index(
    parsed_votes: &[vote::ActiveModel],
    dao_handler: &dao_handler::Model,
    to_index: Option<i32>,
    db: &DatabaseConnection,
) -> Result<i32> {
    let mut new_index = *parsed_votes
        .iter()
        .map(|v| v.index_created.as_ref())
        .max()
        .unwrap_or(&dao_handler.votes_index);

    if dao_handler.handler_type != DaoHandlerEnum::Snapshot {
        new_index = to_index.unwrap_or(dao_handler.votes_index + dao_handler.votes_refresh_speed);
    }

    if new_index > dao_handler.proposals_index
        && dao_handler.handler_type != DaoHandlerEnum::MakerPollArbitrum
        && dao_handler.handler_type != DaoHandlerEnum::AaveV3PolygonPos
        && dao_handler.handler_type != DaoHandlerEnum::AaveV3Avalanche
    {
        new_index = dao_handler.proposals_index;
    }

    dao_handler::Entity::update(dao_handler::ActiveModel {
        id: Set(dao_handler.id.clone()),
        votes_index: Set(new_index - 3600),
        ..Default::default()
    })
    .exec(db)
    .await
    .context("DB error")
    .context("update_dao_index")?;

    Ok(new_index)
}

#[instrument(skip(db))]
async fn update_proposal_index(
    parsed_votes: &[vote::ActiveModel],
    proposal: &proposal::Model,
    db: &DatabaseConnection,
) -> Result<i32> {
    let new_index = parsed_votes
        .iter()
        .map(|v| v.index_created.as_ref())
        .max()
        .unwrap_or(&proposal.votes_index);

    let fetched_votes = proposal.proposal_state != ProposalStateEnum::Active
        && proposal.proposal_state != ProposalStateEnum::Pending
        && parsed_votes.is_empty();

    proposal::Entity::update(proposal::ActiveModel {
        id: Set(proposal.id.clone()),
        votes_index: Set(*new_index - 3600),
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

#[instrument(skip(db))]
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

    // Log the number of unique proposal_external_ids
    info!(
        "Number of unique proposal_external_ids: {}",
        proposal_external_ids.len()
    );

    // the proposal might be on different chain
    // ex: aave mainnet proposal with aave polygon votes
    let proposal_handler_id = match dao_handler.handler_type {
        DaoHandlerEnum::AaveV2Mainnet
        | DaoHandlerEnum::AaveV3Mainnet
        | DaoHandlerEnum::CompoundMainnet
        | DaoHandlerEnum::UniswapMainnet
        | DaoHandlerEnum::EnsMainnet
        | DaoHandlerEnum::GitcoinMainnet
        | DaoHandlerEnum::GitcoinV2Mainnet
        | DaoHandlerEnum::HopMainnet
        | DaoHandlerEnum::DydxMainnet
        | DaoHandlerEnum::InterestProtocolMainnet
        | DaoHandlerEnum::ZeroxProtocolMainnet
        | DaoHandlerEnum::FraxAlphaMainnet
        | DaoHandlerEnum::FraxOmegaMainnet
        | DaoHandlerEnum::NounsProposalsMainnet
        | DaoHandlerEnum::OpOptimism
        | DaoHandlerEnum::ArbCoreArbitrum
        | DaoHandlerEnum::ArbTreasuryArbitrum
        | DaoHandlerEnum::MakerExecutiveMainnet
        | DaoHandlerEnum::MakerPollMainnet
        | DaoHandlerEnum::Snapshot => dao_handler.id.clone(),
        DaoHandlerEnum::AaveV3PolygonPos => {
            dao_handler::Entity::find()
                .filter(dao_handler::Column::HandlerType.eq(DaoHandlerEnum::AaveV3Mainnet))
                .one(db)
                .await
                .context("DB error")?
                .context("DAO not found")?
                .id
        }
        DaoHandlerEnum::AaveV3Avalanche => {
            dao_handler::Entity::find()
                .filter(dao_handler::Column::HandlerType.eq(DaoHandlerEnum::AaveV3Mainnet))
                .one(db)
                .await
                .context("DB error")?
                .context("DAO not found")?
                .id
        }
        DaoHandlerEnum::MakerPollArbitrum => {
            dao_handler::Entity::find()
                .filter(dao_handler::Column::HandlerType.eq(DaoHandlerEnum::MakerPollMainnet))
                .one(db)
                .await
                .context("DB error")?
                .context("DAO not found")?
                .id
        }
    };

    // Log before fetching proposals
    info!("Fetching proposals for handler_id: {}", proposal_handler_id);

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

    // Log the number of proposals fetched
    info!("Number of proposals fetched: {}", proposals.len());

    if proposals.len() != proposal_external_ids.len() {
        bail!(
            "One of these proposals was not found ${:?}",
            proposal_external_ids.clone()
        );
    }

    let proposal_map: HashMap<String, String> = proposals
        .clone()
        .into_iter()
        .map(|p| (p.external_id, p.id.clone().into()))
        .collect();

    let mut votes_to_process: Vec<vote::ActiveModel> = vec![];

    for vote in last_votes {
        if let Some(proposal_id) = proposal_map.get(&vote.proposal_external_id.clone().unwrap()) {
            let mut vote_clone = vote.clone();
            vote_clone.proposal_id = Set(Uuid::parse_str(proposal_id.clone().as_str()).unwrap());
            votes_to_process.push(vote_clone);
        }
    }

    let mut votes_to_insert = vec![];

    // Log before processing votes
    info!("Processing {} votes", votes_to_process.len());

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
                .context(format!(
                    "DB error: Failed to update vote for proposal_id: {}, voter_address: {}",
                    updated_vote.proposal_id.clone().unwrap(),
                    updated_vote.voter_address.clone().unwrap()
                ))?;

            updated_votes += 1;
        } else {
            votes_to_insert.push(vote);
            inserted_votes += 1;
        }
    }

    // Insert votes in batches to avoid exceeding parameter limit
    const BATCH_SIZE: usize = 1000;
    for chunk in votes_to_insert.chunks(BATCH_SIZE) {
        vote::Entity::insert_many(chunk.to_vec())
            .on_empty_do_nothing()
            .exec(db)
            .await
            .context("DB error")
            .context("store_dao_votes 5")?;
    }

    Ok(StoredVotes {
        inserted_votes,
        updated_votes,
    })
}

#[instrument(skip(db))]
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
                .context(format!(
                    "DB error: Failed to update vote for proposal_id: {}, voter_address: {}",
                    updated_vote.proposal_id.clone().unwrap(),
                    updated_vote.voter_address.clone().unwrap()
                ))?;

            updated_votes += 1;
        } else {
            votes_to_insert.push(vote);
            inserted_votes += 1;
        }
    }

    // Insert votes in batches to avoid exceeding parameter limit
    const BATCH_SIZE: usize = 1000;
    for chunk in votes_to_insert.chunks(BATCH_SIZE) {
        vote::Entity::insert_many(chunk.to_vec())
            .on_empty_do_nothing()
            .exec(db)
            .await
            .context("DB error")
            .context("store_proposal_votes 3")?;
    }

    Ok(StoredVotes {
        inserted_votes,
        updated_votes,
    })
}

#[instrument]
async fn get_dao_votes(dao_handler: &dao_handler::Model) -> Result<ChainVotesResult> {
    let votes = match dao_handler.handler_type {
        DaoHandlerEnum::Snapshot => todo!(),
        DaoHandlerEnum::AaveV2Mainnet => handlers::aave_v2::aave_v2_votes(dao_handler)
            .await
            .context("aave_v2_votes error")?,
        DaoHandlerEnum::AaveV3Mainnet => {
            handlers::aave_v3_mainnet::aave_v3_mainnet_votes(dao_handler)
                .await
                .context("aave_v3_mainnet_votes error")?
        }
        DaoHandlerEnum::AaveV3PolygonPos => {
            handlers::aave_v3_polygon::aave_v3_polygon_votes(dao_handler)
                .await
                .context("aave_v3_polygon_votes error")?
        }
        DaoHandlerEnum::AaveV3Avalanche => {
            handlers::aave_v3_avalanche::aave_v3_avalanche_votes(dao_handler)
                .await
                .context("aave_v3_avalanche_votes error")?
        }
        DaoHandlerEnum::CompoundMainnet => handlers::compound::compound_votes(dao_handler)
            .await
            .context("compound_votes error")?,
        DaoHandlerEnum::UniswapMainnet => handlers::uniswap::uniswap_votes(dao_handler)
            .await
            .context("uniswap_votes error")?,
        DaoHandlerEnum::EnsMainnet => handlers::ens::ens_votes(dao_handler)
            .await
            .context("ens_votes error")?,
        DaoHandlerEnum::GitcoinMainnet => handlers::gitcoin_v1::gitcoin_v1_votes(dao_handler)
            .await
            .context("gitcoin_v1_votes error")?,
        DaoHandlerEnum::GitcoinV2Mainnet => handlers::gitcoin_v2::gitcoin_v2_votes(dao_handler)
            .await
            .context("gitcoin_v2_votes error")?,
        DaoHandlerEnum::HopMainnet => handlers::hop::hop_votes(dao_handler)
            .await
            .context("hop_votes error")?,
        DaoHandlerEnum::DydxMainnet => handlers::dydx::dydx_votes(dao_handler)
            .await
            .context("dydx_votes error")?,
        DaoHandlerEnum::InterestProtocolMainnet => {
            handlers::interest_protocol::interest_protocol_votes(dao_handler)
                .await
                .context("interest_protocol_votes error")?
        }
        DaoHandlerEnum::ZeroxProtocolMainnet => {
            handlers::zerox_treasury::zerox_treasury_votes(dao_handler)
                .await
                .context("zerox_treasury_votes error")?
        }
        DaoHandlerEnum::FraxAlphaMainnet => handlers::frax_alpha::frax_alpha_votes(dao_handler)
            .await
            .context("frax_alpha_votes error")?,
        DaoHandlerEnum::FraxOmegaMainnet => handlers::frax_omega::frax_omega_votes(dao_handler)
            .await
            .context("frax_omega_votes error")?,
        DaoHandlerEnum::NounsProposalsMainnet => {
            handlers::nouns_proposals::nouns_proposals_votes(dao_handler)
                .await
                .context("nouns_proposals_votes error")?
        }
        DaoHandlerEnum::MakerExecutiveMainnet => {
            handlers::maker_executive::maker_executive_votes(dao_handler)
                .await
                .context("maker_executive_votes error")?
        }
        DaoHandlerEnum::MakerPollMainnet => handlers::maker_poll::maker_poll_votes(dao_handler)
            .await
            .context("maker_poll_votes error")?,
        DaoHandlerEnum::MakerPollArbitrum => {
            handlers::maker_poll_arbitrum::maker_poll_arbitrum_votes(dao_handler)
                .await
                .context("maker_poll_arbitrum_votes error")?
        }
        DaoHandlerEnum::OpOptimism => handlers::optimism::optimism_votes(dao_handler)
            .await
            .context("optimism_votes error")?,
        DaoHandlerEnum::ArbCoreArbitrum => {
            handlers::arbitrum_core::arbitrum_core_votes(dao_handler)
                .await
                .context("arbitrum_core_votes error")?
        }
        DaoHandlerEnum::ArbTreasuryArbitrum => {
            handlers::arbitrum_treasury::arbitrum_treasury_votes(dao_handler)
                .await
                .context("arbitrum_treasury_votes error")?
        }
    };

    Ok(votes)
}

#[instrument]
async fn get_proposal_votes(
    dao_handler: &dao_handler::Model,
    proposal: &proposal::Model,
) -> Result<ChainVotesResult> {
    let votes = match dao_handler.handler_type {
        DaoHandlerEnum::Snapshot => handlers::snapshot::snapshot_votes(dao_handler, proposal)
            .await
            .context("snapshot_votes error")?,
        DaoHandlerEnum::AaveV2Mainnet => todo!(),
        DaoHandlerEnum::AaveV3Mainnet => todo!(),
        DaoHandlerEnum::AaveV3PolygonPos => todo!(),
        DaoHandlerEnum::AaveV3Avalanche => todo!(),
        DaoHandlerEnum::CompoundMainnet => todo!(),
        DaoHandlerEnum::UniswapMainnet => todo!(),
        DaoHandlerEnum::EnsMainnet => todo!(),
        DaoHandlerEnum::GitcoinMainnet => todo!(),
        DaoHandlerEnum::GitcoinV2Mainnet => todo!(),
        DaoHandlerEnum::HopMainnet => todo!(),
        DaoHandlerEnum::DydxMainnet => todo!(),
        DaoHandlerEnum::InterestProtocolMainnet => todo!(),
        DaoHandlerEnum::ZeroxProtocolMainnet => todo!(),
        DaoHandlerEnum::FraxAlphaMainnet => todo!(),
        DaoHandlerEnum::FraxOmegaMainnet => todo!(),
        DaoHandlerEnum::NounsProposalsMainnet => todo!(),
        DaoHandlerEnum::MakerExecutiveMainnet => todo!(),
        DaoHandlerEnum::MakerPollMainnet => todo!(),
        DaoHandlerEnum::MakerPollArbitrum => todo!(),
        DaoHandlerEnum::OpOptimism => todo!(),
        DaoHandlerEnum::ArbCoreArbitrum => todo!(),
        DaoHandlerEnum::ArbTreasuryArbitrum => todo!(),
    };

    Ok(votes)
}
