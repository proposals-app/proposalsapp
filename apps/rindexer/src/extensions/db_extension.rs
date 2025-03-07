use crate::rindexer_lib::typings::networks::get_ethereum_provider_cache;
use anyhow::{Context, Result};
use ethers::{
    providers::{Middleware, ProviderError},
    types::Address,
};
use once_cell::sync::OnceCell;
use proposalsapp_db_indexer::models::{dao, dao_governor, delegation, job_queue, proposal, vote, voter, voting_power};
use sea_orm::{ActiveValue::NotSet, ColumnTrait, Condition, DatabaseConnection, DatabaseTransaction, EntityTrait, InsertResult, QueryFilter, Set, TransactionTrait, prelude::Uuid, sea_query::OnConflict};
use std::{
    collections::{HashMap, HashSet},
    sync::Mutex,
    time::Duration,
};
use tracing::{debug, instrument};
use utils::types::{JobData, ProposalJobData};

pub static DB: OnceCell<DatabaseConnection> = OnceCell::new();
pub static DAO_GOVERNOR_ID_MAP: OnceCell<Mutex<HashMap<String, Uuid>>> = OnceCell::new();
pub static DAO_ID_SLUG_MAP: OnceCell<Mutex<HashMap<String, Uuid>>> = OnceCell::new();

#[instrument]
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
        .map_err(|_| anyhow::anyhow!("Failed to set database connection"))?;

    // Initialize and populate DAO_INDEXER_ID_MAP
    let governors_map = Mutex::new(HashMap::new());
    let governors = dao_governor::Entity::find()
        .all(
            DB.get()
                .ok_or_else(|| anyhow::anyhow!("DB not initialized"))?,
        )
        .await?;
    for governor in governors {
        governors_map
            .lock()
            .unwrap()
            .insert(governor.r#type, governor.id);
    }
    DAO_GOVERNOR_ID_MAP
        .set(governors_map)
        .map_err(|_| anyhow::anyhow!("Failed to set DAO_GOVERNOR_ID_MAP"))?;

    // Initialize and populate DAO_ID_SLUG_MAP
    let dao_slug_map = Mutex::new(HashMap::new());
    let daos = dao::Entity::find()
        .all(
            DB.get()
                .ok_or_else(|| anyhow::anyhow!("DB not initialized"))?,
        )
        .await?;
    for dao_model in daos {
        dao_slug_map
            .lock()
            .unwrap()
            .insert(dao_model.slug, dao_model.id);
    }
    DAO_ID_SLUG_MAP
        .set(dao_slug_map)
        .map_err(|_| anyhow::anyhow!("Failed to set DAO_ID_SLUG_MAP"))?;

    Ok(())
}

#[instrument(skip(proposal))]
pub async fn store_proposal(proposal: proposal::ActiveModel) -> Result<()> {
    let db = DB
        .get()
        .ok_or_else(|| anyhow::anyhow!("DB not initialized"))?;
    let txn = db.begin().await?;

    // Extract indexer ID and external ID from the proposal
    let governor_id = proposal
        .governor_id
        .clone()
        .take()
        .ok_or_else(|| anyhow::anyhow!("Missing governor_id in proposal"))?;
    let external_id = proposal
        .external_id
        .clone()
        .take()
        .ok_or_else(|| anyhow::anyhow!("Missing external_id in proposal"))?;

    let existing_proposal = proposal::Entity::find()
        .filter(
            Condition::all()
                .add(proposal::Column::ExternalId.eq(external_id.clone()))
                .add(proposal::Column::GovernorId.eq(governor_id)),
        )
        .one(&txn)
        .await?;

    if let Some(existing) = existing_proposal {
        // Update existing proposal
        let active_model = proposal::ActiveModel {
            id: Set(existing.id),
            external_id: Set(proposal
                .external_id
                .clone()
                .take()
                .unwrap_or(existing.external_id.clone())),
            name: Set(proposal
                .name
                .clone()
                .take()
                .unwrap_or(existing.name.clone())),
            body: Set(proposal
                .body
                .clone()
                .take()
                .unwrap_or(existing.body.clone())),
            url: Set(proposal.url.clone().take().unwrap_or(existing.url.clone())),
            discussion_url: Set(proposal
                .discussion_url
                .clone()
                .take()
                .unwrap_or(existing.discussion_url.clone())),
            choices: Set(proposal
                .choices
                .clone()
                .take()
                .unwrap_or(existing.choices.clone())),
            quorum: Set(proposal.quorum.clone().take().unwrap_or(existing.quorum)),
            proposal_state: Set(proposal
                .proposal_state
                .clone()
                .take()
                .unwrap_or(existing.proposal_state.clone())),
            marked_spam: Set(proposal
                .marked_spam
                .clone()
                .take()
                .unwrap_or(existing.marked_spam)),
            created_at: Set(proposal
                .created_at
                .clone()
                .take()
                .unwrap_or(existing.created_at)),
            start_at: Set(proposal
                .start_at
                .clone()
                .take()
                .unwrap_or(existing.start_at)),
            end_at: Set(proposal.end_at.clone().take().unwrap_or(existing.end_at)),
            block_created_at: Set(proposal
                .block_created_at
                .clone()
                .take()
                .unwrap_or(existing.block_created_at)),
            txid: Set(proposal
                .txid
                .clone()
                .take()
                .unwrap_or(existing.txid.clone())),
            metadata: Set(proposal
                .metadata
                .clone()
                .take()
                .unwrap_or(existing.metadata.clone())),
            dao_id: Set(proposal.dao_id.clone().take().unwrap_or(existing.dao_id)),
            author: Set(proposal
                .author
                .clone()
                .take()
                .unwrap_or(existing.author.clone())),
            governor_id: Set(proposal
                .governor_id
                .clone()
                .take()
                .unwrap_or(existing.governor_id)),
        };

        proposal::Entity::update(active_model).exec(&txn).await?;
    } else {
        // Insert new proposal
        let inserted_proposal = proposal::Entity::insert(proposal.clone())
            .exec(&txn)
            .await?;

        // Fetch governor to check its type
        let governor_id_to_find = proposal
            .governor_id
            .clone()
            .take()
            .ok_or_else(|| anyhow::anyhow!("Missing governor_id for governor lookup"))?;
        let governor = dao_governor::Entity::find()
            .filter(dao_governor::Column::Id.eq(governor_id_to_find))
            .one(&txn)
            .await?;
        let governor_model = governor.ok_or_else(|| anyhow::anyhow!("Governor not found with id: {}", governor_id_to_find))?;

        if governor_model.r#type == "SNAPSHOT" && proposal.discussion_url.is_set() {
            let job_data = ProposalJobData {
                proposal_id: inserted_proposal.last_insert_id,
            };

            // Enqueue job to fetch snapshot discussion details
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

    txn.commit().await?;
    Ok(())
}

#[instrument(skip(votes))]
pub async fn store_votes(votes: Vec<vote::ActiveModel>, governor_id: Uuid) -> Result<()> {
    let db = DB
        .get()
        .ok_or_else(|| anyhow::anyhow!("DB not initialized"))?;
    let txn = db.begin().await?;

    let proposal_external_ids: Vec<String> = votes
        .iter()
        .filter_map(|vote| vote.proposal_external_id.clone().take())
        .collect();

    if proposal_external_ids.is_empty() {
        txn.rollback().await?;
        return Err(anyhow::anyhow!(
            "No proposal_external_ids provided in votes"
        ));
    }

    let proposals_result = proposal::Entity::find()
        .filter(proposal::Column::ExternalId.is_in(proposal_external_ids.clone()))
        .filter(proposal::Column::GovernorId.eq(governor_id))
        .all(&txn)
        .await?;

    let proposal_map: HashMap<String, proposal::Model> = proposals_result
        .into_iter()
        .filter_map(|p| Some((p.external_id.clone(), p.clone())))
        .collect();

    let voter_addresses: Vec<String> = votes
        .iter()
        .filter_map(|vote| vote.voter_address.clone().take())
        .collect();

    if voter_addresses.is_empty() {
        txn.rollback().await?;
        return Err(anyhow::anyhow!("No voter_addresses provided in votes"));
    }

    let voter_address_set: HashSet<String> = voter_addresses.into_iter().collect();
    store_voters(&txn, voter_address_set).await?;

    let mut vote_active_models = Vec::new();
    for vote in votes {
        let proposal_external_id = vote
            .proposal_external_id
            .clone()
            .take()
            .ok_or_else(|| anyhow::anyhow!("Missing proposal_external_id in vote"))?;
        let proposal_model = proposal_map.get(&proposal_external_id).ok_or_else(|| {
            anyhow::anyhow!(
                "No proposal found for external_id: {}",
                proposal_external_id
            )
        })?;

        let vote_active_model = vote::ActiveModel {
            voter_address: vote.voter_address.clone(),
            choice: vote.choice.clone(),
            voting_power: vote.voting_power.clone(),
            reason: vote.reason.clone(),
            created_at: vote.created_at.clone(),
            block_created_at: vote.block_created_at.clone(),
            txid: vote.txid.clone(),
            proposal_external_id: vote.proposal_external_id.clone(),
            dao_id: vote.dao_id.clone(),
            governor_id: vote.governor_id.clone(),
            proposal_id: Set(proposal_model.id),
            id: NotSet,
        };
        vote_active_models.push(vote_active_model);
    }

    for chunk in vote_active_models.chunks(100) {
        let result: Result<InsertResult<vote::ActiveModel>, sea_orm::DbErr> = vote::Entity::insert_many(chunk.to_vec())
            .on_conflict(
                OnConflict::columns([
                    vote::Column::ProposalId,
                    vote::Column::VoterAddress,
                    vote::Column::CreatedAt,
                ])
                .update_columns([
                    vote::Column::Choice,
                    vote::Column::VotingPower,
                    vote::Column::Reason,
                    vote::Column::BlockCreatedAt,
                    vote::Column::Txid,
                    vote::Column::ProposalId,
                ])
                .to_owned(),
            )
            .exec(&txn)
            .await;

        if let Err(err) = result {
            txn.rollback().await?;
            return Err(err.into());
        }
    }

    txn.commit().await?;
    Ok(())
}

#[instrument]
pub async fn store_delegations(delegations: Vec<delegation::ActiveModel>) -> Result<()> {
    let db = DB.get().unwrap();
    let txn = db.begin().await?;

    delegation::Entity::insert_many(delegations)
        .on_conflict(OnConflict::new().do_nothing().to_owned())
        .exec(&txn)
        .await?;

    txn.commit().await?;
    Ok(())
}

#[instrument]
pub async fn store_voting_powers(voting_powers: Vec<voting_power::ActiveModel>) -> Result<()> {
    let db = DB.get().unwrap();
    let txn = db.begin().await?;

    voting_power::Entity::insert_many(voting_powers)
        .on_conflict(OnConflict::new().do_nothing().to_owned())
        .exec(&txn)
        .await?;

    txn.commit().await?;
    Ok(())
}

#[instrument(skip(txn, voter_addresses))]
async fn store_voters(txn: &DatabaseTransaction, voter_addresses: HashSet<String>) -> Result<()> {
    const BATCH_SIZE: usize = 1000; // Adjust based on database performance

    for addresses_chunk in voter_addresses
        .into_iter()
        .collect::<Vec<_>>()
        .chunks(BATCH_SIZE)
    {
        // Fetch existing voters with address and ens
        let existing_voters_models: Vec<voter::Model> = voter::Entity::find()
            .filter(voter::Column::Address.is_in(addresses_chunk.to_vec()))
            .all(txn)
            .await?;

        // Create a HashMap of existing voters for quick lookup
        let existing_voters_map: HashMap<String, voter::Model> = existing_voters_models
            .into_iter()
            .map(|v| (v.address.clone(), v))
            .collect();

        let mut voters_to_insert: Vec<voter::ActiveModel> = Vec::new();
        let mut voters_to_update: Vec<voter::ActiveModel> = Vec::new();

        for address in addresses_chunk {
            if let Some(existing_voter) = existing_voters_map.get(address) {
                // Voter exists, check and update ENS if needed
                let addr_clone = address.clone();
                let provider = get_ethereum_provider_cache().get_inner_provider();
                let ens_result: Result<String, ProviderError> = provider
                    .lookup_address(addr_clone.parse::<Address>()?)
                    .await;

                match ens_result {
                    Ok(fetched_ens) => {
                        if existing_voter.ens != Some(fetched_ens.clone()) {
                            debug!(
                                "Updating ENS for address {}: old ENS: {:?}, new ENS: {:?}",
                                address, existing_voter.ens, fetched_ens
                            );
                            voters_to_update.push(voter::ActiveModel {
                                id: Set(existing_voter.id),  // Use Set to update existing record
                                address: NotSet,             // Don't update address
                                ens: Set(Some(fetched_ens)), // Set the new ENS
                            });
                        }
                    }
                    Err(e) => {
                        debug!(
                            "ENS lookup failed for address {} (update check): {}",
                            addr_clone, e
                        );
                        // Do not update ENS if lookup fails, or handle differently if needed
                    }
                }
            } else {
                // Voter does not exist, perform ENS lookup and prepare for insert
                let addr_clone = address.clone();
                let provider = get_ethereum_provider_cache().get_inner_provider();
                let ens_result: Result<String, ProviderError> = provider
                    .lookup_address(addr_clone.parse::<Address>()?)
                    .await;

                match ens_result {
                    Ok(ens) => voters_to_insert.push(voter::ActiveModel {
                        id: NotSet,
                        address: Set(address.clone()),
                        ens: Set(Some(ens)),
                    }),
                    Err(_) => voters_to_insert.push(voter::ActiveModel {
                        id: NotSet,
                        address: Set(address.clone()),
                        ens: NotSet,
                    }),
                };
            }
        }

        // Perform bulk insert for new voters
        if !voters_to_insert.is_empty() {
            voter::Entity::insert_many(voters_to_insert)
                .on_conflict(OnConflict::new().do_nothing().to_owned())
                .exec(txn)
                .await?;
        }
        // Perform bulk update for existing voters with new ENS
        if !voters_to_update.is_empty() {
            for voter_update in voters_to_update.into_iter() {
                voter::Entity::update(voter_update).exec(txn).await?;
            }
        }
    }

    Ok(())
}
