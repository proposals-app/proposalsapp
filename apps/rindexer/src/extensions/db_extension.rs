use crate::rindexer_lib::typings::networks::get_ethereum_provider_cache;
use anyhow::{Context, Result};
use ethers::{providers::Middleware, types::Address};
use once_cell::sync::{Lazy, OnceCell};
use proposalsapp_db_indexer::models::{dao, dao_governor, delegation, job_queue, proposal, vote, voter, voting_power};
use sea_orm::{ActiveValue::NotSet, ColumnTrait, Condition, DatabaseConnection, DatabaseTransaction, EntityTrait, InsertResult, QueryFilter, Set, TransactionTrait, prelude::Uuid, sea_query::OnConflict};
use std::{
    collections::{HashMap, HashSet},
    sync::Mutex,
    time::Duration,
};
use tracing::{debug, error, info, instrument, warn};
use utils::types::{JobData, ProposalJobData};

pub static DB: OnceCell<DatabaseConnection> = OnceCell::new();
pub static DAO_SLUG_ID_MAP: OnceCell<Mutex<HashMap<String, Uuid>>> = OnceCell::new();
pub static DAO_SLUG_GOVERNOR_TYPE_ID_MAP: OnceCell<Mutex<HashMap<String, HashMap<String, Uuid>>>> = OnceCell::new();
pub static DAO_SLUG_GOVERNOR_SPACE_MAP: Lazy<Mutex<HashMap<(String, String), String>>> = Lazy::new(|| {
    let mut map = HashMap::new();
    map.insert(
        ("arbitrum".to_string(), "ARBITRUM_SNAPSHOT".to_string()),
        "arbitrumfoundation.eth".to_string(),
    );
    // Add more mappings as needed
    Mutex::new(map)
});

const BATCH_SIZE: usize = 100;

#[instrument(name = "db_initialize_db", skip_all)]
pub async fn initialize_db() -> Result<()> {
    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL environment variable not set")?;

    let mut opt = sea_orm::ConnectOptions::new(database_url);
    opt.max_connections(25)
        .min_connections(5)
        .connect_timeout(Duration::from_secs(5))
        .acquire_timeout(Duration::from_secs(8))
        .idle_timeout(Duration::from_secs(10 * 60))
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

        proposal::Entity::update(active_model).exec(&txn).await?;
        info!(proposal_id = %existing.id, external_id = %external_id, "Proposal updated successfully");
    } else {
        // Insert new proposal
        debug!(external_id = %external_id, "Inserting new proposal");
        let inserted_proposal = proposal::Entity::insert(proposal.clone())
            .exec(&txn)
            .await?;
        info!(proposal_id = %inserted_proposal.last_insert_id, external_id = %external_id, "Proposal inserted successfully");

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
            debug!("Snapshot discussion details job enqueued");
        }
    }

    txn.commit().await?;
    Ok(())
}

#[instrument(name = "db_store_votes", skip(votes), fields(vote_count = votes.len()))]
pub async fn store_votes(votes: Vec<vote::ActiveModel>, governor_id: Uuid) -> Result<()> {
    let db = DB
        .get()
        .ok_or_else(|| anyhow::anyhow!("DB not initialized"))?;
    let txn = db.begin().await?;

    let proposal_external_ids: Vec<String> = votes
        .iter()
        .filter_map(|vote| vote.proposal_external_id.clone().take())
        .collect();

    if proposal_external_ids.is_empty() {
        txn.rollback().await?;
        return Err(anyhow::anyhow!(
            "No proposal_external_ids provided in votes"
        ));
    }

    let proposals_result = proposal::Entity::find()
        .filter(proposal::Column::ExternalId.is_in(proposal_external_ids.clone()))
        .filter(proposal::Column::GovernorId.eq(governor_id))
        .all(&txn)
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
        txn.rollback().await?;
        return Err(anyhow::anyhow!("No voter_addresses provided in votes"));
    }

    let voter_address_set: HashSet<String> = voter_addresses.into_iter().collect();
    store_voters(&txn, voter_address_set).await?;

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
            dao_id: vote.dao_id.clone(),
            governor_id: vote.governor_id.clone(),
            proposal_id: Set(proposal_model.id),
            id: NotSet,
        };
        vote_active_models.push(vote_active_model);
    }

    for chunk in vote_active_models.chunks(BATCH_SIZE) {
        let result: Result<InsertResult<vote::ActiveModel>, sea_orm::DbErr> = vote::Entity::insert_many(chunk.to_vec())
            .on_conflict(
                OnConflict::columns([
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
            error!(error = %err, "Failed to insert vote chunk, transaction rolled back.");
            return Err(err.into());
        }
    }

    txn.commit().await?;
    info!("Successfully stored {} votes in chunk.", votes.len());
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
    let txn = db.begin().await?;

    for chunk in delegations.chunks(BATCH_SIZE) {
        let result = delegation::Entity::insert_many(chunk.to_vec())
            .on_conflict(OnConflict::new().do_nothing().to_owned())
            .exec(&txn)
            .await;

        if let Err(err) = result {
            error!(error = %err, count = chunk.len(), "Failed to insert delegation chunk, rolling back transaction.");
            txn.rollback().await?;
            return Err(err.into());
        } else {
            debug!(
                count = chunk.len(),
                "Delegation chunk inserted successfully."
            );
        }
    }

    txn.commit().await?;
    info!("Successfully processed {} delegations.", total_delegations);
    Ok(())
}

#[instrument(name = "db_store_voting_powers", skip(voting_powers), fields(voting_power_count = voting_powers.len()))]
pub async fn store_voting_powers(voting_powers: Vec<voting_power::ActiveModel>) -> Result<()> {
    if voting_powers.is_empty() {
        info!("No voting powers provided to store.");
        return Ok(());
    }
    let total_voting_powers = voting_powers.len();

    let db = DB
        .get()
        .ok_or_else(|| anyhow::anyhow!("DB not initialized"))?;
    let txn = db.begin().await?;

    for chunk in voting_powers.chunks(BATCH_SIZE) {
        let result = voting_power::Entity::insert_many(chunk.to_vec())
            .on_conflict(OnConflict::new().do_nothing().to_owned())
            .exec(&txn)
            .await;

        if let Err(err) = result {
            error!(error = %err, count = chunk.len(), "Failed to insert/update voting power chunk, rolling back transaction.");
            txn.rollback().await?;
            return Err(err.into());
        } else {
            debug!(
                count = chunk.len(),
                "Voting power chunk processed successfully."
            );
        }
    }

    txn.commit().await?;
    info!(
        "Successfully processed {} voting powers.",
        total_voting_powers
    );
    Ok(())
}

#[instrument(name = "db_store_voters", skip(txn, voter_addresses), fields(voter_address_count = voter_addresses.len()))]
async fn store_voters(txn: &DatabaseTransaction, voter_addresses: HashSet<String>) -> Result<()> {
    // Get the provider once at the beginning to reuse throughout the function
    let provider = get_ethereum_provider_cache().get_inner_provider();

    for addresses_chunk in voter_addresses
        .into_iter()
        .collect::<Vec<_>>()
        .chunks(BATCH_SIZE)
    {
        // Fetch existing voters with address and ens
        let existing_voters_models: Vec<voter::Model> = voter::Entity::find()
            .filter(voter::Column::Address.is_in(addresses_chunk.to_vec()))
            .all(txn)
            .await?;

        // Create a HashMap of existing voters for quick lookup
        let existing_voters_map: HashMap<String, voter::Model> = existing_voters_models
            .into_iter()
            .map(|v| (v.address.clone(), v))
            .collect();

        let mut voters_to_insert: Vec<voter::ActiveModel> = Vec::new();
        let mut voters_to_update: Vec<voter::ActiveModel> = Vec::new();

        for address in addresses_chunk {
            if let Some(existing_voter) = existing_voters_map.get(address) {
                // Voter exists, check and update ENS and Avatar if needed
                let addr_clone = address.clone();

                // Safely convert address string to Address type
                let eth_address = match addr_clone.parse::<Address>() {
                    Ok(addr) => addr,
                    Err(e) => {
                        debug!(address = addr_clone, error = %e, "Failed to parse address");
                        continue; // Skip this address and move to the next one
                    }
                };

                // Try to do ENS lookup with timeout
                let ens_result = match tokio::time::timeout(
                    std::time::Duration::from_secs(5),
                    isolated_ens_lookup(eth_address, addr_clone.clone(), provider.clone()),
                )
                .await
                {
                    Ok(result) => result,
                    Err(_) => {
                        debug!(address = addr_clone, "ENS lookup timed out");
                        continue;
                    }
                };

                if let Ok(fetched_ens) = ens_result {
                    let mut needs_update = false;
                    let mut updated_ens: Option<String> = None;
                    let mut updated_avatar: Option<String> = None;

                    if existing_voter.ens != Some(fetched_ens.clone()) {
                        debug!(
                            address = address,
                            old_ens = existing_voter.ens,
                            new_ens = fetched_ens,
                            "Updating ENS for address"
                        );
                        updated_ens = Some(fetched_ens.clone());
                        needs_update = true;
                    }

                    // Try to resolve avatar with timeout
                    let avatar_result = match tokio::time::timeout(
                        std::time::Duration::from_secs(5),
                        isolated_avatar_resolve(fetched_ens.clone(), addr_clone.clone(), provider.clone()),
                    )
                    .await
                    {
                        Ok(result) => result,
                        Err(_) => {
                            debug!(
                                address = addr_clone,
                                ens = fetched_ens,
                                "Avatar resolution timed out"
                            );
                            Err(anyhow::anyhow!("Avatar resolution timed out"))
                        }
                    };

                    if let Ok(avatar_url) = avatar_result {
                        if existing_voter.avatar != Some(avatar_url.clone()) {
                            debug!(
                                address = address,
                                old_avatar = existing_voter.avatar,
                                new_avatar = avatar_url,
                                "Updating avatar for address"
                            );
                            updated_avatar = Some(avatar_url);
                            needs_update = true;
                        }
                    }

                    if needs_update {
                        let mut voter_active_model = voter::ActiveModel {
                            id: Set(existing_voter.id),
                            address: NotSet,
                            ens: NotSet,
                            avatar: NotSet,
                        };
                        if let Some(ens) = updated_ens {
                            voter_active_model.ens = Set(Some(ens));
                        }
                        if let Some(avatar) = updated_avatar {
                            voter_active_model.avatar = Set(Some(avatar));
                        }
                        voters_to_update.push(voter_active_model);
                    }
                } else if let Err(e) = ens_result {
                    debug!(address = addr_clone, error = %e, "ENS lookup failed");
                    // Do not update ENS or Avatar if ENS lookup fails
                }
            } else {
                // Voter does not exist, perform ENS and Avatar lookup and prepare for insert
                let addr_clone = address.clone();

                // Safely convert address string to Address type
                let eth_address = match addr_clone.parse::<Address>() {
                    Ok(addr) => addr,
                    Err(e) => {
                        debug!(address = addr_clone, error = %e, "Failed to parse address for new voter");
                        // Add the voter with just the address since we couldn't resolve ENS
                        voters_to_insert.push(voter::ActiveModel {
                            id: NotSet,
                            address: Set(address.clone()),
                            ens: NotSet,
                            avatar: NotSet,
                        });
                        continue; // Continue to the next address
                    }
                };

                // Try to do ENS lookup with timeout
                let ens_result = match tokio::time::timeout(
                    std::time::Duration::from_secs(5),
                    isolated_ens_lookup(eth_address, addr_clone.clone(), provider.clone()),
                )
                .await
                {
                    Ok(result) => result,
                    Err(_) => {
                        debug!(address = addr_clone, "ENS lookup timed out for new voter");
                        // Just add the voter with the address
                        voters_to_insert.push(voter::ActiveModel {
                            id: NotSet,
                            address: Set(address.clone()),
                            ens: NotSet,
                            avatar: NotSet,
                        });
                        continue;
                    }
                };

                if let Ok(ens) = ens_result {
                    // Try to resolve avatar with timeout
                    let avatar_result = match tokio::time::timeout(
                        std::time::Duration::from_secs(5),
                        isolated_avatar_resolve(ens.clone(), addr_clone.clone(), provider.clone()),
                    )
                    .await
                    {
                        Ok(result) => result,
                        Err(_) => {
                            debug!(
                                address = addr_clone,
                                ens = ens,
                                "Avatar resolution timed out for new voter"
                            );
                            Err(anyhow::anyhow!("Avatar resolution timed out"))
                        }
                    };

                    let avatar = match avatar_result {
                        Ok(avatar_url) => Some(avatar_url),
                        Err(e) => {
                            debug!(address = addr_clone, ens = ens, error = %e, "Avatar resolution error for new voter");
                            None
                        }
                    };

                    voters_to_insert.push(voter::ActiveModel {
                        id: NotSet,
                        address: Set(address.clone()),
                        ens: Set(Some(ens)),
                        avatar: Set(avatar),
                    });
                } else if let Err(e) = ens_result {
                    debug!(address = addr_clone, error = %e, "ENS lookup failed for new voter");
                    // Just add the voter with the address
                    voters_to_insert.push(voter::ActiveModel {
                        id: NotSet,
                        address: Set(address.clone()),
                        ens: NotSet,
                        avatar: NotSet,
                    });
                }
            }
        }

        // Perform bulk insert for new voters
        if !voters_to_insert.is_empty() {
            let insert_result = voter::Entity::insert_many(voters_to_insert)
                .on_conflict(OnConflict::new().do_nothing().to_owned())
                .exec(txn)
                .await;
            if let Err(e) = insert_result {
                error!(error = %e, "Bulk insert of new voters failed");
            } else {
                debug!(count = ?insert_result.as_ref(), "Bulk insert of new voters completed");
            }
        }

        // Perform bulk update for existing voters with new ENS and/or Avatar
        if !voters_to_update.is_empty() {
            for voter_update in voters_to_update.into_iter() {
                let update_result = voter::Entity::update(voter_update).exec(txn).await;
                if let Err(e) = update_result {
                    error!(error = %e, "Failed to update voter ENS/Avatar");
                } else {
                    debug!("Voter ENS/Avatar updated");
                }
            }
        }
    }

    Ok(())
}

#[instrument(name = "db_isolated_ens_lookup", skip(address, provider, addr_string), fields(address = %address))]
async fn isolated_ens_lookup<M: Middleware + 'static>(address: Address, addr_string: String, provider: M) -> Result<String> {
    // Spawn a task to isolate potential panics
    match tokio::task::spawn(async move { provider.lookup_address(address).await }).await {
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

#[instrument(name = "db_isolated_avatar_resolve", skip(ens, provider, addr_string), fields(ens_name = ens))]
async fn isolated_avatar_resolve<M: Middleware + 'static>(ens: String, addr_string: String, provider: M) -> Result<String> {
    // Spawn a task to isolate potential panics
    match tokio::task::spawn(async move { provider.resolve_avatar(&ens).await }).await {
        Ok(result) => match result {
            Ok(avatar) => {
                debug!(avatar_url = %avatar, "Avatar resolution successful");
                Ok(avatar.to_string())
            }
            Err(e) => {
                debug!(error = %e, "Avatar resolution error");
                Err(anyhow::anyhow!("Avatar resolution error: {}", e))
            }
        },
        Err(e) => {
            warn!(
                address = addr_string,
                error = %e,
                "Task error during avatar resolution"
            );
            // This happens if the task panicked
            Err(anyhow::anyhow!(
                "Task error during avatar resolution: {}",
                e
            ))
        }
    }
}
