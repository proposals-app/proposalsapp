use anyhow::Result;
use axum::routing::get;
use axum::Router;
use database::{
    fetch_dao_indexers, store_proposals, store_votes, update_indexer_speed,
    update_indexer_speed_and_index, DatabaseStore,
};
use dotenv::dotenv;
use indexer::Indexer;
use indexers::aave_v2_mainnet_proposals::AaveV2MainnetProposalsIndexer;
use indexers::aave_v2_mainnet_votes::AaveV2MainnetVotesIndexer;
use indexers::aave_v3_avalanche_votes::AaveV3AvalancheVotesIndexer;
use indexers::aave_v3_mainnet_proposals::AaveV3MainnetProposalsIndexer;
use indexers::aave_v3_mainnet_votes::AaveV3MainnetVotesIndexer;
use indexers::aave_v3_polygon_votes::AaveV3PolygonVotesIndexer;
use indexers::arbitrum_core_proposals::ArbitrumCoreProposalsIndexer;
use indexers::arbitrum_core_votes::ArbitrumCoreVotesIndexer;
use indexers::arbitrum_treasury_proposals::ArbitrumTreasuryProposalsIndexer;
use indexers::arbitrum_treasury_votes::ArbitrumTreasuryVotesIndexer;
use indexers::compound_mainnet_proposals::CompoundMainnetProposalsIndexer;
use indexers::compound_mainnet_votes::CompoundMainnetVotesIndexer;
use indexers::dydx_mainnet_proposals::DydxMainnetProposalsIndexer;
use indexers::dydx_mainnet_votes::DydxMainnetVotesIndexer;
use indexers::ens_mainnnet_proposals::EnsMainnetProposalsIndexer;
use indexers::ens_vote_indexer::EnsMainnetVotesIndexer;
use indexers::frax_alpha_mainnet_proposals::FraxAlphaMainnetProposalsIndexer;
use indexers::frax_alpha_mainnet_votes::FraxAlphaMainnetVotesIndexer;
use indexers::frax_omega_mainnet_proposals::FraxOmegaMainnetProposalsIndexer;
use indexers::frax_omega_mainnet_votes::FraxOmegaMainnetVotesIndexer;
use indexers::gitcoin_v1_mainnet_proposals::GitcoinV1MainnetProposalsIndexer;
use indexers::gitcoin_v1_mainnet_votes::GitcoinV1MainnetVotesIndexer;
use indexers::gitcoin_v2_mainnet_proposals::GitcoinV2MainnetProposalsIndexer;
use indexers::gitcoin_v2_mainnet_votes::GitcoinV2MainnetVotesIndexer;
use indexers::hop_mainnet_proposals::HopMainnetProposalsIndexer;
use indexers::hop_mainnet_votes::HopMainnetVotesIndexer;
use indexers::maker_executive_mainnet_proposals::MakerExecutiveMainnetProposalsIndexer;
use indexers::maker_executive_mainnet_votes::MakerExecutiveMainnetVotesIndexer;
use indexers::maker_poll_arbitrum_votes::MakerPollArbitrumVotesIndexer;
use indexers::maker_poll_mainnet_proposals::MakerPollMainnetProposalsIndexer;
use indexers::maker_poll_mainnet_votes::MakerPollMainnetVotesIndexer;
use indexers::nouns_mainnet_proposals::NounsProposalsIndexer;
use indexers::nouns_mainnet_votes::NounsVotesIndexer;
use indexers::optimism_proposals::OptimismProposalsIndexer;
use indexers::optimism_votes::OptimismVotesIndexer;
use indexers::snapshot_proposals::SnapshotProposalsIndexer;
use indexers::snapshot_votes::SnapshotVotesIndexer;
use indexers::uniswap_mainnet_proposals::UniswapMainnetProposalsIndexer;
use indexers::uniswap_mainnet_votes::UniswapMainnetVotesIndexer;
use sea_orm::prelude::Uuid;
use sea_orm::DatabaseConnection;
use seaorm::sea_orm_active_enums::{IndexerType, IndexerVariant};
use seaorm::{dao, dao_indexer};
use snapshot_api::{SnapshotApiConfig, SnapshotApiHandler};

use std::sync::Arc;
use std::{collections::HashSet, time::Duration};
use tokio::{
    sync::{mpsc, Mutex},
    time::sleep,
};
use tracing::{debug, error, info, instrument};
use utils::tracing::setup_tracing;

mod database;
mod indexer;
mod indexers;
mod rpc_providers;
mod snapshot_api;

static MAX_JOBS: usize = 100;
static CONCURRENT_JOBS: usize = 5;
static JOB_PRODUCE_INTERVAL: Duration = Duration::from_secs(1);
static JOB_TIMEOUT: Duration = Duration::from_secs(10 * 60);
static SNAPSHOT_MAX_RETRIES: usize = 5;
static SNAPSHOT_MAX_CONCURRENT_REQUESTS: usize = 5;
static SNAPSHOT_MAX_QUEUE: usize = 100;

lazy_static::lazy_static! {
    static ref SNAPSHOT_API_HANDLER: Arc<SnapshotApiHandler> = Arc::new(SnapshotApiHandler::new(SnapshotApiConfig {
        max_retries: SNAPSHOT_MAX_RETRIES,
        concurrency: SNAPSHOT_MAX_CONCURRENT_REQUESTS,
        queue_size: SNAPSHOT_MAX_QUEUE,
    }));
}

#[tokio::main]
#[instrument]
async fn main() -> Result<()> {
    dotenv().ok();
    setup_tracing();
    let db: DatabaseConnection = DatabaseStore::connect().await?;

    // Create channels for the job queues
    let (snapshot_tx, snapshot_rx) = mpsc::channel::<(dao_indexer::Model, dao::Model)>(MAX_JOBS);
    let (other_tx, other_rx) = mpsc::channel::<(dao_indexer::Model, dao::Model)>(MAX_JOBS);

    // Create shared sets to keep track of indexers in the queues
    let snapshot_queued_indexers = Arc::new(Mutex::new(HashSet::new()));
    let other_queued_indexers = Arc::new(Mutex::new(HashSet::new()));

    // Task 1: Add jobs to the queues
    let job_producer = tokio::spawn({
        let db = db.clone();
        let snapshot_tx = snapshot_tx.clone();
        let other_tx = other_tx.clone();
        let snapshot_queued_indexers = snapshot_queued_indexers.clone();
        let other_queued_indexers = other_queued_indexers.clone();

        async move {
            loop {
                let dao_indexers = fetch_dao_indexers(&db)
                    .await
                    .expect("Failed to fetch indexers with daos");

                for (indexer, dao) in dao_indexers {
                    let indexer_id = indexer.id;
                    let indexer_variant = indexer.indexer_variant.clone();

                    let (tx, queued_indexers) = if indexer_variant
                        == IndexerVariant::SnapshotProposals
                        || indexer_variant == IndexerVariant::SnapshotVotes
                    {
                        (&snapshot_tx, &snapshot_queued_indexers)
                    } else {
                        (&other_tx, &other_queued_indexers)
                    };

                    // Check if the indexer is already in the queue
                    let mut queue = queued_indexers.lock().await;
                    if !queue.contains(&indexer_id) {
                        if tx.send((indexer.clone(), dao.clone())).await.is_err() {
                            break;
                        }
                        queue.insert(indexer_id);

                        info!(
                            indexer_type = ?indexer.indexer_type,
                            indexer_variant = ?indexer_variant,
                            dao_name = ?dao.name,
                            "Added indexer to queue"
                        );
                    } else {
                        debug!(
                            indexer_type = ?indexer.indexer_type,
                            indexer_variant = ?indexer_variant,
                            dao_name = ?dao.name,
                            "Indexer already in queue, skipping"
                        );
                    }
                }

                // Wait for a while before fetching again
                sleep(JOB_PRODUCE_INTERVAL).await;
            }
        }
    });

    // Task 2: Process Snapshot jobs from the queue
    let snapshot_job_consumer =
        create_job_consumer(snapshot_rx, snapshot_queued_indexers.clone(), db.clone());

    // Task 3: Process other jobs from the queue
    let other_job_consumer =
        create_job_consumer(other_rx, other_queued_indexers.clone(), db.clone());

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
    snapshot_job_consumer.abort();
    other_job_consumer.abort();
    server.abort();

    Ok(())
}

fn create_job_consumer(
    mut rx: mpsc::Receiver<(dao_indexer::Model, dao::Model)>,
    queued_indexers: Arc<Mutex<HashSet<Uuid>>>,
    db: DatabaseConnection,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(CONCURRENT_JOBS));

        while let Some((indexer, dao)) = rx.recv().await {
            let permit = semaphore.clone().acquire_owned().await.unwrap();
            let queued_indexers = queued_indexers.clone();
            let db = db.clone();
            tokio::spawn(async move {
                info!(
                    indexer_type = ?indexer.indexer_type,
                    indexer_variant = ?indexer.indexer_variant,
                    dao_name = ?dao.name,
                    "Processing indexer"
                );

                let indexer_implementation = get_indexer(&indexer.indexer_variant);

                let result = tokio::time::timeout(JOB_TIMEOUT, async {
                    indexer_implementation.process(&indexer, &dao).await
                })
                .await;

                match result {
                    Ok(Ok((proposals, votes, to_index))) => {
                        let mut store_success = true;

                        if indexer.indexer_type == IndexerType::Proposals {
                            if let Err(e) = store_proposals(&db, indexer.id, proposals).await {
                                error!("Failed to store proposals: {:?}", e);
                                store_success = false;
                            }
                        }

                        if indexer.indexer_type == IndexerType::Votes {
                            if let Err(e) = store_votes(&db, &indexer, votes).await {
                                error!("Failed to store votes: {:?}", e);
                                store_success = false;
                            }
                        }

                        let new_speed =
                            indexer_implementation.adjust_speed(indexer.speed, store_success);
                        if store_success {
                            // Use to_index as the new index
                            let new_index = to_index;

                            if let Err(e) =
                                update_indexer_speed_and_index(&db, &indexer, new_speed, new_index)
                                    .await
                            {
                                error!("Failed to update indexer speed and index: {:?}", e);
                            }
                        } else if let Err(e) = update_indexer_speed(&db, &indexer, new_speed).await
                        {
                            error!(
                                "Failed to update indexer speed after storage failure: {:?}",
                                e
                            );
                        }
                    }
                    Ok(Err(e)) => {
                        error!("Error processing indexer: {:?}", e);
                        let new_speed = indexer_implementation.adjust_speed(indexer.speed, false);
                        if let Err(e) = update_indexer_speed(&db, &indexer, new_speed).await {
                            error!("Failed to update indexer speed: {:?}", e);
                        }
                    }
                    Err(_) => {
                        // Timeout occurred
                        error!("Indexer processing timed out");
                        let new_speed = indexer_implementation.adjust_speed(indexer.speed, false);
                        if let Err(e) = update_indexer_speed(&db, &indexer, new_speed).await {
                            error!("Failed to update indexer speed after timeout: {:?}", e);
                        }
                    }
                }

                info!(
                    indexer_variant = ?indexer.indexer_variant,
                    dao_name = ?dao.name,
                    "Completed processing indexer"
                );

                // Remove the indexer from the queued set when processing is complete
                queued_indexers.lock().await.remove(&indexer.id);

                drop(permit); // Release the semaphore permit
            });
        }
    })
}

pub fn get_indexer(indexer_variant: &IndexerVariant) -> Box<dyn Indexer> {
    match indexer_variant {
        IndexerVariant::SnapshotProposals => {
            Box::new(SnapshotProposalsIndexer::new(SNAPSHOT_API_HANDLER.clone()))
        }
        IndexerVariant::SnapshotVotes => {
            Box::new(SnapshotVotesIndexer::new(SNAPSHOT_API_HANDLER.clone()))
        }
        IndexerVariant::AaveV2MainnetProposals => Box::new(AaveV2MainnetProposalsIndexer),
        IndexerVariant::AaveV2MainnetVotes => Box::new(AaveV2MainnetVotesIndexer),
        IndexerVariant::AaveV3MainnetProposals => Box::new(AaveV3MainnetProposalsIndexer),
        IndexerVariant::AaveV3MainnetVotes => Box::new(AaveV3MainnetVotesIndexer),
        IndexerVariant::AaveV3PolygonVotes => Box::new(AaveV3PolygonVotesIndexer),
        IndexerVariant::AaveV3AvalancheVotes => Box::new(AaveV3AvalancheVotesIndexer),
        IndexerVariant::CompoundMainnetProposals => Box::new(CompoundMainnetProposalsIndexer),
        IndexerVariant::CompoundMainnetVotes => Box::new(CompoundMainnetVotesIndexer),
        IndexerVariant::DydxMainnetProposals => Box::new(DydxMainnetProposalsIndexer),
        IndexerVariant::DydxMainnetVotes => Box::new(DydxMainnetVotesIndexer),
        IndexerVariant::EnsMainnetProposals => Box::new(EnsMainnetProposalsIndexer),
        IndexerVariant::EnsMainnetVotes => Box::new(EnsMainnetVotesIndexer),
        IndexerVariant::FraxAlphaMainnetProposals => Box::new(FraxAlphaMainnetProposalsIndexer),
        IndexerVariant::FraxAlphaMainnetVotes => Box::new(FraxAlphaMainnetVotesIndexer),
        IndexerVariant::FraxOmegaMainnetProposals => Box::new(FraxOmegaMainnetProposalsIndexer),
        IndexerVariant::FraxOmegaMainnetVotes => Box::new(FraxOmegaMainnetVotesIndexer),
        IndexerVariant::GitcoinMainnetProposals => Box::new(GitcoinV1MainnetProposalsIndexer),
        IndexerVariant::GitcoinMainnetVotes => Box::new(GitcoinV1MainnetVotesIndexer),
        IndexerVariant::GitcoinV2MainnetProposals => Box::new(GitcoinV2MainnetProposalsIndexer),
        IndexerVariant::GitcoinV2MainnetVotes => Box::new(GitcoinV2MainnetVotesIndexer),
        IndexerVariant::HopMainnetProposals => Box::new(HopMainnetProposalsIndexer),
        IndexerVariant::HopMainnetVotes => Box::new(HopMainnetVotesIndexer),
        IndexerVariant::MakerExecutiveMainnetProposals => {
            Box::new(MakerExecutiveMainnetProposalsIndexer)
        }
        IndexerVariant::MakerExecutiveMainnetVotes => Box::new(MakerExecutiveMainnetVotesIndexer),
        IndexerVariant::MakerPollMainnetProposals => Box::new(MakerPollMainnetProposalsIndexer),
        IndexerVariant::MakerPollMainnetVotes => Box::new(MakerPollMainnetVotesIndexer),
        IndexerVariant::MakerPollArbitrumVotes => Box::new(MakerPollArbitrumVotesIndexer),
        IndexerVariant::NounsProposalsMainnetProposals => Box::new(NounsProposalsIndexer),
        IndexerVariant::NounsProposalsMainnetVotes => Box::new(NounsVotesIndexer),
        IndexerVariant::OpOptimismProposals => Box::new(OptimismProposalsIndexer),
        IndexerVariant::OpOptimismVotes => Box::new(OptimismVotesIndexer),
        IndexerVariant::UniswapMainnetProposals => Box::new(UniswapMainnetProposalsIndexer),
        IndexerVariant::UniswapMainnetVotes => Box::new(UniswapMainnetVotesIndexer),
        IndexerVariant::ArbCoreArbitrumProposals => Box::new(ArbitrumCoreProposalsIndexer),
        IndexerVariant::ArbCoreArbitrumVotes => Box::new(ArbitrumCoreVotesIndexer),
        IndexerVariant::ArbTreasuryArbitrumProposals => Box::new(ArbitrumTreasuryProposalsIndexer),
        IndexerVariant::ArbTreasuryArbitrumVotes => Box::new(ArbitrumTreasuryVotesIndexer),
    }
}
