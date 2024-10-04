use anyhow::Result;
use axum::routing::get;
use axum::Router;
use dotenv::dotenv;
use indexer::{Indexer, IndexerImpl};
use indexers::aave_v2_mainnet_proposals::AaveV2MainnetProposalsIndexer;
use indexers::aave_v2_mainnet_votes::AaveV2MainnetVotesIndexer;
use sea_orm::DatabaseConnection;
use seaorm::sea_orm_active_enums::IndexerVariant;
use std::sync::Arc;
use std::{collections::HashSet, time::Duration};
use tokio::{
    sync::{mpsc, Mutex},
    time::sleep,
};
use tracing::{error, info, instrument};
use utils::tracing::setup_tracing;

mod database;
mod indexer;
mod indexers;

use database::{
    fetch_dao_indexers, store_proposals, store_votes, update_indexer_speed,
    update_indexer_speed_and_index, DatabaseStore,
};

static MAX_JOBS: usize = 100;
static CONCURRENT_JOBS: usize = 5;
static JOB_PRODUCE_INTERVAL: Duration = Duration::from_secs(1);
static JOB_TIMEOUT: Duration = Duration::from_secs(30);

#[tokio::main]
#[instrument]
async fn main() -> Result<()> {
    dotenv().ok();
    setup_tracing();
    let db: DatabaseConnection = DatabaseStore::connect().await?;

    // Create a channel for the job queue
    let (tx, mut rx) = mpsc::channel::<(seaorm::dao_indexer::Model, String)>(MAX_JOBS);

    // Create a shared set to keep track of indexers in the queue
    let queued_indexers = Arc::new(Mutex::new(HashSet::new()));

    // Task 1: Add jobs to the queue
    let job_producer = tokio::spawn({
        let db = db.clone();
        let tx = tx.clone();
        let queued_indexers = queued_indexers.clone();

        async move {
            loop {
                let dao_indexers = fetch_dao_indexers(&db)
                    .await
                    .expect("Failed to fetch indexers with daos");

                for (indexer, dao) in dao_indexers {
                    let indexer_id = indexer.id;
                    let indexer_type = indexer.indexer_type.clone();
                    let dao_name = dao
                        .as_ref()
                        .map(|d| d.name.clone())
                        .unwrap_or_else(|| "Unknown DAO".to_string());

                    // Check if the indexer is already in the queue
                    let mut queue = queued_indexers.lock().await;
                    if !queue.contains(&indexer_id) {
                        if tx.send((indexer, dao_name.clone())).await.is_err() {
                            break;
                        }
                        queue.insert(indexer_id);

                        info!(
                            indexer_type = ?indexer_type,
                            dao_name = %dao_name,
                            "Added indexer to queue"
                        );
                    } else {
                        info!(
                            indexer_type = ?indexer_type,
                            dao_name = %dao_name,
                            "Indexer already in queue, skipping"
                        );
                    }
                }

                // Wait for a while before fetching again
                sleep(JOB_PRODUCE_INTERVAL).await;
            }
        }
    });

    // Task 2: Process jobs from the queue
    let job_consumer = tokio::spawn({
        let queued_indexers = queued_indexers.clone();
        let db = db.clone();
        async move {
            let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(CONCURRENT_JOBS));

            while let Some((indexer, dao_name)) = rx.recv().await {
                let permit = semaphore.clone().acquire_owned().await.unwrap();
                let queued_indexers = queued_indexers.clone();
                let db = db.clone();
                tokio::spawn(async move {
                    info!(
                        indexer_variant = ?indexer.indexer_variant,
                        dao_name = %dao_name,
                        "Processing indexer"
                    );

                    let indexer_implementation = get_indexer(&indexer.indexer_variant);

                    let result = tokio::time::timeout(JOB_TIMEOUT, async {
                        indexer_implementation.process(&indexer).await
                    })
                    .await;

                    match result {
                        Ok(Ok((proposals, votes))) => {
                            if let Err(e) = store_proposals(&db, indexer.id, proposals).await {
                                error!("Failed to store proposals: {:?}", e);
                            }
                            if let Err(e) = store_votes(&db, indexer.id, votes).await {
                                error!("Failed to store votes: {:?}", e);
                            }
                            let new_speed =
                                indexer_implementation.adjust_speed(indexer.speed, true);
                            let new_index = indexer.index + indexer.speed;
                            if let Err(e) =
                                update_indexer_speed_and_index(&db, &indexer, new_speed, new_index)
                                    .await
                            {
                                error!("Failed to update indexer speed and index: {:?}", e);
                            }
                        }
                        Ok(Err(e)) => {
                            error!("Error processing indexer: {:?}", e);
                            let new_speed =
                                indexer_implementation.adjust_speed(indexer.speed, false);
                            if let Err(e) = update_indexer_speed(&db, &indexer, new_speed).await {
                                error!("Failed to update indexer speed: {:?}", e);
                            }
                        }
                        Err(_) => {
                            // Timeout occurred
                            error!("Indexer processing timed out");
                            let new_speed =
                                indexer_implementation.adjust_speed(indexer.speed, false);
                            if let Err(e) = update_indexer_speed(&db, &indexer, new_speed).await {
                                error!("Failed to update indexer speed after timeout: {:?}", e);
                            }
                        }
                    }

                    info!(
                        indexer_variant = ?indexer.indexer_variant,
                        dao_name = %dao_name,
                        "Completed processing indexer"
                    );

                    // Remove the indexer from the queued set when processing is complete
                    queued_indexers.lock().await.remove(&indexer.id);

                    drop(permit); // Release the semaphore permit
                });
            }
        }
    });

    // Set up the health check server
    let app = Router::new().route("/", get("OK"));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    let server = tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    info!(port = 3000, "Health check server running");

    // Wait for Ctrl+C
    tokio::signal::ctrl_c().await?;
    println!("Shutting down...");

    // Clean up tasks
    job_producer.abort();
    job_consumer.abort();
    server.abort();

    Ok(())
}

pub fn get_indexer(indexer_variant: &IndexerVariant) -> Box<dyn Indexer> {
    match indexer_variant {
        IndexerVariant::AaveV2MainnetProposals => Box::new(IndexerImpl::AaveV2MainnetProposals(
            AaveV2MainnetProposalsIndexer,
        )),
        IndexerVariant::AaveV2MainnetVotes => {
            Box::new(IndexerImpl::AaveV2MainnetVotes(AaveV2MainnetVotesIndexer))
        }
        // Add other matches as needed
        _ => todo!("Implement other indexer variants"),
    }
}
