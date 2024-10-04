use anyhow::{Context, Result};
use sea_orm::{
    prelude::Uuid, ColumnTrait, Condition, ConnectOptions, Database, DatabaseConnection,
    EntityTrait, QueryFilter, Set, TransactionTrait,
};
use seaorm::{dao_indexer, proposal, vote};
use std::{collections::HashMap, time::Duration};
use tracing::warn;

pub struct DatabaseStore;

impl DatabaseStore {
    pub async fn connect() -> Result<DatabaseConnection> {
        let database_url =
            std::env::var("DATABASE_URL").context("DATABASE_URL environment variable not set")?;

        let mut opt = ConnectOptions::new(database_url);
        opt.max_connections(100)
            .min_connections(5)
            .connect_timeout(Duration::from_secs(8))
            .acquire_timeout(Duration::from_secs(8))
            .idle_timeout(Duration::from_secs(8))
            .max_lifetime(Duration::from_secs(8))
            .sqlx_logging(false);

        Database::connect(opt)
            .await
            .context("Failed to connect to the database")
    }
}

pub async fn store_proposals(
    db: &DatabaseConnection,
    indexer: Uuid,
    proposals: Vec<proposal::ActiveModel>,
) -> Result<()> {
    for proposal in proposals {
        let existing = proposal::Entity::find()
            .filter(
                Condition::all()
                    .add(proposal::Column::ExternalId.eq(proposal.external_id.clone().take()))
                    .add(proposal::Column::DaoIndexerId.eq(indexer.clone())),
            )
            .one(db)
            .await?;

        if let Some(existing) = existing {
            // Update existing proposal
            let mut updated_proposal = proposal.clone();
            updated_proposal.id = Set(existing.id);

            proposal::Entity::update(updated_proposal.clone())
                .exec(db)
                .await?;
        } else {
            // Insert new proposal
            proposal::Entity::insert(proposal).exec(db).await?;
        }
    }
    Ok(())
}

pub async fn store_votes(
    db: &DatabaseConnection,
    indexer_id: Uuid,
    votes: Vec<vote::ActiveModel>,
) -> Result<()> {
    if votes.is_empty() {
        return Ok(());
    }

    let txn = db.begin().await?;

    // Group votes by proposal_external_id
    let mut votes_by_proposal: HashMap<String, Vec<vote::ActiveModel>> = HashMap::new();
    for vote in votes {
        votes_by_proposal
            .entry(vote.proposal_external_id.clone().unwrap())
            .or_insert_with(Vec::new)
            .push(vote);
    }

    let proposal_external_ids: Vec<String> = votes_by_proposal.keys().cloned().collect();
    let proposals: Vec<proposal::Model> = proposal::Entity::find()
        .filter(proposal::Column::ExternalId.is_in(proposal_external_ids.clone()))
        .filter(proposal::Column::DaoIndexerId.eq(indexer_id))
        .all(&txn)
        .await?;

    let proposal_id_map: HashMap<String, Uuid> = proposals
        .into_iter()
        .map(|p| (p.external_id, p.id))
        .collect();

    let mut votes_to_insert: Vec<vote::ActiveModel> = Vec::new();
    for (external_id, mut votes_for_proposal) in votes_by_proposal {
        if let Some(&proposal_id) = proposal_id_map.get(&external_id) {
            for vote in &mut votes_for_proposal {
                vote.proposal_id = Set(proposal_id);
            }
            votes_to_insert.extend(votes_for_proposal);
        } else {
            warn!(
                "No matching proposal found for external_id: {}",
                external_id
            );
        }
    }

    if !votes_to_insert.is_empty() {
        vote::Entity::insert_many(votes_to_insert)
            .on_conflict(
                sea_orm::sea_query::OnConflict::column(vote::Column::Id)
                    .do_nothing()
                    .to_owned(),
            )
            .exec(&txn)
            .await?;
    }

    txn.commit().await?;
    Ok(())
}

pub async fn update_indexer_speed_and_index(
    db: &DatabaseConnection,
    indexer: &dao_indexer::Model,
    new_speed: i32,
    new_index: i32,
) -> Result<()> {
    dao_indexer::Entity::update(dao_indexer::ActiveModel {
        id: Set(indexer.id),
        speed: Set(new_speed),
        index: Set(new_index),
        ..Default::default()
    })
    .exec(db)
    .await?;
    Ok(())
}

pub async fn update_indexer_speed(
    db: &DatabaseConnection,
    indexer: &dao_indexer::Model,
    new_speed: i32,
) -> Result<()> {
    dao_indexer::Entity::update(dao_indexer::ActiveModel {
        id: Set(indexer.id),
        speed: Set(new_speed),
        ..Default::default()
    })
    .exec(db)
    .await?;
    Ok(())
}

pub async fn fetch_dao_indexers(
    db: &DatabaseConnection,
) -> Result<Vec<(dao_indexer::Model, Option<seaorm::dao::Model>)>> {
    dao_indexer::Entity::find()
        .find_also_related(seaorm::dao::Entity)
        .all(db)
        .await
        .context("Failed to fetch indexers with daos")
}
