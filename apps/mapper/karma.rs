use alloy::primitives::Address;
use anyhow::{Context, Result};
use chrono::{Duration, Utc};
use proposalsapp_db::models::{dao, dao_discourse, delegate, delegate_to_discourse_user, delegate_to_voter, discourse_user, voter};
use rand;
use reqwest::Client;
use sea_orm::{
    ActiveValue::NotSet,
    ColumnTrait, EntityTrait, IntoActiveModel, QueryFilter, Set,
    prelude::{Expr, Uuid},
};
use serde::Deserialize;
use std::collections::HashMap;
use tokio::time::{Instant, sleep};
use tracing::{Span, info, instrument, warn};

use crate::{DB, metrics::METRICS};

#[derive(Debug, Deserialize)]
struct KarmaFullApiResponse {
    data: KarmaApiResponseData,
}

#[derive(Debug, Deserialize)]
struct KarmaApiResponseData {
    delegates: Vec<KarmaDelegate>,
}

#[derive(Debug, Deserialize, Clone)]
struct KarmaDelegate {
    #[serde(rename = "publicAddress")]
    public_address: String,
    #[serde(rename = "ensName")]
    ens_name: Option<String>,
    #[serde(rename = "discourseHandles")]
    discourse_handles: Option<Vec<String>>,
    #[serde(rename = "isForumVerified")]
    is_forum_verified: bool,
}

// Static mapping from dao.slug to karma_dao_name
lazy_static::lazy_static! {
    static ref DAO_SLUG_TO_KARMA_DAO_NAME: HashMap<&'static str, &'static str> = {
        let mut map = HashMap::new();
        map.insert("arbitrum", "arbitrum");
        map.insert("uniswap", "uniswap");
        // Add more mappings as needed
        map
    };
}

pub async fn run_karma_task() -> Result<()> {
    let start_time = Instant::now();
    fetch_karma_data().await?;
    METRICS
        .get()
        .unwrap()
        .karma_fetch_duration
        .record(start_time.elapsed().as_secs_f64(), &[]);

    Ok(())
}

#[instrument]
async fn fetch_karma_data() -> Result<()> {
    let client = Client::new();
    let daos = fetch_daos_with_discourse().await?;

    for (dao, maybe_dao_discourse) in daos {
        let span = Span::current();
        span.record("dao_slug", &dao.slug);

        info!("Processing dao: {}", dao.slug);

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

                    info!("Fetching karma data for dao: {} url: {}", dao.slug, url);

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

                METRICS
                    .get()
                    .unwrap()
                    .karma_delegates_processed
                    .add(all_delegates.len() as u64, &[]);

                let delegates_with_forum_handle: Vec<&KarmaDelegate> = all_delegates
                    .iter()
                    .filter(|d| d.discourse_handles.is_some() && !d.discourse_handles.as_ref().unwrap().is_empty())
                    .collect();

                info!("{:?}", delegates_with_forum_handle);
                info!(
                    "Number of delegates with forum handles: {:?}",
                    delegates_with_forum_handle.len()
                );

                for delegate in &delegates_with_forum_handle {
                    if let Some(forum_handle) = delegate
                        .discourse_handles
                        .as_ref()
                        .and_then(|handles| handles.first())
                    {
                        update_delegate(&dao, delegate, discourse.id, forum_handle).await?;
                    }
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
    const MAX_RETRIES: u32 = 5;
    const INITIAL_RETRY_DELAY: Duration = Duration::seconds(1);
    const MAX_RETRY_DELAY: Duration = Duration::seconds(5 * 60);

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
                        "Network error for DAO: {}. Error: {}. Retrying in {:?}... (Attempt {}/{})\n",
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
                    retry_delay = std::cmp::min(retry_delay * 2, MAX_RETRY_DELAY); // Exponential backoff with cap
                    continue;
                } else {
                    return Err(anyhow::anyhow!(
                        "Failed to fetch JSON data for DAO: {} due to network error: {}",
                        dao_slug,
                        e
                    ));
                }
            }
            Err(e) => return Err(e).with_context(|| format!("Failed to fetch JSON data for DAO: {}", dao_slug)),
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
            // Handle 5xx server errors with exponential backoff
            warn!(
                "Server error for DAO: {}. Status: {}. Retrying in {:?}... (Attempt {}/{})\n",
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
            retry_delay = std::cmp::min(retry_delay * 2, MAX_RETRY_DELAY); // Exponential backoff with cap
        } else if status == reqwest::StatusCode::TOO_MANY_REQUESTS && retry_count < MAX_RETRIES {
            // Handle 429 Too Many Requests with Retry-After header if available
            let retry_after = headers
                .get("retry-after")
                .and_then(|val| val.to_str().ok())
                .and_then(|val| val.parse::<u64>().ok())
                .unwrap_or_else(|| {
                    // If Retry-After header is missing or invalid, use exponential backoff with jitter
                    let base_delay = retry_delay.num_seconds() as u64;
                    let jitter = (rand::random::<f64>() * 0.3 * base_delay as f64) as u64; // Add up to 30% jitter
                    base_delay + jitter
                });

            warn!(
                "Rate limit exceeded for DAO: {}. Status: 429. Retry-After: {} seconds. (Attempt {}/{})\n",
                dao_slug,
                retry_after,
                retry_count + 1,
                MAX_RETRIES
            );

            sleep(std::time::Duration::from_secs(retry_after)).await;
            retry_count += 1;
            retry_delay = std::cmp::min(retry_delay * 2, MAX_RETRY_DELAY); // Increase for next potential retry
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
    let response: KarmaFullApiResponse = serde_json::from_str(body).with_context(|| format!("Failed to parse JSON for DAO: {}", dao_slug))?;
    Ok(response.data.delegates)
}

#[instrument(skip( dao, delegate_data), fields(dao_slug = %dao.slug, delegate_address = %delegate_data.public_address))]
async fn update_delegate(dao: &dao::Model, delegate_data: &KarmaDelegate, dao_discourse_id: Uuid, forum_handle: &str) -> Result<()> {
    let start_time = Instant::now();

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
            avatar: NotSet,
            updated_at: Set(Utc::now().naive_utc()),
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
            avatar: None,
            updated_at: Utc::now().naive_utc(),
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

    // If no delegate found via voter, check for existing delegate via discourse
    // user with period_end > now
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
        .with_context(|| {
            format!(
                "Failed to find existing delegate_to_voter mapping for delegate_id: {} and \
                 voter_id: {}",
                delegate.id, voter_id
            )
        })?;

    if let Some(dtv) = existing_dtv {
        // Update existing delegate_to_voter mapping
        let mut active_dtv = dtv.into_active_model();
        active_dtv.period_end = Set(one_hour_later);
        delegate_to_voter::Entity::update(active_dtv)
            .exec(DB.get().unwrap())
            .await
            .with_context(|| {
                format!(
                    "Failed to update delegate_to_voter mapping for delegate_id: {} and voter_id: \
                     {}",
                    delegate.id, voter_id
                )
            })?;
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
            .with_context(|| {
                format!(
                    "Failed to insert new delegate_to_voter mapping for delegate_id: {} and \
                     voter_id: {}",
                    delegate.id, voter_id
                )
            })?;
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
        .with_context(|| {
            format!(
                "Failed to find existing delegate_to_discourse_user mapping for delegate_id: {} \
                 and discourse_user_id: {}",
                delegate.id, discourse_user_id
            )
        })?;

    if let Some(dtdu) = existing_dtdu {
        // Update existing delegate_to_discourse_user mapping
        let mut active_dtdu = dtdu.into_active_model();
        active_dtdu.period_end = Set(one_hour_later);
        active_dtdu.verified = Set(delegate_data.is_forum_verified);
        delegate_to_discourse_user::Entity::update(active_dtdu)
            .exec(DB.get().unwrap())
            .await
            .with_context(|| {
                format!(
                    "Failed to update delegate_to_discourse_user mapping for delegate_id: {} and \
                     discourse_user_id: {}",
                    delegate.id, discourse_user_id
                )
            })?;
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
            .with_context(|| {
                format!(
                    "Failed to insert new delegate_to_discourse_user mapping for delegate_id: {} \
                     and discourse_user_id: {}",
                    delegate.id, discourse_user_id
                )
            })?;
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
