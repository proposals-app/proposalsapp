use anyhow::{Context, Result};
use once_cell::sync::OnceCell;
use proposalsapp_db::models::{dao, dao_indexer, proposal_new, sea_orm_active_enums::IndexerVariant, vote_new};
use sea_orm::{prelude::Uuid, ActiveValue::NotSet, ColumnTrait, Condition, DatabaseConnection, EntityTrait, QueryFilter, Set, TransactionTrait};
use std::{collections::HashMap, sync::Mutex, time::Duration};

pub static DB: OnceCell<DatabaseConnection> = OnceCell::new();
pub static DAO_INDEXER_ID_MAP: OnceCell<Mutex<HashMap<IndexerVariant, Uuid>>> = OnceCell::new();
pub static DAO_ID_SLUG_MAP: OnceCell<Mutex<HashMap<String, Uuid>>> = OnceCell::new();

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
    let dao_indexer_map = Mutex::new(HashMap::new());
    let indexers = dao_indexer::Entity::find().all(DB.get().unwrap()).await?;
    for indexer in indexers {
        dao_indexer_map
            .lock()
            .unwrap()
            .insert(indexer.indexer_variant, indexer.id);
    }
    DAO_INDEXER_ID_MAP
        .set(dao_indexer_map)
        .map_err(|_| anyhow::anyhow!("Failed to set DAO_INDEXER_ID_MAP"))?;

    // Initialize and populate DAO_ID_SLUG_MAP
    let dao_slug_map = Mutex::new(HashMap::new());
    let daos = dao::Entity::find().all(DB.get().unwrap()).await?;
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

pub async fn store_proposals(proposals: Vec<proposal_new::ActiveModel>) -> Result<()> {
    let txn = DB.get().unwrap().begin().await?;

    // Extract the indexer ID from the first proposal, assuming all proposals have the same indexer ID
    let indexer_id = proposals
        .first()
        .and_then(|p| Some(p.dao_indexer_id.clone().unwrap()))
        .ok_or_else(|| anyhow::anyhow!("No proposals provided or missing dao_indexer_id"))?;

    let external_ids: Vec<String> = proposals
        .iter()
        .map(|p| p.external_id.clone().unwrap())
        .collect();

    let existing_proposals: HashMap<String, proposal_new::Model> = proposal_new::Entity::find()
        .filter(
            Condition::all()
                .add(proposal_new::Column::ExternalId.is_in(external_ids.clone()))
                .add(proposal_new::Column::DaoIndexerId.eq(indexer_id)),
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
        proposal_new::Entity::insert_many(to_insert)
            .exec(&txn)
            .await?;
    }

    // Batch update existing proposals
    for mut p in to_update {
        let existing = existing_proposals
            .get(&p.external_id.clone().unwrap())
            .unwrap();
        p.id = Set(existing.id);
        proposal_new::Entity::update(p).exec(&txn).await?;
    }

    txn.commit().await?;
    Ok(())
}

pub async fn store_votes(votes: Vec<vote_new::ActiveModel>, proposals_indexer_id: Uuid) -> Result<()> {
    if votes.is_empty() {
        return Ok(());
    }

    let txn = DB.get().unwrap().begin().await?;

    let proposal_external_ids: Vec<String> = votes
        .iter()
        .map(|v| v.proposal_external_id.clone().unwrap())
        .collect();

    let proposals: HashMap<String, proposal_new::Model> = proposal_new::Entity::find()
        .filter(proposal_new::Column::ExternalId.is_in(proposal_external_ids.clone()))
        .filter(proposal_new::Column::DaoIndexerId.eq(proposals_indexer_id))
        .all(&txn)
        .await?
        .into_iter()
        .map(|p| (p.external_id.clone(), p))
        .collect();

    let mut votes_to_insert: Vec<vote_new::ActiveModel> = Vec::with_capacity(votes.len());
    for vote_model in votes {
        let external_id = vote_model.proposal_external_id.clone().unwrap();
        if let Some(proposal) = proposals.get(&external_id) {
            let vote_active_model = vote_new::ActiveModel {
                voter_address: vote_model.voter_address.clone(),
                choice: vote_model.choice.clone(),
                voting_power: vote_model.voting_power.clone(),
                reason: vote_model.reason.clone(),
                created_at: vote_model.created_at.clone(),
                block_created_at: vote_model.block_created_at.clone(),
                txid: vote_model.txid.clone(),
                proposal_external_id: vote_model.proposal_external_id.clone(),
                dao_id: vote_model.dao_id.clone(),
                indexer_id: vote_model.indexer_id.clone(),
                proposal_id: Set(proposal.id),
                id: NotSet,
            };
            votes_to_insert.push(vote_active_model);
        } else {
            txn.rollback().await?;
            return Err(anyhow::anyhow!(
                "No proposal found for external_id: {}",
                external_id
            ));
        }
    }

    const BATCH_SIZE: usize = 100;
    let vote_chunks = votes_to_insert.chunks(BATCH_SIZE);

    for chunk in vote_chunks {
        let result = vote_new::Entity::insert_many(chunk.to_vec())
            .on_conflict(
                sea_orm::sea_query::OnConflict::columns([vote_new::Column::ProposalId, vote_new::Column::VoterAddress])
                    .update_columns([
                        vote_new::Column::Choice,
                        vote_new::Column::VotingPower,
                        vote_new::Column::Reason,
                        vote_new::Column::CreatedAt,
                        vote_new::Column::BlockCreatedAt,
                        vote_new::Column::Txid,
                        vote_new::Column::ProposalId,
                    ])
                    .to_owned(),
            )
            .exec(&txn)
            .await;

        if let Err(err) = result {
            eprintln!("Error inserting votes chunk: {:?}", err);
            txn.rollback().await?;
            return Err(err.into());
        }
    }

    txn.commit().await?;
    Ok(())
}
