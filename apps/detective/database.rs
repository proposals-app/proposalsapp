use anyhow::{Context, Result};
use sea_orm::{
    prelude::Uuid,
    sea_query::{LockBehavior, LockType},
    ColumnTrait, Condition, ConnectOptions, Database, DatabaseConnection, EntityTrait, Order,
    QueryFilter, QueryOrder, QuerySelect, Set, TransactionTrait,
};
use seaorm::{dao_indexer, proposal, vote};
use std::time::Duration;

pub struct DatabaseSetup;

impl DatabaseSetup {
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

pub async fn store_votes(db: &DatabaseConnection, votes: Vec<vote::ActiveModel>) -> Result<()> {
    for vote in votes {
        vote::Entity::insert(vote)
            .on_conflict(
                sea_orm::sea_query::OnConflict::column(vote::Column::Id)
                    .update_column(vote::Column::Choice)
                    .to_owned(),
            )
            .exec(db)
            .await?;
    }
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
