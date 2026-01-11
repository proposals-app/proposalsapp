use anyhow::{Context, Result};
use chrono::Duration;
use reqwest::Client;
use serde::Deserialize;
use tokio::{
    sync::Mutex,
    time::{Instant, sleep},
};
use tracing::{info, warn};

#[derive(Debug, Deserialize)]
struct KarmaFullApiResponse {
    data: KarmaApiResponseData,
}

#[derive(Debug, Deserialize)]
struct KarmaApiResponseData {
    delegates: Vec<KarmaDelegate>,
}

#[derive(Debug, Deserialize, Clone, PartialEq)]
pub struct KarmaDelegate {
    #[serde(rename = "publicAddress")]
    pub public_address: String,
    #[serde(rename = "ensName")]
    pub ens_name: Option<String>,
    #[serde(rename = "discourseHandles")]
    pub discourse_handles: Option<Vec<String>>,
    #[serde(rename = "isForumVerified")]
    pub is_forum_verified: bool,
}

// Static rate limit tracking
lazy_static::lazy_static! {
    static ref RATE_LIMIT_STATE: Mutex<RateLimitState> = Mutex::new(RateLimitState {
        remaining: 100,
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

const MAX_RETRIES: u32 = 5;
const INITIAL_RETRY_DELAY: Duration = Duration::seconds(1);
const MAX_RETRY_DELAY: Duration = Duration::seconds(5 * 60);
const RATE_LIMIT_THRESHOLD: u32 = 5;
const RATE_LIMIT_STALE_DURATION: std::time::Duration = std::time::Duration::from_secs(60);
const REQUEST_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(10);

pub async fn fetch_delegates(
    client: &Client,
    dao_slug: &str,
    karma_dao_name: &str,
) -> Result<Vec<KarmaDelegate>> {
    let mut offset = 0;
    let page_size = 10;
    let mut all_delegates = Vec::new();

    loop {
        let url = format!(
            "https://api.karmahq.xyz/api/dao/delegates?name={karma_dao_name}&offset={offset}&order=desc&field=score&period=lifetime&pageSize={page_size}&statuses=active,inactive,withdrawn,recognized"
        );

        info!("Fetching karma data for dao: {} url: {}", dao_slug, url);

        let body = fetch_json_data(client, &url, dao_slug).await?;
        let delegates = parse_json_data(&body, dao_slug)?;

        if delegates.is_empty() {
            break;
        }

        all_delegates.extend(delegates);
        offset += 1;
    }

    Ok(all_delegates)
}

fn parse_json_data(body: &str, dao_slug: &str) -> Result<Vec<KarmaDelegate>> {
    let response: KarmaFullApiResponse = serde_json::from_str(body)
        .with_context(|| format!("Failed to parse JSON for DAO: {dao_slug}"))?;
    Ok(response.data.delegates)
}

fn extract_rate_limit_info(
    headers: &reqwest::header::HeaderMap,
    now: Instant,
) -> (Option<u32>, Option<Instant>) {
    let remaining = headers
        .get("x-ratelimit-remaining")
        .or_else(|| headers.get("X-RateLimit-Remaining"))
        .or_else(|| headers.get("ratelimit-remaining"))
        .and_then(|val| val.to_str().ok())
        .and_then(|val| val.parse::<u32>().ok());

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
        let now_utc = chrono::Utc::now();
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

fn calculate_retry_delay(retry_delay: Duration, add_jitter: bool) -> std::time::Duration {
    let base_delay = retry_delay.num_seconds() as u64;
    let delay = if add_jitter {
        let jitter = (rand::random::<f64>() * 0.3 * base_delay as f64) as u64;
        base_delay + jitter
    } else {
        base_delay
    };

    std::time::Duration::from_secs(delay)
}

async fn check_rate_limit(dao_slug: &str) -> bool {
    let rate_limit_state = RATE_LIMIT_STATE.lock().await;
    let now = Instant::now();

    if now.duration_since(rate_limit_state.last_updated) < RATE_LIMIT_STALE_DURATION
        && rate_limit_state.remaining <= RATE_LIMIT_THRESHOLD
        && rate_limit_state.reset_at > now
    {
        let wait_duration = rate_limit_state.reset_at.duration_since(now);
        let wait_duration_with_buffer = wait_duration + std::time::Duration::from_secs(1);

        info!(
            "Proactively waiting for rate limit reset for DAO: {}. Remaining: {}, waiting for {:?}",
            dao_slug, rate_limit_state.remaining, wait_duration_with_buffer
        );

        let wait_time = wait_duration_with_buffer;
        drop(rate_limit_state);
        sleep(wait_time).await;
        return true;
    }

    false
}

async fn update_rate_limit_state(headers: &reqwest::header::HeaderMap, dao_slug: &str) {
    let mut rate_limit_state = RATE_LIMIT_STATE.lock().await;
    let now = Instant::now();
    rate_limit_state.last_updated = now;

    let (remaining, reset_at) = extract_rate_limit_info(headers, now);

    if let Some(remaining_val) = remaining {
        rate_limit_state.remaining = remaining_val;

        if remaining_val <= RATE_LIMIT_THRESHOLD {
            info!(
                "Rate limit getting low for DAO: {}. Remaining: {}",
                dao_slug, remaining_val
            );
        }
    }

    if let Some(reset_time) = reset_at {
        rate_limit_state.reset_at = reset_time;
    }
}

async fn handle_rate_limit_exceeded(
    headers: &reqwest::header::HeaderMap,
    retry_delay: Duration,
    retry_count: u32,
    dao_slug: &str,
) -> std::time::Duration {
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

    {
        let mut rate_limit_state = RATE_LIMIT_STATE.lock().await;
        rate_limit_state.remaining = 0;
        rate_limit_state.reset_at = Instant::now() + std::time::Duration::from_secs(retry_after);
    }

    std::time::Duration::from_secs(retry_after)
}

async fn fetch_json_data(client: &Client, url: &str, dao_slug: &str) -> Result<String> {
    let mut retry_count = 0;
    let mut retry_delay = INITIAL_RETRY_DELAY;

    loop {
        check_rate_limit(dao_slug).await;

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
                    .with_context(|| format!("Failed to fetch JSON data for DAO: {dao_slug}"));
            }
        };

        let status = response.status();
        let headers = response.headers().clone();

        update_rate_limit_state(&headers, dao_slug).await;

        if status.is_success() {
            return response.text().await.with_context(|| {
                format!(
                    "Failed to read JSON response body for DAO: {dao_slug}. Status: {status}, URL: {url}"
                )
            });
        } else if status == reqwest::StatusCode::TOO_MANY_REQUESTS && retry_count < MAX_RETRIES {
            let delay =
                handle_rate_limit_exceeded(&headers, retry_delay, retry_count, dao_slug).await;
            sleep(delay).await;
            retry_count += 1;
            retry_delay = std::cmp::min(retry_delay * 2, MAX_RETRY_DELAY);
        } else if status.is_server_error() && retry_count < MAX_RETRIES {
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
            let headers_str = format!("{headers:?}");
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
