use anyhow::{Context, Result};
use once_cell::sync::OnceCell;
use proposalsapp_db::models::{dao, governor_new, proposal_new, vote_new};
use sea_orm::{prelude::Uuid, ActiveValue::NotSet, ColumnTrait, Condition, DatabaseConnection, EntityTrait, QueryFilter, Set, TransactionTrait};
use std::{collections::HashMap, sync::Mutex, time::Duration};
use tracing::instrument;

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
    let governors = governor_new::Entity::find().all(DB.get().unwrap()).await?;
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

#[instrument(skip(proposal))]
pub async fn store_proposal(proposal: proposal_new::ActiveModel) -> Result<()> {
    let txn = DB.get().unwrap().begin().await?;

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

    let existing_proposal = proposal_new::Entity::find()
        .filter(
            Condition::all()
                .add(proposal_new::Column::ExternalId.eq(external_id.clone()))
                .add(proposal_new::Column::GovernorId.eq(governor_id)),
        )
        .one(&txn)
        .await?;

    if let Some(existing) = existing_proposal {
        // Update existing proposal
        let active_model = proposal_new::ActiveModel {
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

        proposal_new::Entity::update(active_model)
            .exec(&txn)
            .await?;
    } else {
        // Insert new proposal
        proposal_new::Entity::insert(proposal).exec(&txn).await?;
    }

    txn.commit().await?;
    Ok(())
}

#[instrument(skip(vote))]
pub async fn store_vote(vote: vote_new::ActiveModel, governor_id: Uuid) -> Result<()> {
    let txn = DB.get().unwrap().begin().await?;

    let proposal_external_id = vote
        .proposal_external_id
        .clone()
        .take()
        .ok_or_else(|| anyhow::anyhow!("Missing proposal_external_id in vote"))?;

    let proposal: Option<proposal_new::Model> = proposal_new::Entity::find()
        .filter(proposal_new::Column::ExternalId.eq(proposal_external_id.clone()))
        .filter(proposal_new::Column::GovernorId.eq(governor_id))
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

    let vote_active_model = vote_new::ActiveModel {
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

    let result = vote_new::Entity::insert(vote_active_model)
        .on_conflict(
            sea_orm::sea_query::OnConflict::columns([
                vote_new::Column::ProposalId,
                vote_new::Column::VoterAddress,
                vote_new::Column::CreatedAt,
            ])
            .update_columns([
                vote_new::Column::Choice,
                vote_new::Column::VotingPower,
                vote_new::Column::Reason,
                vote_new::Column::BlockCreatedAt,
                vote_new::Column::Txid,
                vote_new::Column::ProposalId,
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
