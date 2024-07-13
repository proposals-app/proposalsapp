use amqprs::{
    channel::{
        BasicAckArguments, BasicConsumeArguments, BasicNackArguments, BasicQosArguments, Channel,
        QueueDeclareArguments,
    },
    connection::{Connection, OpenConnectionArguments},
    consumer::AsyncConsumer,
    BasicProperties, Deliver,
};
use anyhow::{bail, Context, Result};
use async_trait::async_trait;
use dotenv::dotenv;
use sea_orm::{
    prelude::Uuid,
    ActiveValue::{NotSet, Set},
    ColumnTrait, Condition, ConnectOptions, Database, DatabaseConnection, EntityTrait, QueryFilter,
    TransactionTrait,
};
use seaorm::{
    dao, dao_handler, proposal,
    sea_orm_active_enums::{DaoHandlerEnumV2, ProposalStateEnum},
    vote, voter,
};
use std::{
    cmp::Reverse,
    collections::{HashMap, HashSet},
};
use tokio::sync::Notify;
use tracing::{error, info, instrument, warn};
use utils::{
    errors::*,
    rabbitmq_callbacks::{AppChannelCallback, AppConnectionCallback},
    tracing::setup_tracing,
    types::{VotesJob, VotesResponse},
    warnings::*,
};
mod handlers;

pub struct VotesResult {
    votes: Vec<vote::ActiveModel>,
    to_index: Option<i32>,
}

#[async_trait]
pub trait VotesHandler: Send + Sync {
    async fn get_proposal_votes(
        &self,
        dao_handler: &dao_handler::Model,
        dao: &dao::Model,
        proposal: &proposal::Model,
    ) -> Result<VotesResult>;
    async fn get_dao_votes(&self, dao_handler: &dao_handler::Model) -> Result<VotesResult>;
    fn min_refresh_speed(&self) -> i32;
    fn max_refresh_speed(&self) -> i32;
}

const QUEUE_NAME: &str = "detective:votes";
const JOB_TIMEOUT_SECONDS: u64 = 60;

#[tokio::main]
#[instrument]
async fn main() -> Result<()> {
    dotenv().ok();
    setup_tracing();

    let rabbitmq_url = std::env::var("RABBITMQ_URL").context(RABBITMQ_URL_NOT_SET)?;
    let args: OpenConnectionArguments = rabbitmq_url
        .as_str()
        .try_into()
        .context(RABBITMQ_URL_INVALID)?;
    let connection = Connection::open(&args)
        .await
        .context(RABBITMQ_CONNECT_FAILED)?;

    connection
        .register_callback(AppConnectionCallback)
        .await
        .context(RABBITMQ_REGISTER_FAILED)?;

    let channel = connection
        .open_channel(None)
        .await
        .context(RABBITMQ_CHANNEL_OPEN_FAILED)?;
    channel
        .register_callback(AppChannelCallback)
        .await
        .context(RABBITMQ_REGISTER_FAILED)?;

    let queue = QueueDeclareArguments::durable_client_named(QUEUE_NAME);
    channel
        .queue_declare(queue)
        .await
        .context(RABBITMQ_DECLARE_QUEUE_FAILED)?;

    // 5 workers
    channel
        .basic_qos(BasicQosArguments::new(0, 5, false))
        .await
        .context(RABBITMQ_QOS_FAILED)?;

    channel
        .basic_consume(
            VotesConsumer::new(),
            BasicConsumeArguments::new(QUEUE_NAME, ""),
        )
        .await
        .context(RABBITMQ_START_CONSUMER_FAILED)?;

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
    #[instrument(skip_all, fields(delivery_tag = deliver.delivery_tag()))]
    async fn consume(
        &mut self,
        channel: &Channel,
        deliver: Deliver,
        _basic_properties: BasicProperties,
        content: Vec<u8>,
    ) {
        let job_str = match String::from_utf8(content) {
            Ok(s) => s,
            Err(e) => {
                error!(PARSE_JOB_FAILED, error = %e);
                return;
            }
        };

        let job: VotesJob = match serde_json::from_str(&job_str) {
            Ok(job) => job,
            Err(e) => {
                error!(DESERIALIZE_JOB_FAILED, error = %e);
                return;
            }
        };

        // Set a timeout for the job processing
        match tokio::time::timeout(
            tokio::time::Duration::from_secs(JOB_TIMEOUT_SECONDS),
            run(job.clone()),
        )
        .await
        {
            Ok(result) => match result {
                Ok(_) => {
                    if let Err(e) = increase_refresh_speed(job.clone()).await {
                        error!(INCREASE_REFRESH_SPEED_FAILED, error = %e);
                    }
                    if let Err(e) = channel
                        .basic_ack(BasicAckArguments::new(deliver.delivery_tag(), false))
                        .await
                    {
                        error!(JOB_ACK_FAILED, error = %e);
                    }
                }
                Err(e) => {
                    if let Err(err) = decrease_refresh_speed(job.clone()).await {
                        error!(DECREASE_REFRESH_SPEED_FAILED, error = %err);
                    }
                    if let Err(err) = channel
                        .basic_nack(BasicNackArguments::new(deliver.delivery_tag(), false, true))
                        .await
                    {
                        error!(JOB_NACK_FAILED, error = %err);
                    }
                    warn!(VOTES_JOB_FAILED, warning = %e);
                }
            },
            Err(_) => {
                // Timeout occurred
                if let Err(err) = decrease_refresh_speed(job.clone()).await {
                    error!(DECREASE_REFRESH_SPEED_FAILED, error = %err);
                }
                if let Err(err) = channel
                    .basic_nack(BasicNackArguments::new(deliver.delivery_tag(), false, true))
                    .await
                {
                    error!(JOB_NACK_FAILED, error = %err);
                }
                warn!(VOTES_JOB_TIMEOUT);
            }
        };
    }
}

#[instrument]
async fn run(job: VotesJob) -> Result<()> {
    let database_url = std::env::var("DATABASE_URL").context(DATABASE_URL_NOT_SET)?;

    let mut opt = ConnectOptions::new(database_url);
    opt.sqlx_logging(false);

    let db: DatabaseConnection = Database::connect(opt)
        .await
        .context(DATABASE_CONNECTION_FAILED)?;

    let dao_handler = dao_handler::Entity::find()
        .filter(dao_handler::Column::Id.eq(job.dao_handler_id))
        .one(&db)
        .await
        .context(DATABASE_ERROR)?
        .context(DAOHANDLER_NOT_FOUND_ERROR)?;

    let handler = handlers::get_handler(&dao_handler.handler_type);

    match job.proposal_id {
        Some(proposal_id) => {
            let dao = dao::Entity::find()
                .filter(dao::Column::Id.eq(dao_handler.dao_id))
                .one(&db)
                .await
                .context(DATABASE_ERROR)?
                .context(DAOHANDLER_NOT_FOUND_ERROR)?;

            let proposal = proposal::Entity::find()
                .filter(proposal::Column::Id.eq(proposal_id))
                .one(&db)
                .await
                .context(DATABASE_ERROR)?
                .context(PROPOSAL_NOT_FOUND_ERROR)?;

            let VotesResult { votes, to_index: _ } = handler
                .get_proposal_votes(&dao_handler, &dao, &proposal)
                .await?;

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
                dao_handler_id: dao_handler.id,
                proposal_id: Some(proposal.id),
            };

            info!("{:?}", response);
            Ok(())
        }
        None => {
            let VotesResult { votes, to_index } = handler.get_dao_votes(&dao_handler).await?;

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

#[instrument]
async fn decrease_refresh_speed(job: VotesJob) -> Result<()> {
    let database_url = std::env::var("DATABASE_URL").context(DATABASE_URL_NOT_SET)?;

    let mut opt = ConnectOptions::new(database_url);
    opt.sqlx_logging(false);

    let db: DatabaseConnection = Database::connect(opt)
        .await
        .context(DATABASE_CONNECTION_FAILED)?;

    let dao_handler = dao_handler::Entity::find()
        .filter(dao_handler::Column::Id.eq(job.dao_handler_id))
        .one(&db)
        .await
        .context(DATABASE_ERROR)?
        .context(DAOHANDLER_NOT_FOUND_ERROR)?;

    let handler = handlers::get_handler(&dao_handler.handler_type);

    match job.proposal_id {
        Some(proposal_id) => {
            let proposal = proposal::Entity::find()
                .filter(proposal::Column::Id.eq(proposal_id))
                .one(&db)
                .await
                .context(DATABASE_ERROR)?
                .context(PROPOSAL_NOT_FOUND_ERROR)?;

            let mut new_refresh_speed = (proposal.votes_refresh_speed as f32 * 0.5) as i32;

            if new_refresh_speed < handler.min_refresh_speed() {
                new_refresh_speed = handler.min_refresh_speed();
            }

            proposal::Entity::update(proposal::ActiveModel {
                id: Set(proposal.id),
                votes_refresh_speed: Set(new_refresh_speed),
                ..Default::default()
            })
            .exec(&db)
            .await
            .context(DATABASE_ERROR)?;

            Ok(())
        }
        None => {
            let mut new_refresh_speed = (dao_handler.votes_refresh_speed as f32 * 0.5) as i32;

            if new_refresh_speed < handler.min_refresh_speed() {
                new_refresh_speed = handler.min_refresh_speed();
            }

            dao_handler::Entity::update(dao_handler::ActiveModel {
                id: Set(dao_handler.id),
                votes_refresh_speed: Set(new_refresh_speed),
                ..Default::default()
            })
            .exec(&db)
            .await
            .context(DATABASE_ERROR)?;

            Ok(())
        }
    }
}

#[instrument]
async fn increase_refresh_speed(job: VotesJob) -> Result<()> {
    let database_url = std::env::var("DATABASE_URL").context(DATABASE_URL_NOT_SET)?;

    let mut opt = ConnectOptions::new(database_url);
    opt.sqlx_logging(false);

    let db: DatabaseConnection = Database::connect(opt)
        .await
        .context(DATABASE_CONNECTION_FAILED)?;

    let dao_handler = dao_handler::Entity::find()
        .filter(dao_handler::Column::Id.eq(job.dao_handler_id))
        .one(&db)
        .await
        .context(DATABASE_ERROR)?
        .context(DAOHANDLER_NOT_FOUND_ERROR)?;

    let handler = handlers::get_handler(&dao_handler.handler_type);

    match job.proposal_id {
        Some(proposal_id) => {
            let proposal = proposal::Entity::find()
                .filter(proposal::Column::Id.eq(proposal_id))
                .one(&db)
                .await
                .context(DATABASE_ERROR)?
                .context(PROPOSAL_NOT_FOUND_ERROR)?;

            let mut new_refresh_speed = (proposal.votes_refresh_speed as f32 * 1.2) as i32;

            if new_refresh_speed > handler.max_refresh_speed() {
                new_refresh_speed = handler.max_refresh_speed();
            }

            proposal::Entity::update(proposal::ActiveModel {
                id: Set(proposal.id),
                votes_refresh_speed: Set(new_refresh_speed),
                ..Default::default()
            })
            .exec(&db)
            .await
            .context(DATABASE_ERROR)?;

            Ok(())
        }
        None => {
            let mut new_refresh_speed = (dao_handler.votes_refresh_speed as f32 * 1.2) as i32;

            if new_refresh_speed > handler.max_refresh_speed() {
                new_refresh_speed = handler.max_refresh_speed();
            }

            dao_handler::Entity::update(dao_handler::ActiveModel {
                id: Set(dao_handler.id),
                votes_refresh_speed: Set(new_refresh_speed),
                ..Default::default()
            })
            .exec(&db)
            .await
            .context(DATABASE_ERROR)?;

            Ok(())
        }
    }
}

#[instrument(skip(parsed_votes, db))]
async fn store_voters(parsed_votes: &[vote::ActiveModel], db: &DatabaseConnection) -> Result<()> {
    let voters = parsed_votes
        .iter()
        .map(|v| v.voter_address.clone().take().unwrap())
        .collect::<HashSet<String>>();

    let txn = db.begin().await.context(DB_TRANSACTION_BEGIN_FAILED)?;

    let existing_voters = voter::Entity::find()
        .filter(voter::Column::Address.is_in(voters.clone()))
        .all(&txn)
        .await
        .context(DATABASE_ERROR)?;

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
            .context(DATABASE_ERROR)?;
    }

    txn.commit().await.context(DB_TRANSACTION_COMMIT_FAILED)?;

    Ok(())
}

#[instrument(skip(parsed_votes, db))]
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

    if dao_handler.handler_type != DaoHandlerEnumV2::Snapshot {
        new_index = to_index.unwrap_or(dao_handler.votes_index + dao_handler.votes_refresh_speed);
    }

    if new_index > dao_handler.proposals_index
        && dao_handler.handler_type != DaoHandlerEnumV2::MakerPollArbitrum
        && dao_handler.handler_type != DaoHandlerEnumV2::AaveV3PolygonPos
        && dao_handler.handler_type != DaoHandlerEnumV2::AaveV3Avalanche
    {
        new_index = dao_handler.proposals_index;
    }

    dao_handler::Entity::update(dao_handler::ActiveModel {
        id: Set(dao_handler.id),
        votes_index: Set(new_index),
        ..Default::default()
    })
    .exec(db)
    .await
    .context(DATABASE_ERROR)?;

    Ok(new_index)
}

#[instrument(skip(parsed_votes, db))]
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
        id: Set(proposal.id),
        votes_index: Set(*new_index),
        votes_fetched: Set(fetched_votes),
        ..Default::default()
    })
    .exec(db)
    .await
    .context(DATABASE_ERROR)?;

    Ok(*new_index)
}

struct StoredVotes {
    inserted_votes: u32,
    updated_votes: u32,
}

#[instrument(skip(parsed_votes, db))]
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
        DaoHandlerEnumV2::AaveV2Mainnet
        | DaoHandlerEnumV2::AaveV3Mainnet
        | DaoHandlerEnumV2::CompoundMainnet
        | DaoHandlerEnumV2::UniswapMainnet
        | DaoHandlerEnumV2::EnsMainnet
        | DaoHandlerEnumV2::GitcoinMainnet
        | DaoHandlerEnumV2::GitcoinV2Mainnet
        | DaoHandlerEnumV2::HopMainnet
        | DaoHandlerEnumV2::DydxMainnet
        | DaoHandlerEnumV2::FraxAlphaMainnet
        | DaoHandlerEnumV2::FraxOmegaMainnet
        | DaoHandlerEnumV2::NounsProposalsMainnet
        | DaoHandlerEnumV2::OpOptimism
        | DaoHandlerEnumV2::ArbCoreArbitrum
        | DaoHandlerEnumV2::ArbTreasuryArbitrum
        | DaoHandlerEnumV2::MakerExecutiveMainnet
        | DaoHandlerEnumV2::MakerPollMainnet
        | DaoHandlerEnumV2::Snapshot => dao_handler.id,
        DaoHandlerEnumV2::AaveV3PolygonPos => {
            dao_handler::Entity::find()
                .filter(dao_handler::Column::HandlerType.eq(DaoHandlerEnumV2::AaveV3Mainnet))
                .one(db)
                .await
                .context(DATABASE_ERROR)?
                .context(DAOHANDLER_NOT_FOUND_ERROR)?
                .id
        }
        DaoHandlerEnumV2::AaveV3Avalanche => {
            dao_handler::Entity::find()
                .filter(dao_handler::Column::HandlerType.eq(DaoHandlerEnumV2::AaveV3Mainnet))
                .one(db)
                .await
                .context(DATABASE_ERROR)?
                .context(DAOHANDLER_NOT_FOUND_ERROR)?
                .id
        }
        DaoHandlerEnumV2::MakerPollArbitrum => {
            dao_handler::Entity::find()
                .filter(dao_handler::Column::HandlerType.eq(DaoHandlerEnumV2::MakerPollMainnet))
                .one(db)
                .await
                .context(DATABASE_ERROR)?
                .context(DAOHANDLER_NOT_FOUND_ERROR)?
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
        .context(DATABASE_ERROR)?;

    if proposals.len() != proposal_external_ids.len() {
        bail!(
            "One of these proposals was not found ${:?}",
            proposal_external_ids.clone()
        );
    }

    let proposal_map: HashMap<String, String> = proposals
        .clone()
        .into_iter()
        .map(|p| (p.external_id, p.id.into()))
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

    for vote in votes_to_process.clone() {
        let existing_vote = vote::Entity::find()
            .filter(
                Condition::all()
                    .add(vote::Column::ProposalId.eq(vote.proposal_id.clone().take().unwrap()))
                    .add(vote::Column::VoterAddress.eq(vote.voter_address.clone().take().unwrap())),
            )
            .one(db)
            .await
            .context(DATABASE_ERROR)?;

        if let Some(existing) = existing_vote {
            let mut updated_vote = vote.clone();
            updated_vote.id = Set(existing.id);

            vote::Entity::update(updated_vote.clone())
                .exec(db)
                .await
                .context(DATABASE_ERROR)?;

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
            .context(DATABASE_ERROR)?;
    }

    Ok(StoredVotes {
        inserted_votes,
        updated_votes,
    })
}

#[instrument(skip(parsed_votes, db))]
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
            .context(DATABASE_ERROR)?;

        if existing_vote.is_some() {
            let mut updated_vote = vote.clone();
            updated_vote.id = Set(existing_vote.unwrap().id);

            vote::Entity::update(updated_vote.clone())
                .exec(db)
                .await
                .context(DATABASE_ERROR)?;

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
            .context(DATABASE_ERROR)?;
    }

    Ok(StoredVotes {
        inserted_votes,
        updated_votes,
    })
}
