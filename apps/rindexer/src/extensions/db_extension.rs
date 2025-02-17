use anyhow::{Context, Result};
use once_cell::sync::OnceCell;
use proposalsapp_db::models::{dao, dao_indexer, proposal, sea_orm_active_enums::IndexerVariant, vote};
use sea_orm::{prelude::Uuid, DatabaseConnection, EntityTrait, TransactionTrait};
use std::{collections::HashMap, sync::Mutex, time::Duration};

pub static DB: OnceCell<DatabaseConnection> = OnceCell::new();
pub static DAO_INDEXER_ID_MAP: OnceCell<Mutex<HashMap<IndexerVariant, Uuid>>> = OnceCell::new();
pub static DAO_ID_SLUG_MAP: OnceCell<Mutex<HashMap<String, Uuid>>> = OnceCell::new();

pub async fn initialize_db() -> Result<()> {
    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL environment variable not set")?;

    let mut opt = sea_orm::ConnectOptions::new(database_url);
    opt.max_connections(100)
        .min_connections(5)
        .connect_timeout(Duration::from_secs(8))
        .acquire_timeout(Duration::from_secs(8))
        .idle_timeout(Duration::from_secs(8))
        .max_lifetime(Duration::from_secs(8))
        .sqlx_logging(false);

    let db = sea_orm::Database::connect(opt).await.context("Failed to connect to the database")?;

    DB.set(db).map_err(|_| anyhow::anyhow!("Failed to set database connection"))?;

    // Initialize and populate DAO_INDEXER_ID_MAP
    let dao_indexer_map = Mutex::new(HashMap::new());
    let indexers = dao_indexer::Entity::find().all(DB.get().unwrap()).await?;
    for indexer in indexers {
        dao_indexer_map.lock().unwrap().insert(indexer.indexer_variant, indexer.id);
    }
    DAO_INDEXER_ID_MAP
        .set(dao_indexer_map)
        .map_err(|_| anyhow::anyhow!("Failed to set DAO_INDEXER_ID_MAP"))?;

    // Initialize and populate DAO_ID_SLUG_MAP
    let dao_slug_map = Mutex::new(HashMap::new());
    let daos = dao::Entity::find().all(DB.get().unwrap()).await?;
    for dao_model in daos {
        dao_slug_map.lock().unwrap().insert(dao_model.slug, dao_model.id);
    }
    DAO_ID_SLUG_MAP
        .set(dao_slug_map)
        .map_err(|_| anyhow::anyhow!("Failed to set DAO_ID_SLUG_MAP"))?;

    Ok(())
}

pub async fn store_proposals(proposals: Vec<proposal::ActiveModel>) -> Result<()> {
    let txn = DB.get().unwrap().begin().await?;
    println!("Storing {} proposals", proposals.len());

    const BATCH_SIZE: usize = 100;

    let proposal_chunks = proposals.chunks(BATCH_SIZE);

    for chunk in proposal_chunks {
        let result = proposal::Entity::insert_many(chunk.to_vec())
            .on_conflict(
                sea_orm::sea_query::OnConflict::columns([proposal::Column::ExternalId, proposal::Column::DaoIndexerId])
                    .update_columns([
                        proposal::Column::Name,
                        proposal::Column::Body,
                        proposal::Column::Url,
                        proposal::Column::DiscussionUrl,
                        proposal::Column::Choices,
                        proposal::Column::Scores,
                        proposal::Column::ScoresTotal,
                        proposal::Column::Quorum,
                        proposal::Column::ProposalState,
                        proposal::Column::MarkedSpam,
                        proposal::Column::CreatedAt,
                        proposal::Column::StartAt,
                        proposal::Column::EndAt,
                        proposal::Column::Metadata,
                        proposal::Column::Author,
                    ])
                    .to_owned(),
            )
            .exec(&txn)
            .await;

        if let Err(err) = result {
            eprintln!("Error inserting proposals chunk: {:?}", err);
            // Decide how to handle errors during chunk insertion.
            // For example, you might want to rollback the transaction and return an error.
            txn.rollback().await?;
            return Err(err.into()); // Or handle the error as needed.
        }
    }

    txn.commit().await?;
    Ok(())
}

pub async fn store_votes(votes: Vec<vote::ActiveModel>) -> Result<()> {
    let txn = DB.get().unwrap().begin().await?;
    println!("Storing {} votes", votes.len());
    txn.commit().await?;
    Ok(())
}
