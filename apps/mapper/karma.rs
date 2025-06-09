use crate::DB;
use alloy::primitives::Address;
use anyhow::{Context, Result};
use chrono::{Duration, Utc};
use proposalsapp_db::models::{
    dao, dao_discourse, delegate, delegate_to_discourse_user, delegate_to_voter, discourse_user,
    voter,
};
use reqwest::Client;
use sea_orm::{
    ActiveValue::NotSet,
    ColumnTrait, EntityTrait, IntoActiveModel, QueryFilter, Set, TransactionTrait,
    prelude::{Expr, Uuid},
};
use serde::Deserialize;
use std::collections::HashMap;
use tokio::{
    sync::Mutex,
    time::{Instant, sleep},
};
use tracing::{Span, info, instrument, warn};

#[derive(Debug, Deserialize)]
struct KarmaFullApiResponse {
    data: KarmaApiResponseData,
}

#[derive(Debug, Deserialize)]
struct KarmaApiResponseData {
    delegates: Vec<KarmaDelegate>,
}

#[derive(Debug, Deserialize, Clone, PartialEq)]
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

#[instrument]
pub async fn run_karma_task() -> Result<()> {
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
                        break;
                    }

                    all_delegates.extend(delegates);
                    offset += 1;
                }

                // Checksumming all delegate addresses
                for delegate in &mut all_delegates {
                    let address: Address = delegate.public_address.parse()?;
                    delegate.public_address = address.to_checksum(None);
                }

                let delegates_with_forum_handle: Vec<&KarmaDelegate> = all_delegates
                    .iter()
                    .filter(|d| {
                        d.discourse_handles.is_some()
                            && !d.discourse_handles.as_ref().unwrap().is_empty()
                    })
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

// Static rate limit tracking
lazy_static::lazy_static! {
    static ref RATE_LIMIT_STATE: Mutex<RateLimitState> = Mutex::new(RateLimitState {
        remaining: 100, // Default high value
        reset_at: Instant::now(),
        last_updated: Instant::now(),
    });
}

#[derive(Debug, Clone)]
struct RateLimitState {
    remaining: u32,
    reset_at: Instant,
    last_updated: Instant,
}

// Constants for rate limiting and retries
const MAX_RETRIES: u32 = 5;
const INITIAL_RETRY_DELAY: Duration = Duration::seconds(1);
const MAX_RETRY_DELAY: Duration = Duration::seconds(5 * 60);
const RATE_LIMIT_THRESHOLD: u32 = 5; // Threshold to start being cautious
const RATE_LIMIT_STALE_DURATION: std::time::Duration = std::time::Duration::from_secs(60); // Consider rate limit info stale after 60s
const REQUEST_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(10);

/// Extract rate limit information from response headers
fn extract_rate_limit_info(
    headers: &reqwest::header::HeaderMap,
    now: Instant,
) -> (Option<u32>, Option<Instant>) {
    // Extract remaining requests
    let remaining = headers
        .get("x-ratelimit-remaining")
        .or_else(|| headers.get("X-RateLimit-Remaining"))
        .or_else(|| headers.get("ratelimit-remaining"))
        .and_then(|val| val.to_str().ok())
        .and_then(|val| val.parse::<u32>().ok());

    // Extract reset time
    let reset_at = if let Some(reset_seconds) = headers
        .get("x-ratelimit-reset")
        .or_else(|| headers.get("X-RateLimit-Reset"))
        .or_else(|| headers.get("ratelimit-reset"))
        .and_then(|val| val.to_str().ok())
        .and_then(|val| val.parse::<u64>().ok())
    {
        Some(now + std::time::Duration::from_secs(reset_seconds))
    } else if let Some(reset_timestamp) = headers
        .get("x-ratelimit-reset-at")
        .or_else(|| headers.get("X-RateLimit-Reset-At"))
        .and_then(|val| val.to_str().ok())
        .and_then(|val| chrono::DateTime::parse_from_rfc3339(val).ok())
    {
        let now_utc = Utc::now();
        if reset_timestamp > now_utc {
            let duration_until_reset = reset_timestamp.signed_duration_since(now_utc);
            Some(now + std::time::Duration::from_secs(duration_until_reset.num_seconds() as u64))
        } else {
            None
        }
    } else {
        None
    };

    (remaining, reset_at)
}

/// Calculate retry delay with exponential backoff and optional jitter
fn calculate_retry_delay(retry_delay: Duration, add_jitter: bool) -> std::time::Duration {
    let base_delay = retry_delay.num_seconds() as u64;
    let delay = if add_jitter {
        // Add up to 30% jitter to avoid thundering herd problem
        let jitter = (rand::random::<f64>() * 0.3 * base_delay as f64) as u64;
        base_delay + jitter
    } else {
        base_delay
    };

    std::time::Duration::from_secs(delay)
}

/// Check if we need to wait for rate limit reset
async fn check_rate_limit(dao_slug: &str) -> bool {
    let rate_limit_state = RATE_LIMIT_STATE.lock().await;
    let now = Instant::now();

    // If rate limit info is fresh and we're close to the limit
    if now.duration_since(rate_limit_state.last_updated) < RATE_LIMIT_STALE_DURATION
        && rate_limit_state.remaining <= RATE_LIMIT_THRESHOLD
    {
        // If reset time is in the future, wait until then
        if rate_limit_state.reset_at > now {
            let wait_duration = rate_limit_state.reset_at.duration_since(now);

            // Add a small buffer to ensure reset has occurred
            let wait_duration_with_buffer = wait_duration + std::time::Duration::from_secs(1);

            info!(
                "Proactively waiting for rate limit reset for DAO: {}. Remaining: {}, waiting for {:?}",
                dao_slug, rate_limit_state.remaining, wait_duration_with_buffer
            );

            // Clone the data we need before dropping the lock
            let wait_time = wait_duration_with_buffer;

            // Release the lock before sleeping
            drop(rate_limit_state);
            sleep(wait_time).await;
            return true;
        }
    }

    false
}

/// Update rate limit state from response headers
async fn update_rate_limit_state(headers: &reqwest::header::HeaderMap, dao_slug: &str) {
    let mut rate_limit_state = RATE_LIMIT_STATE.lock().await;
    let now = Instant::now();
    rate_limit_state.last_updated = now;

    let (remaining, reset_at) = extract_rate_limit_info(headers, now);

    // Update remaining requests if available
    if let Some(remaining_val) = remaining {
        rate_limit_state.remaining = remaining_val;

        // Log if we're getting close to the limit
        if remaining_val <= RATE_LIMIT_THRESHOLD {
            info!(
                "Rate limit getting low for DAO: {}. Remaining: {}",
                dao_slug, remaining_val
            );
        }
    }

    // Update reset time if available
    if let Some(reset_time) = reset_at {
        rate_limit_state.reset_at = reset_time;
    }
}

/// Handle rate limit exceeded (429 status code)
async fn handle_rate_limit_exceeded(
    headers: &reqwest::header::HeaderMap,
    retry_delay: Duration,
    retry_count: u32,
    dao_slug: &str,
) -> std::time::Duration {
    // Get retry-after value or calculate a reasonable delay
    let retry_after = headers
        .get("retry-after")
        .and_then(|val| val.to_str().ok())
        .and_then(|val| val.parse::<u64>().ok())
        .unwrap_or_else(|| calculate_retry_delay(retry_delay, true).as_secs());

    warn!(
        "Rate limit exceeded for DAO: {}. Status: 429. Retry-After: {} seconds. (Attempt {}/{})",
        dao_slug,
        retry_after,
        retry_count + 1,
        MAX_RETRIES
    );

    // Update rate limit state to reflect we're at the limit
    {
        let mut rate_limit_state = RATE_LIMIT_STATE.lock().await;
        rate_limit_state.remaining = 0;
        rate_limit_state.reset_at = Instant::now() + std::time::Duration::from_secs(retry_after);
    }

    std::time::Duration::from_secs(retry_after)
}

/// Main function to fetch JSON data with improved rate limiting
async fn fetch_json_data(client: &Client, url: &str, dao_slug: &str) -> Result<String> {
    let mut retry_count = 0;
    let mut retry_delay = INITIAL_RETRY_DELAY;

    loop {
        // Check if we need to wait for rate limit reset before making the request
        check_rate_limit(dao_slug).await;

        // Make the request
        let response = match client.get(url).timeout(REQUEST_TIMEOUT).send().await {
            Ok(res) => res,
            Err(e) if e.is_timeout() || e.is_connect() => {
                if retry_count < MAX_RETRIES {
                    let delay = calculate_retry_delay(retry_delay, false);
                    warn!(
                        "Network error for DAO: {}. Error: {}. Retrying in {:?}... (Attempt {}/{})",
                        dao_slug,
                        e,
                        delay,
                        retry_count + 1,
                        MAX_RETRIES
                    );

                    sleep(delay).await;
                    retry_count += 1;
                    retry_delay = std::cmp::min(retry_delay * 2, MAX_RETRY_DELAY);
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
                    .with_context(|| format!("Failed to fetch JSON data for DAO: {}", dao_slug));
            }
        };

        let status = response.status();
        let headers = response.headers().clone();

        // Update rate limit state from headers (for any response)
        update_rate_limit_state(&headers, dao_slug).await;

        // Handle response based on status code
        if status.is_success() {
            // Successfully got the data
            return response.text().await.with_context(|| {
                format!(
                    "Failed to read JSON response body for DAO: {}. Status: {}, URL: {}",
                    dao_slug, status, url
                )
            });
        } else if status == reqwest::StatusCode::TOO_MANY_REQUESTS && retry_count < MAX_RETRIES {
            // Handle 429 Too Many Requests
            let delay =
                handle_rate_limit_exceeded(&headers, retry_delay, retry_count, dao_slug).await;
            sleep(delay).await;
            retry_count += 1;
            retry_delay = std::cmp::min(retry_delay * 2, MAX_RETRY_DELAY);
        } else if status.is_server_error() && retry_count < MAX_RETRIES {
            // Handle 5xx server errors with exponential backoff
            let delay = calculate_retry_delay(retry_delay, true);
            warn!(
                "Server error for DAO: {}. Status: {}. Retrying in {:?}... (Attempt {}/{})",
                dao_slug,
                status,
                delay,
                retry_count + 1,
                MAX_RETRIES
            );

            sleep(delay).await;
            retry_count += 1;
            retry_delay = std::cmp::min(retry_delay * 2, MAX_RETRY_DELAY);
        } else {
            // Other error status codes
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
    let response: KarmaFullApiResponse = serde_json::from_str(body)
        .with_context(|| format!("Failed to parse JSON for DAO: {}", dao_slug))?;
    Ok(response.data.delegates)
}

#[instrument(skip( dao, delegate_data), fields(dao_slug = %dao.slug, delegate_address = %delegate_data.public_address))]
async fn update_delegate(
    dao: &dao::Model,
    delegate_data: &KarmaDelegate,
    dao_discourse_id: Uuid,
    forum_handle: &str,
) -> Result<()> {
    let txn = DB
        .get()
        .unwrap()
        .begin()
        .await
        .context("Failed to start transaction")?;

    // Check if the voter exists
    let mut voter: Option<voter::Model> = voter::Entity::find()
        .filter(voter::Column::Address.eq(delegate_data.public_address.clone()))
        .one(&txn)
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
            .exec(&txn)
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
    }

    // Check if the discourse user exists by dao_discourse_id and forum_handle
    let discourse_user: Option<discourse_user::Model> = discourse_user::Entity::find()
        .filter(Expr::cust("LOWER(username)").eq(forum_handle.to_lowercase()))
        .filter(discourse_user::Column::DaoDiscourseId.eq(dao_discourse_id))
        .one(&txn)
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
        txn.rollback().await?;
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
            .one(&txn)
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
                .one(&txn)
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
            .exec(&txn)
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
        .one(&txn)
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
            .exec(&txn)
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
            .exec(&txn)
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
    }

    // Insert or update the delegate_to_discourse_user mapping
    let existing_dtdu = delegate_to_discourse_user::Entity::find()
        .filter(delegate_to_discourse_user::Column::DelegateId.eq(delegate.id))
        .filter(delegate_to_discourse_user::Column::DiscourseUserId.eq(discourse_user_id))
        .one(&txn)
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
            .exec(&txn)
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
            .exec(&txn)
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
    }

    txn.commit().await?;

    Ok(())
}
