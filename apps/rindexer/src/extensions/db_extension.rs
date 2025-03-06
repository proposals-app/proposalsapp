use crate::rindexer_lib::typings::networks::get_ethereum_provider_cache;
use anyhow::{Context, Result};
use ethers::{providers::Middleware, types::Address};
use once_cell::sync::OnceCell;
use proposalsapp_db_indexer::models::{dao, dao_governor, delegation, job_queue, proposal, vote, voter, voting_power};
use sea_orm::{ActiveValue::NotSet, ColumnTrait, Condition, DatabaseConnection, DatabaseTransaction, EntityTrait, IntoActiveModel, QueryFilter, Set, TransactionTrait, prelude::Uuid, sea_query::OnConflict};
use std::{collections::HashMap, sync::Mutex, time::Duration};
use tracing::instrument;
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

#[instrument(skip(vote))]
pub async fn store_vote(vote: vote::ActiveModel, governor_id: Uuid) -> Result<()> {
    let db = DB
        .get()
        .ok_or_else(|| anyhow::anyhow!("DB not initialized"))?;
    let txn = db.begin().await?;

    let proposal_external_id = vote
        .proposal_external_id
        .clone()
        .take()
        .ok_or_else(|| anyhow::anyhow!("Missing proposal_external_id in vote"))?;

    let proposal: Option<proposal::Model> = proposal::Entity::find()
        .filter(proposal::Column::ExternalId.eq(proposal_external_id.clone()))
        .filter(proposal::Column::GovernorId.eq(governor_id))
        .one(&txn)
        .await?;

    let proposal = match proposal {
        Some(p) => p,
        None => {
            txn.rollback().await?;
            return Err(anyhow::anyhow!(
                "No proposal found for external_id: {}",
                proposal_external_id
            ));
        }
    };

    let voter_address_to_ensure = vote
        .voter_address
        .clone()
        .take()
        .ok_or_else(|| anyhow::anyhow!("Missing voter_address in vote"))?;
    ensure_voter_exist(&txn, voter_address_to_ensure).await?;

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
        proposal_id: Set(proposal.id),
        id: NotSet,
    };

    let result = vote::Entity::insert(vote_active_model)
        .on_conflict(
            sea_orm::sea_query::OnConflict::columns([
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

    txn.commit().await?;
    Ok(())
}

#[instrument]
pub async fn store_delegation(delegation: delegation::ActiveModel) -> Result<()> {
    let txn = DB.get().unwrap().begin().await?;

    delegation::Entity::insert(delegation)
        .on_conflict(OnConflict::new().do_nothing().to_owned())
        .exec(&txn)
        .await?;

    txn.commit().await?;
    Ok(())
}

#[instrument]
pub async fn store_voting_power(voting_power: voting_power::ActiveModel) -> Result<()> {
    let txn = DB.get().unwrap().begin().await?;

    voting_power::Entity::insert(voting_power)
        .on_conflict(OnConflict::new().do_nothing().to_owned())
        .exec(&txn)
        .await?;

    txn.commit().await?;
    Ok(())
}

#[instrument(skip(txn, voter_address))]
async fn ensure_voter_exist(txn: &DatabaseTransaction, voter_address: String) -> Result<()> {
    // Fetch ENS for the voter address
    let ens_result = get_ethereum_provider_cache()
        .get_inner_provider()
        .lookup_address(voter_address.clone().parse::<Address>()?)
        .await;

    let fetched_ens = match ens_result {
        Ok(ens) => Some(ens),
        Err(_) => None, // If ENS lookup fails, we proceed without ENS
    };

    // Check if voter exists
    let existing_voter: Option<voter::Model> = voter::Entity::find()
        .filter(voter::Column::Address.eq(voter_address.clone()))
        .one(txn)
        .await?;

    if let Some(voter) = existing_voter {
        // Voter exists, check and update ENS if necessary
        if voter.ens != fetched_ens {
            let mut voter_active_model = voter.into_active_model();
            voter_active_model.ens = Set(fetched_ens);
            voter::Entity::update(voter_active_model).exec(txn).await?;
        }
    } else {
        // Voter does not exist, create a new voter
        let mut new_voter = voter::ActiveModel {
            id: NotSet,
            address: Set(voter_address.clone()),
            ens: NotSet,
        };

        if let Some(ens) = fetched_ens {
            new_voter.ens = Set(Some(ens));
        }

        voter::Entity::insert(new_voter).exec(txn).await?;
    }

    Ok(())
}
