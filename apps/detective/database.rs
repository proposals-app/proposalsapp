use crate::indexers::{aave_v2_mainnet_votes::AaveV2MainnetVotesIndexer, aave_v3_avalanche_votes::AaveV3AvalancheVotesIndexer, aave_v3_mainnet_votes::AaveV3MainnetVotesIndexer, aave_v3_polygon_votes::AaveV3PolygonVotesIndexer, arbitrum_core_votes::ArbitrumCoreVotesIndexer, arbitrum_treasury_votes::ArbitrumTreasuryVotesIndexer, compound_mainnet_votes::CompoundMainnetVotesIndexer, dydx_mainnet_votes::DydxMainnetVotesIndexer, ens_vote_indexer::EnsMainnetVotesIndexer, frax_alpha_mainnet_votes::FraxAlphaMainnetVotesIndexer, frax_omega_mainnet_votes::FraxOmegaMainnetVotesIndexer, gitcoin_v1_mainnet_votes::GitcoinV1MainnetVotesIndexer, gitcoin_v2_mainnet_votes::GitcoinV2MainnetVotesIndexer, hop_mainnet_votes::HopMainnetVotesIndexer, maker_executive_mainnet_votes::MakerExecutiveMainnetVotesIndexer, maker_poll_arbitrum_votes::MakerPollArbitrumVotesIndexer, maker_poll_mainnet_votes::MakerPollMainnetVotesIndexer, nouns_mainnet_votes::NounsMainnetVotesIndexer, optimism_votes::OptimismVotesIndexer, snapshot_votes::SnapshotVotesIndexer, uniswap_mainnet_votes::UniswapMainnetVotesIndexer};
use anyhow::{Context, Result};
use once_cell::sync::OnceCell;
use proposalsapp_db::models::{dao, dao_indexer, delegation, job_queue, proposal, sea_orm_active_enums::IndexerVariant, vote, voter, voting_power};
use sea_orm::{prelude::Uuid, ActiveValue::NotSet, ColumnTrait, Condition, DatabaseConnection, DatabaseTransaction, EntityTrait, QueryFilter, Set, TransactionTrait};
use std::{
    collections::{HashMap, HashSet},
    time::Duration,
};
use tracing::instrument;
use utils::types::{JobData, ProposalJobData};

pub static DB: OnceCell<DatabaseConnection> = OnceCell::new();

pub async fn initialize_db() -> Result<()> {
    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL environment variable not set")?;

    let mut opt = sea_orm::ConnectOptions::new(database_url);
    opt.max_connections(10)
        .min_connections(5)
        .connect_timeout(Duration::from_secs(8))
        .acquire_timeout(Duration::from_secs(8))
        .idle_timeout(Duration::from_secs(8))
        .max_lifetime(Duration::from_secs(8))
        .sqlx_logging(false);

    let db = sea_orm::Database::connect(opt)
        .await
        .context("Failed to connect to the database")?;

    DB.set(db)
        .map_err(|_| anyhow::anyhow!("Failed to set database connection"))
}

#[instrument]
pub async fn store_proposals(indexer: &dao_indexer::Model, proposals: Vec<proposal::ActiveModel>) -> Result<()> {
    let txn = DB.get().unwrap().begin().await?;

    let external_ids: Vec<String> = proposals
        .iter()
        .map(|p| p.external_id.clone().unwrap())
        .collect();

    let existing_proposals: HashMap<String, proposal::Model> = proposal::Entity::find()
        .filter(
            Condition::all()
                .add(proposal::Column::ExternalId.is_in(external_ids.clone()))
                .add(proposal::Column::DaoIndexerId.eq(indexer.id)),
        )
        .all(&txn)
        .await?
        .into_iter()
        .map(|p| (p.external_id.clone(), p))
        .collect();

    let (to_insert, to_update): (Vec<_>, Vec<_>) = proposals
        .into_iter()
        .partition(|p| !existing_proposals.contains_key(&p.external_id.clone().unwrap()));

    // Batch insert new proposals
    if !to_insert.is_empty() {
        for proposal in to_insert {
            let result = proposal::Entity::insert(proposal.clone())
                .exec(&txn)
                .await?;

            if indexer.indexer_variant == IndexerVariant::SnapshotProposals && proposal.discussion_url.is_set() {
                let job_data = ProposalJobData {
                    proposal_id: result.last_insert_id,
                };

                job_queue::Entity::insert(job_queue::ActiveModel {
                    id: NotSet,
                    r#type: Set(ProposalJobData::job_type().to_string()),
                    data: Set(serde_json::to_value(job_data)?),
                    status: Set("PENDING".into()),
                    created_at: NotSet,
                })
                .exec(&txn)
                .await?;
            }
        }
    }

    // Batch update
    for mut p in to_update {
        let existing = existing_proposals
            .get(&p.external_id.clone().unwrap())
            .unwrap();
        p.id = Set(existing.id);
        proposal::Entity::update(p).exec(&txn).await?;
    }

    txn.commit().await?;
    Ok(())
}

#[instrument]
pub async fn store_votes(indexer: &dao_indexer::Model, votes: Vec<vote::ActiveModel>) -> Result<()> {
    if votes.is_empty() {
        return Ok(());
    }

    let txn = DB.get().unwrap().begin().await?;

    let proposal_external_ids: Vec<String> = votes
        .iter()
        .map(|v| v.proposal_external_id.clone().unwrap())
        .collect();

    // Fetch the corresponding proposal indexer variant
    let proposal_indexer_variant = match indexer.indexer_variant {
        IndexerVariant::AaveV2MainnetVotes => AaveV2MainnetVotesIndexer::proposal_indexer_variant(),
        IndexerVariant::AaveV3MainnetVotes => AaveV3MainnetVotesIndexer::proposal_indexer_variant(),
        IndexerVariant::AaveV3PolygonVotes => AaveV3PolygonVotesIndexer::proposal_indexer_variant(),
        IndexerVariant::AaveV3AvalancheVotes => AaveV3AvalancheVotesIndexer::proposal_indexer_variant(),
        IndexerVariant::ArbCoreArbitrumVotes => ArbitrumCoreVotesIndexer::proposal_indexer_variant(),
        IndexerVariant::ArbTreasuryArbitrumVotes => ArbitrumTreasuryVotesIndexer::proposal_indexer_variant(),
        IndexerVariant::CompoundMainnetVotes => CompoundMainnetVotesIndexer::proposal_indexer_variant(),
        IndexerVariant::DydxMainnetVotes => DydxMainnetVotesIndexer::proposal_indexer_variant(),
        IndexerVariant::EnsMainnetVotes => EnsMainnetVotesIndexer::proposal_indexer_variant(),
        IndexerVariant::FraxAlphaMainnetVotes => FraxAlphaMainnetVotesIndexer::proposal_indexer_variant(),
        IndexerVariant::FraxOmegaMainnetVotes => FraxOmegaMainnetVotesIndexer::proposal_indexer_variant(),
        IndexerVariant::GitcoinMainnetVotes => GitcoinV1MainnetVotesIndexer::proposal_indexer_variant(),
        IndexerVariant::GitcoinV2MainnetVotes => GitcoinV2MainnetVotesIndexer::proposal_indexer_variant(),
        IndexerVariant::HopMainnetVotes => HopMainnetVotesIndexer::proposal_indexer_variant(),
        IndexerVariant::MakerExecutiveMainnetVotes => MakerExecutiveMainnetVotesIndexer::proposal_indexer_variant(),
        IndexerVariant::MakerPollMainnetVotes => MakerPollMainnetVotesIndexer::proposal_indexer_variant(),
        IndexerVariant::MakerPollArbitrumVotes => MakerPollArbitrumVotesIndexer::proposal_indexer_variant(),
        IndexerVariant::NounsProposalsMainnetVotes => NounsMainnetVotesIndexer::proposal_indexer_variant(),
        IndexerVariant::OpOptimismVotes => OptimismVotesIndexer::proposal_indexer_variant(),
        IndexerVariant::UniswapMainnetVotes => UniswapMainnetVotesIndexer::proposal_indexer_variant(),

        IndexerVariant::SnapshotVotes => SnapshotVotesIndexer::proposal_indexer_variant(),
        IndexerVariant::ArbitrumCouncilNominations => IndexerVariant::ArbitrumCouncilNominations,
        IndexerVariant::ArbitrumCouncilElections => IndexerVariant::ArbitrumCouncilElections,
        // Add other matches as needed
        _ => return Err(anyhow::anyhow!("Unsupported votes indexer variant")),
    };

    // Fetch all proposals for this DAO with matching external IDs and the
    // corresponding indexer variant
    let proposals: Vec<proposal::Model> = proposal::Entity::find()
        .filter(proposal::Column::ExternalId.is_in(proposal_external_ids.clone()))
        .filter(proposal::Column::DaoId.eq(indexer.dao_id))
        .inner_join(dao_indexer::Entity)
        .filter(dao_indexer::Column::IndexerVariant.eq(proposal_indexer_variant))
        .all(&txn)
        .await?;

    let proposal_id_map: HashMap<String, Uuid> = proposals
        .into_iter()
        .map(|p| (p.external_id, p.id))
        .collect();

    let mut votes_to_insert: HashMap<(Uuid, String), vote::ActiveModel> = HashMap::new();
    let mut missing_proposals = Vec::new();
    let mut voter_addresses: HashSet<String> = HashSet::new();

    for vote in votes {
        if let Some(&proposal_id) = proposal_id_map.get(&vote.proposal_external_id.clone().unwrap()) {
            let key = (proposal_id, vote.voter_address.clone().unwrap());
            votes_to_insert.entry(key).or_insert_with(|| {
                let mut v = vote.clone();
                v.proposal_id = Set(proposal_id);
                v
            });
            voter_addresses.insert(vote.voter_address.clone().unwrap());
        } else {
            missing_proposals.push(vote.proposal_external_id.clone().unwrap());
        }
    }

    if !missing_proposals.is_empty() {
        return Err(anyhow::anyhow!(
            "Some proposals were not found: {:?}",
            missing_proposals
        ));
    }

    ensure_voters_exist(&txn, voter_addresses).await?;

    // Insert votes in batches
    const BATCH_SIZE: usize = 1000; // Adjust this value based on your database performance
    for chunk in votes_to_insert
        .into_values()
        .collect::<Vec<_>>()
        .chunks(BATCH_SIZE)
    {
        vote::Entity::insert_many(chunk.to_vec())
            .on_conflict(
                sea_orm::sea_query::OnConflict::columns([vote::Column::ProposalId, vote::Column::VoterAddress])
                    .update_columns([
                        vote::Column::Choice,
                        vote::Column::VotingPower,
                        vote::Column::Reason,
                        vote::Column::CreatedAt,
                        vote::Column::BlockCreated,
                        vote::Column::Txid,
                    ])
                    .to_owned(),
            )
            .exec(&txn)
            .await?;
    }

    txn.commit().await?;

    Ok(())
}

#[instrument(skip(txn, voter_addresses))]
async fn ensure_voters_exist(txn: &DatabaseTransaction, voter_addresses: HashSet<String>) -> Result<()> {
    const BATCH_SIZE: usize = 1000; // Adjust based on database performance

    for addresses_chunk in voter_addresses
        .into_iter()
        .collect::<Vec<_>>()
        .chunks(BATCH_SIZE)
    {
        let existing_voters: HashSet<String> = voter::Entity::find()
            .filter(voter::Column::Address.is_in(addresses_chunk.to_vec()))
            .all(txn)
            .await?
            .into_iter()
            .map(|v| v.address)
            .collect();

        let new_voters: Vec<voter::ActiveModel> = addresses_chunk
            .iter()
            .filter(|&address| !existing_voters.contains(address))
            .map(|address| voter::ActiveModel {
                id: NotSet,
                address: Set(address.clone()),
                ens: NotSet,
            })
            .collect();

        if !new_voters.is_empty() {
            voter::Entity::insert_many(new_voters).exec(txn).await?;
        }
    }

    Ok(())
}

#[instrument]
pub async fn store_voting_powers(voting_powers: Vec<voting_power::ActiveModel>) -> Result<()> {
    if voting_powers.is_empty() {
        return Ok(());
    }

    let txn = DB.get().unwrap().begin().await?;

    // Insert or update voting powers
    const BATCH_SIZE: usize = 1000;
    for chunk in voting_powers.chunks(BATCH_SIZE) {
        voting_power::Entity::insert_many(chunk.to_vec())
            .exec(&txn)
            .await?;
    }

    txn.commit().await?;
    Ok(())
}

#[instrument]
pub async fn store_delegations(delegations: Vec<delegation::ActiveModel>) -> Result<()> {
    if delegations.is_empty() {
        return Ok(());
    }

    let txn = DB.get().unwrap().begin().await?;

    // Insert or update delegations
    const BATCH_SIZE: usize = 1000;
    for chunk in delegations.chunks(BATCH_SIZE) {
        delegation::Entity::insert_many(chunk.to_vec())
            .exec(&txn)
            .await?;
    }

    txn.commit().await?;
    Ok(())
}

#[instrument]
pub async fn update_indexer_speed_and_index(indexer: &dao_indexer::Model, new_speed: i32, new_index: i32) -> Result<()> {
    dao_indexer::Entity::update(dao_indexer::ActiveModel {
        id: Set(indexer.id),
        speed: Set(new_speed),
        index: Set(new_index),
        ..Default::default()
    })
    .exec(DB.get().unwrap())
    .await?;
    Ok(())
}

#[instrument]
pub async fn update_indexer_speed(indexer: &dao_indexer::Model, new_speed: i32) -> Result<()> {
    dao_indexer::Entity::update(dao_indexer::ActiveModel {
        id: Set(indexer.id),
        speed: Set(new_speed),
        ..Default::default()
    })
    .exec(DB.get().unwrap())
    .await?;

    Ok(())
}

#[instrument]
pub async fn update_indexer_updated_at(indexer: &dao_indexer::Model) -> Result<()> {
    dao_indexer::Entity::update(dao_indexer::ActiveModel {
        id: Set(indexer.id),
        updated_at: Set(chrono::Utc::now().naive_utc()),
        ..Default::default()
    })
    .exec(DB.get().unwrap())
    .await?;

    Ok(())
}

pub async fn fetch_dao_indexers() -> Result<Vec<(dao_indexer::Model, dao::Model)>> {
    Ok(dao_indexer::Entity::find()
        .find_also_related(dao::Entity)
        .filter(dao_indexer::Column::Enabled.eq(true))
        .all(DB.get().unwrap())
        .await
        .context("Failed to fetch indexers with daos")?
        .into_iter()
        .filter_map(|(indexer, dao)| dao.map(|d| (indexer, d)))
        .collect())
}
