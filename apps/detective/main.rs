#![warn(unused_extern_crates)]
#![allow(clippy::too_many_arguments)]

use anyhow::{bail, Result};
use axum::{routing::get, Router};
use database::{
    fetch_dao_indexers, initialize_db, store_delegations, store_proposals, store_votes,
    store_voting_powers, update_indexer_speed, update_indexer_speed_and_index,
    update_indexer_updated_at,
};
use dotenv::dotenv;
use indexer::{
    DelegationIndexer, ProcessResult, ProposalsIndexer, VotesIndexer, VotingPowerIndexer,
};
use indexers::{
    aave_v2_mainnet_proposals::AaveV2MainnetProposalsIndexer,
    aave_v2_mainnet_votes::AaveV2MainnetVotesIndexer,
    aave_v3_avalanche_votes::AaveV3AvalancheVotesIndexer,
    aave_v3_mainnet_proposals::AaveV3MainnetProposalsIndexer,
    aave_v3_mainnet_votes::AaveV3MainnetVotesIndexer,
    aave_v3_polygon_votes::AaveV3PolygonVotesIndexer,
    arbitrum_core_proposals::ArbitrumCoreProposalsIndexer,
    arbitrum_core_votes::ArbitrumCoreVotesIndexer,
    arbitrum_council_elections::ArbitrumCouncilElectionsProposalsAndVotesIndexer,
    arbitrum_council_nominations::ArbitrumCouncilNominationsProposalsAndVotesIndexer,
    arbitrum_delegations::ArbitrumDelegationsIndexer,
    arbitrum_treasury_proposals::ArbitrumTreasuryProposalsIndexer,
    arbitrum_treasury_votes::ArbitrumTreasuryVotesIndexer,
    arbitrum_voting_power::ArbitrumVotingPowerIndexer,
    compound_mainnet_proposals::CompoundMainnetProposalsIndexer,
    compound_mainnet_votes::CompoundMainnetVotesIndexer,
    dydx_mainnet_proposals::DydxMainnetProposalsIndexer,
    dydx_mainnet_votes::DydxMainnetVotesIndexer,
    ens_mainnnet_proposals::EnsMainnetProposalsIndexer, ens_vote_indexer::EnsMainnetVotesIndexer,
    frax_alpha_mainnet_proposals::FraxAlphaMainnetProposalsIndexer,
    frax_alpha_mainnet_votes::FraxAlphaMainnetVotesIndexer,
    frax_omega_mainnet_proposals::FraxOmegaMainnetProposalsIndexer,
    frax_omega_mainnet_votes::FraxOmegaMainnetVotesIndexer,
    gitcoin_v1_mainnet_proposals::GitcoinV1MainnetProposalsIndexer,
    gitcoin_v1_mainnet_votes::GitcoinV1MainnetVotesIndexer,
    gitcoin_v2_mainnet_proposals::GitcoinV2MainnetProposalsIndexer,
    gitcoin_v2_mainnet_votes::GitcoinV2MainnetVotesIndexer,
    hop_mainnet_proposals::HopMainnetProposalsIndexer, hop_mainnet_votes::HopMainnetVotesIndexer,
    maker_executive_mainnet_proposals::MakerExecutiveMainnetProposalsIndexer,
    maker_executive_mainnet_votes::MakerExecutiveMainnetVotesIndexer,
    maker_poll_arbitrum_votes::MakerPollArbitrumVotesIndexer,
    maker_poll_mainnet_proposals::MakerPollMainnetProposalsIndexer,
    maker_poll_mainnet_votes::MakerPollMainnetVotesIndexer,
    nouns_mainnet_proposals::NounsMainnetProposalsIndexer,
    nouns_mainnet_votes::NounsMainnetVotesIndexer, optimism_proposals::OptimismProposalsIndexer,
    optimism_votes::OptimismVotesIndexer, snapshot_proposals::SnapshotProposalsIndexer,
    snapshot_votes::SnapshotVotesIndexer,
    uniswap_mainnet_proposals::UniswapMainnetProposalsIndexer,
    uniswap_mainnet_votes::UniswapMainnetVotesIndexer,
};
use proposalsapp_db::models::{
    dao, dao_indexer,
    sea_orm_active_enums::{IndexerType, IndexerVariant},
};
use reqwest::Client;
use sea_orm::prelude::Uuid;
use snapshot_api::initialize_snapshot_api;
use std::{
    collections::{HashMap, HashSet},
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::{
    sync::{mpsc, Mutex},
    time::sleep,
};
use tracing::{error, info, instrument, warn};
use utils::tracing::setup_otel;

mod chain_data;
mod database;
mod indexer;
mod indexers;
mod snapshot_api;

static MAX_JOBS: usize = 100;
static CONCURRENT_JOBS_ONCHAIN: usize = 1;
static CONCURRENT_JOBS_SNAPSHOT: usize = 3;

static SNAPSHOT_MAX_RETRIES: usize = 5;
static SNAPSHOT_MAX_CONCURRENT_REQUESTS: usize = 5;
static SNAPSHOT_MAX_QUEUE: usize = 100;
static SNAPSHOT_TIMEOUT: Duration = Duration::from_secs(60);

lazy_static::lazy_static! {
    static ref SNAPSHOT_TX: mpsc::Sender<(dao_indexer::Model, dao::Model)> = {
        let (tx, _) = mpsc::channel(MAX_JOBS);
        tx
    };
    static ref OTHER_TX: mpsc::Sender<(dao_indexer::Model, dao::Model)> = {
        let (tx, _) = mpsc::channel(MAX_JOBS);
        tx
    };
}

lazy_static::lazy_static! {
    static ref SNAPSHOT_QUEUED_INDEXERS: Arc<Mutex<HashSet<Uuid>>> = Arc::new(Mutex::new(HashSet::new()));
    static ref OTHER_QUEUED_INDEXERS: Arc<Mutex<HashSet<Uuid>>> = Arc::new(Mutex::new(HashSet::new()));
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    let _otel = setup_otel().await?;

    info!("Application starting up");

    initialize_db().await?;
    initialize_snapshot_api().await?;

    // Heartbeat task
    let uptime_handle = tokio::spawn(async move {
        let client = Client::new();
        let betterstack_key = std::env::var("BETTERSTACK_KEY").expect("BETTERSTACK_KEY missing");

        loop {
            match client.get(&betterstack_key).send().await {
                Ok(_) => info!("Uptime ping sent successfully"),
                Err(e) => warn!(error = %e, "Failed to send uptime ping"),
            }
            tokio::time::sleep(Duration::from_secs(10)).await;
        }
    });

    // Create channels for the job queues
    let (snapshot_tx, snapshot_rx) = mpsc::channel::<(dao_indexer::Model, dao::Model)>(MAX_JOBS);
    let (other_tx, other_rx) = mpsc::channel::<(dao_indexer::Model, dao::Model)>(MAX_JOBS);

    // Create shared sets to keep track of indexers in the queues
    let snapshot_queued_indexers = Arc::new(Mutex::new(HashSet::new()));
    let other_queued_indexers = Arc::new(Mutex::new(HashSet::new()));

    // Task 2: Process Snapshot jobs from the queue
    let snapshot_job_consumer = create_job_consumer(
        snapshot_rx,
        snapshot_queued_indexers.clone(),
        CONCURRENT_JOBS_SNAPSHOT,
    );

    // Task 3: Process other jobs from the queue
    let other_job_consumer = create_job_consumer(
        other_rx,
        other_queued_indexers.clone(),
        CONCURRENT_JOBS_ONCHAIN,
    );

    // Task 1: Add jobs to the queues
    let job_producer = tokio::spawn({
        let snapshot_tx = snapshot_tx.clone();
        let other_tx = other_tx.clone();
        let snapshot_queued_indexers = snapshot_queued_indexers.clone();
        let other_queued_indexers = other_queued_indexers.clone();

        async move {
            // Keep track of when each indexer was last processed
            let mut last_processed: HashMap<Uuid, Instant> = HashMap::new();

            loop {
                let dao_indexers = fetch_dao_indexers()
                    .await
                    .expect("Failed to fetch indexers with daos");

                for (indexer, dao) in dao_indexers {
                    let indexer_id = indexer.id;
                    let indexer_variant = indexer.indexer_variant.clone();

                    // Get the indexer implementation to access its refresh interval
                    let indexer_impl = get_indexer(&indexer_variant);
                    let interval = indexer_impl.refresh_interval();

                    // Check if enough time has passed since last processing
                    let should_process = last_processed
                        .get(&indexer_id)
                        .is_none_or(|last| last.elapsed() >= interval);

                    if !should_process {
                        continue;
                    }

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
                        last_processed.insert(indexer_id, Instant::now());

                        info!(
                            indexer_type = ?indexer.indexer_type,
                            indexer_variant = ?indexer_variant,
                            dao_name = ?dao.name,
                            interval_secs = ?interval.as_secs(),
                            "Added indexer to queue"
                        );
                    } else {
                        info!(
                            indexer_type = ?indexer.indexer_type,
                            indexer_variant = ?indexer_variant,
                            dao_name = ?dao.name,
                            "Indexer already in queue, skipping"
                        );
                    }
                }

                // Wait for a short duration before the next check
                sleep(Duration::from_secs(5)).await;
            }
        }
    });

    // Set up the health check server
    let app = Router::new().route("/", get(|| async { "OK" }));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    let server = tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    info!(port = 3000, "Health check server running");

    // Wait for Ctrl+C or SIGTERM
    let ctrl_c = tokio::signal::ctrl_c();
    let mut sigterm = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
        .expect("Failed to set up SIGTERM handler");

    tokio::select! {
        _ = ctrl_c => {
            info!("Received Ctrl+C, shutting down...");
        }
        _ = sigterm.recv() => {
            info!("Received SIGTERM, shutting down...");
        }
    }

    // Clean up tasks
    job_producer.abort();
    snapshot_job_consumer.abort();
    other_job_consumer.abort();
    server.abort();
    uptime_handle.abort();

    Ok(())
}

#[instrument(skip(rx, queued_indexers))]
fn create_job_consumer(
    mut rx: mpsc::Receiver<(dao_indexer::Model, dao::Model)>,
    queued_indexers: Arc<Mutex<HashSet<Uuid>>>,
    concurrent_jobs: usize,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(concurrent_jobs));

        while let Some((indexer, dao)) = rx.recv().await {
            let permit = semaphore.clone().acquire_owned().await.unwrap();
            let queued_indexers = queued_indexers.clone();

            tokio::spawn(async move {
                info!(
                    indexer_type = ?indexer.indexer_type,
                    indexer_variant = ?indexer.indexer_variant,
                    dao_name = ?dao.name,
                    "Processing indexer"
                );

                let indexer_implementation = get_indexer(&indexer.indexer_variant);

                let result = tokio::time::timeout(
                    indexer_implementation.timeout(),
                    process_job(&indexer, &dao),
                )
                .await;

                match result {
                    Ok(Ok(process_result)) => {
                        let mut store_success = true;

                        let new_index = match process_result {
                            ProcessResult::Proposals(_, new_idx) => new_idx,
                            ProcessResult::Votes(_, new_idx) => new_idx,
                            ProcessResult::VotingPower(_, new_idx) => new_idx,
                            ProcessResult::Delegation(_, new_idx) => new_idx,
                            ProcessResult::ProposalsAndVotes(_, _, new_idx) => new_idx,
                        };

                        if let Err(e) = store_process_results(&indexer, process_result).await {
                            error!(error = %e, "Failed to store process results");
                            store_success = false;
                        }

                        let new_speed =
                            indexer_implementation.adjust_speed(indexer.speed, store_success);

                        if store_success {
                            if let Err(e) =
                                update_indexer_speed_and_index(&indexer, new_speed, new_index).await
                            {
                                error!(error = %e, "Failed to update indexer speed and index");
                            }
                        } else if let Err(e) = update_indexer_speed(&indexer, new_speed).await {
                            error!(
                                error = %e,
                                "Failed to update indexer speed after storage failure"
                            );
                        }
                    }
                    Ok(Err(e)) => {
                        error!(error = %e, "Error processing indexer");
                        let new_speed = indexer_implementation.adjust_speed(indexer.speed, false);
                        if let Err(e) = update_indexer_speed(&indexer, new_speed).await {
                            error!(error = %e, "Failed to update indexer speed after processing failure");
                        }
                    }
                    Err(_) => {
                        // Timeout occurred
                        error!("Indexer processing timed out");
                        let new_speed = indexer_implementation.adjust_speed(indexer.speed, false);
                        if let Err(e) = update_indexer_speed(&indexer, new_speed).await {
                            error!(error = %e, "Failed to update indexer speed after timeout");
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

#[instrument]
async fn process_job(indexer: &dao_indexer::Model, dao: &dao::Model) -> Result<ProcessResult> {
    match indexer.indexer_type {
        IndexerType::Proposals => {
            if let Some(proposal_indexer) = get_proposals_indexer(&indexer.indexer_variant) {
                proposal_indexer.process_proposals(indexer, dao).await
            } else {
                bail!("Unsupported proposals indexer variant")
            }
        }
        IndexerType::Votes => {
            if let Some(vote_indexer) = get_votes_indexer(&indexer.indexer_variant) {
                vote_indexer.process_votes(indexer, dao).await
            } else {
                bail!("Unsupported votes indexer variant")
            }
        }
        IndexerType::VotingPower => {
            if let Some(power_indexer) = get_voting_power_indexer(&indexer.indexer_variant) {
                power_indexer.process_voting_powers(indexer, dao).await
            } else {
                bail!("Unsupported voting power indexer variant")
            }
        }
        IndexerType::Delegation => {
            if let Some(delegation_indexer) = get_delegation_indexer(&indexer.indexer_variant) {
                delegation_indexer.process_delegations(indexer, dao).await
            } else {
                bail!("Unsupported delegation indexer variant")
            }
        }
        IndexerType::ProposalsAndVotes => {
            if let Some(proposals_and_votes_indexer) =
                get_proposals_and_votes_indexer(&indexer.indexer_variant)
            {
                proposals_and_votes_indexer
                    .process_proposals_and_votes(indexer, dao)
                    .await
            } else {
                bail!("Unsupported proposals and votes indexer variant")
            }
        }
    }
}

#[instrument(skip(result))]
async fn store_process_results(indexer: &dao_indexer::Model, result: ProcessResult) -> Result<()> {
    match result {
        ProcessResult::Proposals(proposals, _) => {
            store_proposals(indexer, proposals).await?;
        }
        ProcessResult::Votes(votes, _) => {
            store_votes(indexer, votes).await?;
        }
        ProcessResult::VotingPower(powers, _) => {
            store_voting_powers(powers).await?;
        }
        ProcessResult::Delegation(delegations, _) => {
            store_delegations(delegations).await?;
        }
        ProcessResult::ProposalsAndVotes(proposals, votes, _) => {
            if !proposals.is_empty() {
                store_proposals(indexer, proposals).await?;
            }
            if !votes.is_empty() {
                store_votes(indexer, votes).await?;
            }
        }
    }

    update_indexer_updated_at(indexer).await?;

    Ok(())
}

#[instrument]
fn get_proposals_indexer(indexer_variant: &IndexerVariant) -> Option<Box<dyn ProposalsIndexer>> {
    match indexer_variant {
        IndexerVariant::SnapshotProposals => Some(Box::new(SnapshotProposalsIndexer)),
        IndexerVariant::AaveV2MainnetProposals => Some(Box::new(AaveV2MainnetProposalsIndexer)),
        IndexerVariant::AaveV3MainnetProposals => Some(Box::new(AaveV3MainnetProposalsIndexer)),
        IndexerVariant::CompoundMainnetProposals => Some(Box::new(CompoundMainnetProposalsIndexer)),
        IndexerVariant::DydxMainnetProposals => Some(Box::new(DydxMainnetProposalsIndexer)),
        IndexerVariant::EnsMainnetProposals => Some(Box::new(EnsMainnetProposalsIndexer)),
        IndexerVariant::FraxAlphaMainnetProposals => {
            Some(Box::new(FraxAlphaMainnetProposalsIndexer))
        }
        IndexerVariant::FraxOmegaMainnetProposals => {
            Some(Box::new(FraxOmegaMainnetProposalsIndexer))
        }
        IndexerVariant::GitcoinMainnetProposals => Some(Box::new(GitcoinV1MainnetProposalsIndexer)),
        IndexerVariant::GitcoinV2MainnetProposals => {
            Some(Box::new(GitcoinV2MainnetProposalsIndexer))
        }
        IndexerVariant::HopMainnetProposals => Some(Box::new(HopMainnetProposalsIndexer)),
        IndexerVariant::MakerExecutiveMainnetProposals => {
            Some(Box::new(MakerExecutiveMainnetProposalsIndexer))
        }
        IndexerVariant::MakerPollMainnetProposals => {
            Some(Box::new(MakerPollMainnetProposalsIndexer))
        }
        IndexerVariant::NounsProposalsMainnetProposals => {
            Some(Box::new(NounsMainnetProposalsIndexer))
        }
        IndexerVariant::OpOptimismProposals => Some(Box::new(OptimismProposalsIndexer)),
        IndexerVariant::UniswapMainnetProposals => Some(Box::new(UniswapMainnetProposalsIndexer)),
        IndexerVariant::ArbCoreArbitrumProposals => Some(Box::new(ArbitrumCoreProposalsIndexer)),
        IndexerVariant::ArbTreasuryArbitrumProposals => {
            Some(Box::new(ArbitrumTreasuryProposalsIndexer))
        }
        _ => None,
    }
}

#[instrument]
fn get_votes_indexer(indexer_variant: &IndexerVariant) -> Option<Box<dyn VotesIndexer>> {
    match indexer_variant {
        IndexerVariant::SnapshotVotes => Some(Box::new(SnapshotVotesIndexer)),
        IndexerVariant::AaveV2MainnetVotes => Some(Box::new(AaveV2MainnetVotesIndexer)),
        IndexerVariant::AaveV3MainnetVotes => Some(Box::new(AaveV3MainnetVotesIndexer)),
        IndexerVariant::AaveV3PolygonVotes => Some(Box::new(AaveV3PolygonVotesIndexer)),
        IndexerVariant::AaveV3AvalancheVotes => Some(Box::new(AaveV3AvalancheVotesIndexer)),
        IndexerVariant::CompoundMainnetVotes => Some(Box::new(CompoundMainnetVotesIndexer)),
        IndexerVariant::DydxMainnetVotes => Some(Box::new(DydxMainnetVotesIndexer)),
        IndexerVariant::EnsMainnetVotes => Some(Box::new(EnsMainnetVotesIndexer)),
        IndexerVariant::FraxAlphaMainnetVotes => Some(Box::new(FraxAlphaMainnetVotesIndexer)),
        IndexerVariant::FraxOmegaMainnetVotes => Some(Box::new(FraxOmegaMainnetVotesIndexer)),
        IndexerVariant::GitcoinMainnetVotes => Some(Box::new(GitcoinV1MainnetVotesIndexer)),
        IndexerVariant::GitcoinV2MainnetVotes => Some(Box::new(GitcoinV2MainnetVotesIndexer)),
        IndexerVariant::HopMainnetVotes => Some(Box::new(HopMainnetVotesIndexer)),
        IndexerVariant::MakerExecutiveMainnetVotes => {
            Some(Box::new(MakerExecutiveMainnetVotesIndexer))
        }
        IndexerVariant::MakerPollMainnetVotes => Some(Box::new(MakerPollMainnetVotesIndexer)),
        IndexerVariant::MakerPollArbitrumVotes => Some(Box::new(MakerPollArbitrumVotesIndexer)),
        IndexerVariant::NounsProposalsMainnetVotes => Some(Box::new(NounsMainnetVotesIndexer)),
        IndexerVariant::OpOptimismVotes => Some(Box::new(OptimismVotesIndexer)),
        IndexerVariant::UniswapMainnetVotes => Some(Box::new(UniswapMainnetVotesIndexer)),
        IndexerVariant::ArbCoreArbitrumVotes => Some(Box::new(ArbitrumCoreVotesIndexer)),
        IndexerVariant::ArbTreasuryArbitrumVotes => Some(Box::new(ArbitrumTreasuryVotesIndexer)),
        _ => None,
    }
}

#[instrument]
fn get_proposals_and_votes_indexer(
    indexer_variant: &IndexerVariant,
) -> Option<Box<dyn indexer::ProposalsAndVotesIndexer>> {
    match indexer_variant {
        IndexerVariant::ArbitrumCouncilNominations => {
            Some(Box::new(ArbitrumCouncilNominationsProposalsAndVotesIndexer))
        }
        IndexerVariant::ArbitrumCouncilElections => {
            Some(Box::new(ArbitrumCouncilElectionsProposalsAndVotesIndexer))
        }
        _ => None,
    }
}

#[instrument]
fn get_voting_power_indexer(
    indexer_variant: &IndexerVariant,
) -> Option<Box<dyn VotingPowerIndexer>> {
    match indexer_variant {
        IndexerVariant::ArbArbitrumVotingPower => Some(Box::new(ArbitrumVotingPowerIndexer)),
        _ => None,
    }
}

#[instrument]
fn get_delegation_indexer(indexer_variant: &IndexerVariant) -> Option<Box<dyn DelegationIndexer>> {
    match indexer_variant {
        IndexerVariant::ArbArbitrumDelegation => Some(Box::new(ArbitrumDelegationsIndexer)),
        _ => None,
    }
}

#[instrument]
fn get_indexer(indexer_variant: &IndexerVariant) -> Box<dyn indexer::Indexer> {
    match indexer_variant {
        IndexerVariant::SnapshotProposals => Box::new(SnapshotProposalsIndexer),
        IndexerVariant::SnapshotVotes => Box::new(SnapshotVotesIndexer),
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
        IndexerVariant::NounsProposalsMainnetProposals => Box::new(NounsMainnetProposalsIndexer),
        IndexerVariant::NounsProposalsMainnetVotes => Box::new(NounsMainnetVotesIndexer),
        IndexerVariant::OpOptimismProposals => Box::new(OptimismProposalsIndexer),
        IndexerVariant::OpOptimismVotes => Box::new(OptimismVotesIndexer),
        IndexerVariant::UniswapMainnetProposals => Box::new(UniswapMainnetProposalsIndexer),
        IndexerVariant::UniswapMainnetVotes => Box::new(UniswapMainnetVotesIndexer),
        IndexerVariant::ArbCoreArbitrumProposals => Box::new(ArbitrumCoreProposalsIndexer),
        IndexerVariant::ArbCoreArbitrumVotes => Box::new(ArbitrumCoreVotesIndexer),
        IndexerVariant::ArbTreasuryArbitrumProposals => Box::new(ArbitrumTreasuryProposalsIndexer),
        IndexerVariant::ArbTreasuryArbitrumVotes => Box::new(ArbitrumTreasuryVotesIndexer),
        IndexerVariant::ArbArbitrumVotingPower => Box::new(ArbitrumVotingPowerIndexer),
        IndexerVariant::ArbArbitrumDelegation => Box::new(ArbitrumDelegationsIndexer),
        IndexerVariant::ArbitrumCouncilNominations => {
            Box::new(ArbitrumCouncilNominationsProposalsAndVotesIndexer)
        }
        IndexerVariant::ArbitrumCouncilElections => todo!(),
    }
}
