use alloy::primitives::Address;
use anyhow::{Context, Result};
use chrono::{Duration, Utc};
use proposalsapp_db::models::{
    dao, dao_discourse, delegate, delegate_to_discourse_user, delegate_to_voter, discourse_user,
    voter,
};
use reqwest::Client;
use sea_orm::{
    prelude::{Expr, Uuid},
    ActiveValue::NotSet,
    ColumnTrait, EntityTrait, IntoActiveModel, QueryFilter, Set, TransactionTrait,
};
use serde::Deserialize;
use std::collections::HashMap;
use tokio::time::{sleep, Instant};
use tracing::{error, info, instrument, warn, Span};

use crate::{metrics::METRICS, DB};

#[derive(Debug, Deserialize)]
struct KarmaApiResponse {
    data: KarmaApiData,
}

#[derive(Debug, Deserialize)]
struct KarmaApiData {
    delegates: Vec<KarmaDelegate>,
}

#[derive(Debug, Deserialize)]
struct KarmaDelegate {
    #[serde(rename = "publicAddress")]
    public_address: String,
    #[serde(rename = "ensName")]
    ens_name: Option<String>,
    #[serde(rename = "discourseHandle")]
    discourse_handle: Option<String>,
    #[serde(rename = "isForumVerified")]
    is_forum_verified: bool,
}

// Static mapping from dao.slug to karma_dao_name
lazy_static::lazy_static! {
    static ref DAO_SLUG_TO_KARMA_DAO_NAME: HashMap<&'static str, &'static str> = {
        let mut map = HashMap::new();
        map.insert("arbitrum", "arbitrum");
        // Add more mappings as needed
        map
    };
}

pub async fn run_karma_task() -> Result<()> {
    let interval = Duration::minutes(30);
    let mut next_tick =
        Instant::now() + std::time::Duration::from_secs(interval.num_seconds() as u64);

    loop {
        let start_time = Instant::now();
        if let Err(e) = fetch_karma_data().await {
            error!(error = %e, "Error fetching karma data");
            METRICS.get().unwrap().karma_fetch_errors.add(1, &[]);
        }
        METRICS
            .get()
            .unwrap()
            .karma_fetch_duration
            .record(start_time.elapsed().as_secs_f64(), &[]);

        sleep(next_tick.saturating_duration_since(Instant::now())).await;
        next_tick += std::time::Duration::from_secs(interval.num_seconds() as u64);
    }
}

#[instrument]
async fn fetch_karma_data() -> Result<()> {
    let client = Client::new();
    let daos = fetch_daos_with_discourse().await?;

    for (dao, maybe_dao_discourse) in daos {
        let span = Span::current();
        span.record("dao_slug", &dao.slug);

        if let Some(discourse) = maybe_dao_discourse {
            if let Some(karma_dao_name) = DAO_SLUG_TO_KARMA_DAO_NAME.get(dao.slug.as_str()) {
                let mut offset = 0;
                let page_size = 10; // Adjust this if the API allows a different page size
                let mut all_delegates = Vec::new();

                loop {
                    let url = format!(
                        "https://api.karmahq.xyz/api/dao/delegates?name={}&offset={}&order=desc&field=score&period=lifetime&pageSize={}&statuses=active,inactive,withdrawn,recognized",
                        karma_dao_name, offset, page_size
                    );

                    let body = fetch_json_data(&client, &url, &dao.slug).await?;
                    let delegates = parse_json_data(&body, &dao.slug)?;

                    if delegates.is_empty() {
                        break; // No more delegates to fetch
                    }

                    all_delegates.extend(delegates);
                    offset += 1;
                }

                // Checksumming all delegate addresses
                for delegate in &mut all_delegates {
                    let address: Address = delegate.public_address.parse()?;
                    delegate.public_address = address.to_checksum(None);
                }

                update_delegates_ens(&all_delegates).await?;

                METRICS
                    .get()
                    .unwrap()
                    .karma_delegates_processed
                    .add(all_delegates.len() as u64, &[]);

                let delegates_with_forum_handle: Vec<&KarmaDelegate> = all_delegates
                    .iter()
                    .filter(|d| d.discourse_handle.is_some())
                    .collect();

                info!("{:?}", delegates_with_forum_handle);

                info!("{:?}", delegates_with_forum_handle.len());

                for delegate in &delegates_with_forum_handle {
                    update_delegate(&dao, delegate, discourse.id).await?;
                }
            } else {
                warn!(
                    slug = %dao.slug,
                    "No dao_discourse mapping found for this slug"
                );
            }
        }
    }

    Ok(())
}

async fn fetch_daos_with_discourse() -> Result<Vec<(dao::Model, Option<dao_discourse::Model>)>> {
    dao::Entity::find()
        .find_with_related(dao_discourse::Entity)
        .all(DB.get().unwrap())
        .await
        .context("Failed to fetch DAOs with discourse information")
        .map(|daos| {
            daos.into_iter()
                .map(|(dao, discourse)| (dao, discourse.into_iter().next()))
                .collect()
        })
}

async fn fetch_json_data(client: &Client, url: &str, dao_slug: &str) -> Result<String> {
    const MAX_RETRIES: u32 = 3;
    const INITIAL_RETRY_DELAY: Duration = Duration::seconds(1);

    let mut retry_count = 0;
    let mut retry_delay = INITIAL_RETRY_DELAY;

    loop {
        let response = match client
            .get(url)
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await
        {
            Ok(res) => res,
            Err(e) if e.is_timeout() || e.is_connect() => {
                if retry_count < MAX_RETRIES {
                    warn!(
                        "Network error for DAO: {}. Error: {}. Retrying in {:?}... (Attempt {}/{})",
                        dao_slug,
                        e,
                        retry_delay,
                        retry_count + 1,
                        MAX_RETRIES
                    );
                    sleep(std::time::Duration::from_secs(
                        retry_delay.num_seconds() as u64
                    ))
                    .await;
                    retry_count += 1;
                    retry_delay = retry_delay * 2; // Exponential backoff
                    continue;
                } else {
                    return Err(anyhow::anyhow!(
                        "Failed to fetch JSON data for DAO: {} due to network error: {}",
                        dao_slug,
                        e
                    ));
                }
            }
            Err(e) => {
                return Err(e)
                    .with_context(|| format!("Failed to fetch JSON data for DAO: {}", dao_slug))
            }
        };

        let status = response.status();
        let headers = response.headers().clone();

        if status.is_success() {
            return response.text().await.with_context(|| {
                format!(
                    "Failed to read JSON response body for DAO: {}. Status: {}, URL: {}",
                    dao_slug, status, url
                )
            });
        } else if status.is_server_error() && retry_count < MAX_RETRIES {
            warn!(
                "Server error for DAO: {}. Status: {}. Retrying in {:?}... (Attempt {}/{})",
                dao_slug,
                status,
                retry_delay,
                retry_count + 1,
                MAX_RETRIES
            );
            sleep(std::time::Duration::from_secs(
                retry_delay.num_seconds() as u64
            ))
            .await;
            retry_count += 1;
            retry_delay = retry_delay * 2; // Exponential backoff
        } else {
            let headers_str = format!("{:?}", headers);
            return Err(anyhow::anyhow!(
                "Failed to fetch JSON data for DAO: {}. Status: {}, URL: {}, Headers: {}",
                dao_slug,
                status,
                url,
                headers_str
            ));
        }
    }
}

fn parse_json_data(body: &str, dao_slug: &str) -> Result<Vec<KarmaDelegate>> {
    let response: KarmaApiResponse = serde_json::from_str(body)
        .with_context(|| format!("Failed to parse JSON for DAO: {}", dao_slug))?;

    Ok(response.data.delegates)
}

#[instrument(skip( dao, delegate_data), fields(dao_slug = %dao.slug, delegate_address = %delegate_data.public_address))]
async fn update_delegate(
    dao: &dao::Model,
    delegate_data: &KarmaDelegate,
    dao_discourse_id: Uuid,
) -> Result<()> {
    let start_time = Instant::now();

    // Early return if forum_handle is None
    let forum_handle = match &delegate_data.discourse_handle {
        Some(handle) => handle,
        None => return Ok(()),
    };

    // Check if the voter exists
    let mut voter: Option<voter::Model> = voter::Entity::find()
        .filter(voter::Column::Address.eq(delegate_data.public_address.clone()))
        .one(DB.get().unwrap())
        .await
        .with_context(|| {
            format!(
                "Failed to find voter for address: {}",
                delegate_data.public_address
            )
        })?;

    // If voter does not exist, create a new one
    if voter.is_none() {
        let new_voter = voter::ActiveModel {
            id: NotSet,
            address: Set(delegate_data.public_address.clone()),
            ens: Set(delegate_data.ens_name.clone()),
        };
        let last_insert_id = voter::Entity::insert(new_voter)
            .exec(DB.get().unwrap())
            .await
            .with_context(|| {
                format!(
                    "Failed to insert new voter for address: {}",
                    delegate_data.public_address
                )
            })?
            .last_insert_id;
        voter = Some(voter::Model {
            id: last_insert_id,
            address: delegate_data.public_address.clone(),
            ens: delegate_data.ens_name.clone(),
        });
        METRICS.get().unwrap().db_inserts.add(1, &[]);
    }

    // Check if the discourse user exists by dao_discourse_id and forum_handle
    let discourse_user: Option<discourse_user::Model> = discourse_user::Entity::find()
        .filter(Expr::cust("LOWER(username)").eq(forum_handle.to_lowercase()))
        .filter(discourse_user::Column::DaoDiscourseId.eq(dao_discourse_id))
        .one(DB.get().unwrap())
        .await
        .with_context(|| {
            format!(
                "Failed to find discourse user for handle: {} and dao_discourse_id: {}",
                forum_handle, dao_discourse_id
            )
        })?;

    if discourse_user.is_none() {
        warn!(
            "Discourse user not found for forum handle: {} and dao_discourse_id: {}",
            forum_handle, dao_discourse_id
        );
        return Ok(());
    }

    let voter_id = voter.as_ref().unwrap().id;
    let discourse_user_id = discourse_user.as_ref().unwrap().id;

    // Check for existing delegate via voter with period_end > now
    let mut delegate: Option<delegate::Model> = None;

    if let Some(voter) = &voter {
        delegate = delegate_to_voter::Entity::find()
            .filter(delegate_to_voter::Column::VoterId.eq(voter.id))
            .inner_join(delegate::Entity)
            .filter(delegate::Column::DaoId.eq(dao.id))
            .one(DB.get().unwrap())
            .await
            .with_context(|| {
                format!(
                    "Failed to find delegate via voter for voter_id: {}",
                    voter.id
                )
            })?
            .map(|dtv| delegate::Model {
                id: dtv.delegate_id,
                dao_id: dao.id,
            });
    }

    // If no delegate found via voter, check for existing delegate via discourse user with period_end > now
    if delegate.is_none() {
        if let Some(discourse_user) = &discourse_user {
            delegate = delegate_to_discourse_user::Entity::find()
                .filter(delegate_to_discourse_user::Column::DiscourseUserId.eq(discourse_user.id))
                .inner_join(delegate::Entity)
                .filter(delegate::Column::DaoId.eq(dao.id))
                .one(DB.get().unwrap())
                .await
                .with_context(|| {
                    format!(
                        "Failed to find delegate via discourse user for discourse_user_id: {}",
                        discourse_user.id
                    )
                })?
                .map(|dtdu| delegate::Model {
                    id: dtdu.delegate_id,
                    dao_id: dao.id,
                });
        }
    }

    let delegate: delegate::Model = if let Some(del) = delegate {
        del
    } else {
        // Create new delegate
        let new_delegate = delegate::ActiveModel {
            id: NotSet,
            dao_id: Set(dao.id),
        };
        let last_insert_id = delegate::Entity::insert(new_delegate)
            .exec(DB.get().unwrap())
            .await
            .with_context(|| format!("Failed to insert new delegate for dao_id: {}", dao.id))?
            .last_insert_id;
        delegate::Model {
            id: last_insert_id,
            dao_id: dao.id,
        }
    };

    let now = Utc::now().naive_utc();
    let one_hour_later = now + Duration::hours(1);

    // Insert or update the delegate_to_voter mapping
    let existing_dtv = delegate_to_voter::Entity::find()
        .filter(delegate_to_voter::Column::DelegateId.eq(delegate.id))
        .filter(delegate_to_voter::Column::VoterId.eq(voter_id))
        .one(DB.get().unwrap())
        .await
        .with_context(|| format!("Failed to find existing delegate_to_voter mapping for delegate_id: {} and voter_id: {}", delegate.id, voter_id))?;

    if let Some(dtv) = existing_dtv {
        // Update existing delegate_to_voter mapping
        let mut active_dtv = dtv.into_active_model();
        active_dtv.period_end = Set(one_hour_later);
        delegate_to_voter::Entity::update(active_dtv)
            .exec(DB.get().unwrap())
            .await
            .with_context(|| format!("Failed to update delegate_to_voter mapping for delegate_id: {} and voter_id: {}", delegate.id, voter_id))?;
        info!(
            delegate_id = delegate.id.to_string(),
            voter_id = voter_id.to_string(),
            "Updated delegate_to_voter mapping"
        );
        METRICS.get().unwrap().db_updates.add(1, &[]);
    } else {
        // Insert new delegate_to_voter mapping
        let new_dtv = delegate_to_voter::ActiveModel {
            id: NotSet,
            delegate_id: Set(delegate.id),
            voter_id: Set(voter_id),
            period_start: Set(now),
            period_end: Set(one_hour_later),
            proof: NotSet,
            verified: Set(false),
            created_at: Set(now),
        };
        delegate_to_voter::Entity::insert(new_dtv)
            .exec(DB.get().unwrap())
            .await
            .with_context(|| format!("Failed to insert new delegate_to_voter mapping for delegate_id: {} and voter_id: {}", delegate.id, voter_id))?;
        info!(
            delegate_id = delegate.id.to_string(),
            voter_id = voter_id.to_string(),
            "Created new delegate_to_voter mapping"
        );
        METRICS.get().unwrap().db_inserts.add(1, &[]);
    }

    // Insert or update the delegate_to_discourse_user mapping
    let existing_dtdu = delegate_to_discourse_user::Entity::find()
        .filter(delegate_to_discourse_user::Column::DelegateId.eq(delegate.id))
        .filter(delegate_to_discourse_user::Column::DiscourseUserId.eq(discourse_user_id))
        .one(DB.get().unwrap())
        .await
        .with_context(|| format!("Failed to find existing delegate_to_discourse_user mapping for delegate_id: {} and discourse_user_id: {}", delegate.id, discourse_user_id))?;

    if let Some(dtdu) = existing_dtdu {
        // Update existing delegate_to_discourse_user mapping
        let mut active_dtdu = dtdu.into_active_model();
        active_dtdu.period_end = Set(one_hour_later);
        active_dtdu.verified = Set(delegate_data.is_forum_verified);
        delegate_to_discourse_user::Entity::update(active_dtdu)
            .exec(DB.get().unwrap())
            .await
            .with_context(|| format!("Failed to update delegate_to_discourse_user mapping for delegate_id: {} and discourse_user_id: {}", delegate.id, discourse_user_id))?;
        info!(
            delegate_id = delegate.id.to_string(),
            discourse_user_id = discourse_user_id.to_string(),
            "Updated delegate_to_discourse_user mapping"
        );
        METRICS.get().unwrap().db_updates.add(1, &[]);
    } else {
        // Insert new delegate_to_discourse_user mapping
        let new_dtdu = delegate_to_discourse_user::ActiveModel {
            id: NotSet,
            delegate_id: Set(delegate.id),
            discourse_user_id: Set(discourse_user_id),
            period_start: Set(now),
            period_end: Set(one_hour_later),
            proof: NotSet,
            verified: Set(delegate_data.is_forum_verified),
            created_at: Set(now),
        };
        delegate_to_discourse_user::Entity::insert(new_dtdu)
            .exec(DB.get().unwrap())
            .await
            .with_context(|| format!("Failed to insert new delegate_to_discourse_user mapping for delegate_id: {} and discourse_user_id: {}", delegate.id, discourse_user_id))?;
        info!(
            delegate_id = delegate.id.to_string(),
            discourse_user_id = discourse_user_id.to_string(),
            "Created new delegate_to_discourse_user mapping"
        );
        METRICS.get().unwrap().db_inserts.add(1, &[]);
    }

    METRICS
        .get()
        .unwrap()
        .db_query_duration
        .record(start_time.elapsed().as_secs_f64(), &[]);

    Ok(())
}

#[instrument(skip(delegates), fields(delegate_count = delegates.len()))]
async fn update_delegates_ens(delegates: &[KarmaDelegate]) -> Result<()> {
    let start_time = Instant::now();

    // Filter delegates with ENS set
    let filtered_delegates: Vec<&KarmaDelegate> = delegates
        .iter()
        .filter(|delegate| delegate.ens_name.is_some())
        .collect();

    if filtered_delegates.is_empty() {
        info!("No delegates with ENS names found.");
        return Ok(());
    }

    // Fetch voters by public addresses in batches
    let addresses: Vec<&str> = filtered_delegates
        .iter()
        .map(|delegate| delegate.public_address.as_str())
        .collect();

    let mut voters_to_update = HashMap::new();

    const BATCH_SIZE: usize = 100;
    for batch_addresses in addresses.chunks(BATCH_SIZE) {
        let chunk_voters: Vec<voter::Model> = voter::Entity::find()
            .filter(voter::Column::Address.is_in(batch_addresses.to_vec()))
            .all(DB.get().unwrap())
            .await
            .with_context(|| {
                format!(
                    "Failed to fetch voters in batch for addresses: {:?}",
                    batch_addresses
                )
            })?;

        for voter in chunk_voters {
            voters_to_update.insert(voter.address.clone(), voter);
        }
    }

    // Prepare updates and new voters
    let mut active_voters_to_save = Vec::new();

    for delegate in filtered_delegates {
        if let Some(voter) = voters_to_update.remove(&delegate.public_address) {
            if voter.ens != delegate.ens_name {
                // Convert Model to ActiveModel for updating
                let mut active_voter = voter.into_active_model();
                active_voter.ens = Set(delegate.ens_name.clone());
                active_voters_to_save.push(active_voter);
            }
        } else {
            // If voter does not exist, create a new one
            let new_voter = voter::ActiveModel {
                id: NotSet,
                address: Set(delegate.public_address.clone()),
                ens: Set(delegate.ens_name.clone()),
            };
            active_voters_to_save.push(new_voter);
        }
    }

    // Batch update or insert voters
    if !active_voters_to_save.is_empty() {
        let tx = DB.get().unwrap().begin().await?;

        for voter in active_voters_to_save.clone() {
            if voter.id.is_not_set() {
                // Insert new voter
                voter::Entity::insert(voter).exec(&tx).await?;
                METRICS.get().unwrap().db_inserts.add(1, &[]);
            } else {
                // Update existing voter
                voter::Entity::update(voter).exec(&tx).await?;
                METRICS.get().unwrap().db_updates.add(1, &[]);
            }
        }

        info!(
            "Updated or inserted ENS names for {} voters.",
            active_voters_to_save.len()
        );
        tx.commit().await.context("Failed to commit transaction")?;
    } else {
        info!("No updates needed for voters.");
    }

    METRICS
        .get()
        .unwrap()
        .db_query_duration
        .record(start_time.elapsed().as_secs_f64(), &[]);

    Ok(())
}
