use crate::{
    extensions::snapshot_api::SnapshotProposal,
    rindexer_lib::typings::networks::get_ethereum_provider,
};
use alloy::primitives::Address;
use alloy_ens::ProviderEnsExt;
use anyhow::{Context, Result};
use chrono::Utc;
use once_cell::sync::{Lazy, OnceCell};
use proposalsapp_db::models::{
    dao, dao_governor, delegation, proposal, vote, voter, voting_power_timeseries,
};
use rindexer::provider::RindexerProvider;
use sea_orm::{
    ActiveValue::NotSet, ColumnTrait, Condition, DatabaseConnection, EntityTrait, QueryFilter, Set,
    prelude::Uuid, sea_query::OnConflict,
};
use std::{
    collections::{HashMap, HashSet},
    sync::{Arc, Mutex},
    time::Duration,
};
use tokio::sync::Semaphore;
use tracing::{debug, error, info, instrument, warn};

pub static DB: OnceCell<DatabaseConnection> = OnceCell::new();
pub static DAO_SLUG_ID_MAP: OnceCell<Mutex<HashMap<String, Uuid>>> = OnceCell::new();
pub static DAO_SLUG_GOVERNOR_TYPE_ID_MAP: OnceCell<Mutex<HashMap<String, HashMap<String, Uuid>>>> =
    OnceCell::new();
pub static DAO_SLUG_GOVERNOR_SPACE_MAP: Lazy<Mutex<HashMap<(String, String), String>>> =
    Lazy::new(|| {
        let mut map = HashMap::new();
        map.insert(
            ("arbitrum".to_string(), "ARBITRUM_SNAPSHOT".to_string()),
            "arbitrumfoundation.eth".to_string(),
        );
        map.insert(
            ("uniswap".to_string(), "UNISWAP_SNAPSHOT".to_string()),
            "uniswapgovernance.eth".to_string(),
        );
        // Add more mappings as needed
        Mutex::new(map)
    });

const BATCH_SIZE: usize = 100;

#[instrument(name = "db_initialize_db", skip_all)]
pub async fn initialize_db() -> Result<()> {
    let database_url =
        std::env::var("DATABASE_URL").context("DATABASE_URL environment variable not set")?;

    let mut opt = sea_orm::ConnectOptions::new(database_url);
    opt.max_connections(25) // Increased to handle concurrent indexing operations
        .min_connections(5)
        .connect_timeout(Duration::from_secs(15))
        .acquire_timeout(Duration::from_secs(30))
        .idle_timeout(Duration::from_secs(5 * 60))
        .max_lifetime(Duration::from_secs(30 * 60))
        .sqlx_logging(false);

    let db = sea_orm::Database::connect(opt)
        .await
        .context("Failed to connect to the database")?;

    DB.set(db)
        .map_err(|_| anyhow::anyhow!("Failed to set database connection"))?;
    info!("Database connection initialized successfully.");

    let governors = dao_governor::Entity::find()
        .all(
            DB.get()
                .ok_or_else(|| anyhow::anyhow!("DB not initialized"))?,
        )
        .await?;

    // Initialize and populate DAO_ID_SLUG_MAP
    let dao_slug_map = Mutex::new(HashMap::new());
    let daos = dao::Entity::find()
        .all(
            DB.get()
                .ok_or_else(|| anyhow::anyhow!("DB not initialized"))?,
        )
        .await?;
    for dao_model in daos.clone() {
        dao_slug_map
            .lock()
            .unwrap()
            .insert(dao_model.slug.clone(), dao_model.id);
        debug!(dao_slug = dao_model.slug, dao_id = %dao_model.id, "Loaded DAO");
    }
    DAO_SLUG_ID_MAP
        .set(dao_slug_map)
        .map_err(|_| anyhow::anyhow!("Failed to set DAO_ID_SLUG_MAP"))?;

    info!("DAO_ID_SLUG_MAP initialized with {} entries.", daos.len());

    // Initialize and populate DAO_SLUG_GOVERNOR_TYPE_ID_MAP
    let dao_slug_governor_type_id_map = Mutex::new(HashMap::new());
    for governor in governors {
        // Use governors and daos which were cloned earlier
        if let Some(dao_model) = daos.iter().find(|d| d.id == governor.dao_id) {
            let dao_slug = dao_model.slug.clone();
            let governor_type = governor.r#type.clone();
            let governor_id = governor.id;

            dao_slug_governor_type_id_map
                .lock()
                .unwrap()
                .entry(dao_slug)
                .or_insert_with(HashMap::new)
                .insert(governor_type, governor_id);

            debug!(
                dao_slug = dao_model.slug,
                governor_type = governor.r#type,
                governor_id = %governor.id,
                "Loaded DAO Slug Governor Type ID mapping"
            );
        } else {
            // Log a warning if a governor's dao_id doesn't match any DAO.
            warn!(
                governor_id = %governor.id,
                dao_id = %governor.dao_id,
                "DAO not found for governor. Skipping mapping."
            );
        }
    }

    DAO_SLUG_GOVERNOR_TYPE_ID_MAP
        .set(dao_slug_governor_type_id_map)
        .map_err(|_| anyhow::anyhow!("Failed to set DAO_SLUG_GOVERNOR_TYPE_ID_MAP"))?;

    info!("DAO_SLUG_GOVERNOR_TYPE_ID_MAP initialized.",);
    Ok(())
}

#[instrument(name = "db_store_proposal", skip(proposal))]
pub async fn store_proposal(proposal: proposal::ActiveModel) -> Result<()> {
    let db = DB
        .get()
        .ok_or_else(|| anyhow::anyhow!("DB not initialized"))?;

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
        .one(db)
        .await?;

    if let Some(existing) = existing_proposal {
        // Update existing proposal
        debug!(proposal_id = %existing.id, external_id = %external_id, "Updating existing proposal");
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
            block_start_at: Set(proposal
                .block_start_at
                .clone()
                .take()
                .unwrap_or(existing.block_start_at)),
            block_end_at: Set(proposal
                .block_end_at
                .clone()
                .take()
                .unwrap_or(existing.block_end_at)),
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

        proposal::Entity::update(active_model).exec(db).await?;
        info!(proposal_id = %existing.id, external_id = %external_id, "Proposal updated successfully");
    } else {
        // Insert new proposal
        debug!(external_id = %external_id, "Inserting new proposal");
        let inserted_proposal = proposal::Entity::insert(proposal.clone()).exec(db).await?;
        info!(proposal_id = %inserted_proposal.last_insert_id, external_id = %external_id, "Proposal inserted successfully");

        // No longer creating jobs for new proposals - the mapper handles all grouping now
    }

    Ok(())
}

#[instrument(name = "db_store_votes", skip(votes), fields(vote_count = votes.len()))]
pub async fn store_votes(votes: Vec<vote::ActiveModel>, governor_id: Uuid) -> Result<()> {
    let db = DB
        .get()
        .ok_or_else(|| anyhow::anyhow!("DB not initialized"))?;

    let proposal_external_ids: Vec<String> = votes
        .iter()
        .filter_map(|vote| vote.proposal_external_id.clone().take())
        .collect();

    if proposal_external_ids.is_empty() {
        return Err(anyhow::anyhow!(
            "No proposal_external_ids provided in votes"
        ));
    }

    let proposals_result = proposal::Entity::find()
        .filter(proposal::Column::ExternalId.is_in(proposal_external_ids.clone()))
        .filter(proposal::Column::GovernorId.eq(governor_id))
        .all(db)
        .await?;

    let proposal_map: HashMap<String, proposal::Model> = proposals_result
        .into_iter()
        .map(|p| (p.external_id.clone(), p.clone()))
        .collect();

    let voter_addresses: Vec<String> = votes
        .iter()
        .filter_map(|vote| vote.voter_address.clone().take())
        .collect();

    if voter_addresses.is_empty() {
        return Err(anyhow::anyhow!("No voter_addresses provided in votes"));
    }

    let voter_address_set: HashSet<String> = voter_addresses.into_iter().collect();

    // Store voters in background to avoid blocking vote storage
    info!(
        voter_count = voter_address_set.len(),
        "Starting voter storage in background"
    );
    let voter_storage_result = store_voters(voter_address_set).await;
    if let Err(e) = voter_storage_result {
        // Log error but don't fail vote storage
        error!(error = %e, "Failed to store voters, continuing with vote storage");
    }

    let mut vote_active_models = Vec::new();
    for vote in votes.clone() {
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
            dao_id: Set(proposal_model.dao_id),
            governor_id: Set(governor_id),
            proposal_id: Set(proposal_model.id),
            id: NotSet,
        };
        vote_active_models.push(vote_active_model);
    }

    // Process votes in chunks
    for chunk in vote_active_models.chunks(BATCH_SIZE) {
        // Use SeaORM's insert_many with on_conflict
        let insert_result = vote::Entity::insert_many(chunk.to_vec())
            .on_conflict(
                OnConflict::columns([
                    vote::Column::ProposalId,
                    vote::Column::VoterAddress,
                    vote::Column::Txid,
                ])
                .update_columns([
                    vote::Column::Choice,
                    vote::Column::VotingPower,
                    vote::Column::Reason,
                    vote::Column::CreatedAt,
                    vote::Column::BlockCreatedAt,
                ])
                .to_owned(),
            )
            .exec(db)
            .await;

        match insert_result {
            Ok(_) => {
                debug!(chunk_size = chunk.len(), "Successfully upserted vote chunk");
            }
            Err(err) => {
                error!(error = %err, chunk_size = chunk.len(), "Failed to bulk upsert votes");
                return Err(anyhow::anyhow!("Failed to bulk upsert votes: {}", err));
            }
        }
    }

    info!(
        "Successfully stored {} votes in bulk with upsert.",
        votes.len()
    );
    Ok(())
}

#[instrument(name = "db_store_delegations", skip(delegations), fields(delegation_count = delegations.len()))]
pub async fn store_delegations(delegations: Vec<delegation::ActiveModel>) -> Result<()> {
    if delegations.is_empty() {
        info!("No delegations provided to store.");
        return Ok(());
    }
    let total_delegations = delegations.len();

    let db = DB
        .get()
        .ok_or_else(|| anyhow::anyhow!("DB not initialized"))?;

    // Process delegations in chunks
    for chunk in delegations.chunks(BATCH_SIZE) {
        // Use SeaORM's insert_many with on_conflict
        let insert_result = delegation::Entity::insert_many(chunk.to_vec())
            .on_conflict(
                OnConflict::columns([
                    delegation::Column::Delegator,
                    delegation::Column::DaoId,
                    delegation::Column::Txid,
                ])
                .update_columns([
                    delegation::Column::Delegate,
                    delegation::Column::Timestamp,
                    delegation::Column::Block,
                ])
                .to_owned(),
            )
            .exec(db)
            .await;

        match insert_result {
            Ok(_) => {
                debug!(
                    chunk_size = chunk.len(),
                    "Successfully upserted delegation chunk"
                );
            }
            Err(err) => {
                error!(error = %err, chunk_size = chunk.len(), "Failed to bulk upsert delegations");
                return Err(anyhow::anyhow!(
                    "Failed to bulk upsert delegations: {}",
                    err
                ));
            }
        }
    }

    info!(
        "Successfully stored {} delegations in bulk with upsert.",
        total_delegations
    );
    Ok(())
}

#[instrument(name = "db_store_voting_powers", skip(voting_powers), fields(voting_power_count = voting_powers.len()))]
pub async fn store_voting_powers(
    voting_powers: Vec<voting_power_timeseries::ActiveModel>,
) -> Result<()> {
    if voting_powers.is_empty() {
        info!("No voting powers provided to store.");
        return Ok(());
    }
    let total_voting_powers = voting_powers.len();

    let db = DB
        .get()
        .ok_or_else(|| anyhow::anyhow!("DB not initialized"))?;

    // Process voting powers in chunks
    for chunk in voting_powers.chunks(BATCH_SIZE) {
        // Use SeaORM's insert_many with on_conflict
        let insert_result = voting_power_timeseries::Entity::insert_many(chunk.to_vec())
            .on_conflict(
                OnConflict::columns([
                    voting_power_timeseries::Column::Voter,
                    voting_power_timeseries::Column::DaoId,
                    voting_power_timeseries::Column::Txid,
                ])
                .update_columns([
                    voting_power_timeseries::Column::VotingPower,
                    voting_power_timeseries::Column::Timestamp,
                    voting_power_timeseries::Column::Block,
                ])
                .to_owned(),
            )
            .exec(db)
            .await;

        match insert_result {
            Ok(_) => {
                debug!(
                    chunk_size = chunk.len(),
                    "Successfully upserted voting power chunk"
                );
            }
            Err(err) => {
                error!(error = %err, chunk_size = chunk.len(), "Failed to bulk upsert voting powers");
                return Err(anyhow::anyhow!(
                    "Failed to bulk upsert voting powers: {}",
                    err
                ));
            }
        }
    }

    info!(
        "Successfully stored {} voting powers in bulk with upsert.",
        total_voting_powers
    );
    Ok(())
}

/// Maximum concurrent ENS lookups to avoid rate limiting
const ENS_CONCURRENCY_LIMIT: usize = 5;

/// Result of an ENS lookup operation
struct EnsLookupResult {
    address: String,
    ens: Option<String>,
    is_new_voter: bool,
    existing_voter_id: Option<Uuid>,
}

#[instrument(name = "db_store_voters", skip(voter_addresses), fields(voter_address_count = voter_addresses.len()))]
async fn store_voters(voter_addresses: HashSet<String>) -> Result<()> {
    let db = DB
        .get()
        .ok_or_else(|| anyhow::anyhow!("DB not initialized"))?;

    // Get the provider once at the beginning to reuse throughout the function
    let provider = get_ethereum_provider().await;

    let voter_list: Vec<String> = voter_addresses.into_iter().collect();
    let total_voters = voter_list.len();
    info!(
        total_voters = total_voters,
        "Starting voter storage with ENS lookups"
    );

    // Semaphore to limit concurrent ENS lookups to avoid rate limiting
    let semaphore = Arc::new(Semaphore::new(ENS_CONCURRENCY_LIMIT));

    for (chunk_index, addresses_chunk) in voter_list.chunks(BATCH_SIZE).enumerate() {
        let chunk_start = chunk_index * BATCH_SIZE;
        let chunk_end = std::cmp::min(chunk_start + BATCH_SIZE, total_voters);
        info!(
            chunk = chunk_index + 1,
            chunk_size = addresses_chunk.len(),
            progress = format!("{}/{}", chunk_end, total_voters),
            "Processing voter chunk with ENS lookups"
        );

        // Fetch existing voters with address and ens in a single query
        let existing_voters_models: Vec<voter::Model> = voter::Entity::find()
            .filter(voter::Column::Address.is_in(addresses_chunk.to_vec()))
            .all(db)
            .await?;

        // Create a HashMap of existing voters for quick lookup
        let existing_voters_map: HashMap<String, voter::Model> = existing_voters_models
            .into_iter()
            .map(|v| (v.address.clone(), v))
            .collect();

        // Collect addresses that need ENS lookup
        let twenty_four_hours_ago = Utc::now() - Duration::from_secs(24 * 60 * 60);
        let mut ens_lookup_tasks = Vec::new();

        for address in addresses_chunk {
            let existing_voter = existing_voters_map.get(address);

            // Skip if voter was updated recently
            if let Some(voter) = existing_voter {
                if voter.updated_at > twenty_four_hours_ago.naive_utc() {
                    debug!(
                        address = address,
                        "Voter updated recently, skipping ENS lookup"
                    );
                    continue;
                }
            }

            // Parse address
            let eth_address = match address.parse::<Address>() {
                Ok(addr) => addr,
                Err(e) => {
                    debug!(address = address, error = %e, "Failed to parse address");
                    // For new voters with invalid addresses, still insert them without ENS
                    if existing_voter.is_none() {
                        ens_lookup_tasks.push(tokio::spawn(async move {
                            EnsLookupResult {
                                address: address.clone(),
                                ens: None,
                                is_new_voter: true,
                                existing_voter_id: None,
                            }
                        }));
                    }
                    continue;
                }
            };

            // Prepare ENS lookup task with rate limiting via semaphore
            let sem = semaphore.clone();
            let prov = provider.clone();
            let addr_clone = address.clone();
            let is_new = existing_voter.is_none();
            let voter_id = existing_voter.map(|v| v.id);
            let old_ens = existing_voter.and_then(|v| v.ens.clone());

            let task = tokio::spawn(async move {
                // Acquire semaphore permit to limit concurrency
                let _permit = sem.acquire().await.expect("Semaphore closed");

                // Try ENS lookup with timeout
                let ens_result = match tokio::time::timeout(
                    std::time::Duration::from_secs(5),
                    isolated_ens_lookup(eth_address, addr_clone.clone(), prov),
                )
                .await
                {
                    Ok(result) => result.ok(),
                    Err(_) => {
                        debug!(address = addr_clone, "ENS lookup timed out");
                        None
                    }
                };

                // Only update if ENS changed (for existing voters)
                let should_update = if is_new {
                    true
                } else {
                    ens_result.is_some() && ens_result != old_ens
                };

                if should_update {
                    EnsLookupResult {
                        address: addr_clone,
                        ens: ens_result,
                        is_new_voter: is_new,
                        existing_voter_id: voter_id,
                    }
                } else {
                    EnsLookupResult {
                        address: addr_clone,
                        ens: None,
                        is_new_voter: false,
                        existing_voter_id: None, // Signal no update needed
                    }
                }
            });

            ens_lookup_tasks.push(task);
        }

        // Wait for all ENS lookups to complete (with controlled concurrency)
        let lookup_results: Vec<EnsLookupResult> = futures::future::join_all(ens_lookup_tasks)
            .await
            .into_iter()
            .filter_map(|r| r.ok())
            .collect();

        info!(
            completed_lookups = lookup_results.len(),
            "Completed ENS lookups for chunk"
        );

        // Separate results into inserts and updates
        let mut voters_to_insert: Vec<voter::ActiveModel> = Vec::new();
        let mut voters_to_update: Vec<voter::ActiveModel> = Vec::new();

        for result in lookup_results {
            if result.is_new_voter {
                voters_to_insert.push(voter::ActiveModel {
                    id: NotSet,
                    address: Set(result.address),
                    ens: if result.ens.is_some() {
                        Set(result.ens)
                    } else {
                        NotSet
                    },
                    avatar: NotSet,
                    updated_at: Set(Utc::now().naive_utc()),
                });
            } else if let Some(voter_id) = result.existing_voter_id {
                // Only update if we have a voter_id (means ENS changed)
                if let Some(ens) = result.ens {
                    debug!(
                        address = result.address,
                        new_ens = ens,
                        "Updating ENS for existing voter"
                    );
                    voters_to_update.push(voter::ActiveModel {
                        id: Set(voter_id),
                        address: NotSet,
                        ens: Set(Some(ens)),
                        avatar: NotSet,
                        updated_at: Set(Utc::now().naive_utc()),
                    });
                }
            }
        }

        // Perform bulk insert for new voters
        if !voters_to_insert.is_empty() {
            info!(
                insert_count = voters_to_insert.len(),
                "Inserting new voters"
            );
            for voter_model in voters_to_insert {
                if let Err(e) = voter::Entity::insert(voter_model).exec(db).await {
                    // Log but continue if a voter already exists
                    debug!(error = %e, "Failed to insert voter (may already exist)");
                }
            }
        }

        // Perform bulk update for existing voters with new ENS
        if !voters_to_update.is_empty() {
            info!(
                update_count = voters_to_update.len(),
                "Updating existing voters with new ENS"
            );
            for voter_update in voters_to_update {
                let update_result = voter::Entity::update(voter_update).exec(db).await;
                if let Err(e) = update_result {
                    error!(error = %e, "Failed to update voter ENS");
                } else {
                    debug!("Voter ENS updated");
                }
            }
        }
    }

    Ok(())
}

#[instrument(name = "db_isolated_ens_lookup", skip(address, provider, addr_string), fields(address = %address))]
async fn isolated_ens_lookup(
    address: Address,
    addr_string: String,
    provider: Arc<RindexerProvider>,
) -> Result<String> {
    // Spawn a task to isolate potential panics
    match tokio::task::spawn(async move { provider.lookup_address(&address).await }).await {
        Ok(result) => match result {
            Ok(ens) => {
                debug!(ens_name = ens, "ENS lookup successful");
                Ok(ens)
            }
            Err(e) => {
                debug!(error = %e, "ENS lookup error");
                Err(anyhow::anyhow!("ENS lookup error: {}", e))
            }
        },
        Err(e) => {
            warn!(
                address = addr_string,
                error = %e,
                "Task error during ENS lookup"
            );
            // This happens if the task panicked
            Err(anyhow::anyhow!("Task error during ENS lookup: {}", e))
        }
    }
}

// #[instrument(name = "db_isolated_avatar_resolve", skip(ens, provider, addr_string),
// fields(ens_name = ens))] async fn isolated_avatar_resolve(ens: String, addr_string: String,
// provider: Arc<RindexerProvider>) -> Result<String> {     // Spawn a task to isolate potential
// panics     match tokio::task::spawn(async move { provider.resolve_avatar(&ens).await }).await {
//         Ok(result) => match result {
//             Ok(avatar) => {
//                 debug!(avatar_url = %avatar, "Avatar resolution successful");
//                 Ok(avatar.to_string())
//             }
//             Err(e) => {
//                 debug!(error = %e, "Avatar resolution error");
//                 Err(anyhow::anyhow!("Avatar resolution error: {}", e))
//             }
//         },
//         Err(e) => {
//             warn!(
//                 address = addr_string,
//                 error = %e,
//                 "Task error during avatar resolution"
//             );
//             // This happens if the task panicked
//             Err(anyhow::anyhow!(
//                 "Task error during avatar resolution: {}",
//                 e
//             ))
//         }
//     }
// }

/// Store a Snapshot proposal (wrapper around store_proposal for SnapshotProposal)
#[instrument(name = "store_snapshot_proposal", skip(proposal))]
pub async fn store_snapshot_proposal(
    proposal: SnapshotProposal,
    governor_id: Uuid,
    dao_id: Uuid,
) -> Result<()> {
    use chrono::DateTime;
    use proposalsapp_db::models::sea_orm_active_enums::ProposalState;
    use sea_orm::{ActiveValue::NotSet, Set};
    use serde_json::Value;

    // Convert timestamps from seconds to DateTime
    let created_at = DateTime::from_timestamp(proposal.created, 0)
        .ok_or_else(|| anyhow::anyhow!("Invalid created timestamp"))?
        .naive_utc();
    let start_at = DateTime::from_timestamp(proposal.start, 0)
        .ok_or_else(|| anyhow::anyhow!("Invalid start timestamp"))?
        .naive_utc();
    let end_at = DateTime::from_timestamp(proposal.end, 0)
        .ok_or_else(|| anyhow::anyhow!("Invalid end timestamp"))?
        .naive_utc();

    // Convert state string to ProposalState enum (matching old logic)
    let proposal_state = match proposal.state.as_str() {
        "pending" if proposal.privacy == "shutter" => ProposalState::Hidden,
        "active" => ProposalState::Active,
        "pending" => ProposalState::Pending,
        "closed" => {
            if proposal.scores_state == "final" {
                ProposalState::Executed
            } else {
                ProposalState::Defeated
            }
        }
        "cancelled" => ProposalState::Canceled,
        _ => ProposalState::Unknown,
    };

    // Create metadata JSON (matching old structure)
    let mut metadata = serde_json::json!({
        "vote_type": proposal.proposal_type,
        "scores_state": proposal.scores_state
    });

    if let Some(votes) = proposal.votes {
        metadata["snapshot_vote_count"] = Value::from(votes);
    }

    if proposal.privacy == "shutter" {
        metadata["hidden_vote"] = Value::from(true);
    }

    let proposal_active_model = proposal::ActiveModel {
        id: NotSet,
        external_id: Set(proposal.id),
        name: Set(proposal.title),
        body: Set(proposal.body),
        url: Set(proposal.link), // Use the actual link field from API
        discussion_url: Set(if proposal.discussion.is_empty() {
            None
        } else {
            Some(proposal.discussion)
        }),
        choices: Set(serde_json::to_value(proposal.choices)?),
        quorum: Set(proposal.quorum),
        proposal_state: Set(proposal_state),
        marked_spam: Set(proposal.flagged.unwrap_or(false)),
        created_at: Set(created_at),
        start_at: Set(start_at),
        end_at: Set(end_at),
        block_created_at: NotSet,
        block_start_at: NotSet,
        block_end_at: NotSet,
        txid: Set(Some(proposal.ipfs)),
        metadata: Set(Some(metadata)),
        dao_id: Set(dao_id),
        author: Set(Some(proposal.author)),
        governor_id: Set(governor_id),
    };

    store_proposal(proposal_active_model).await
}
