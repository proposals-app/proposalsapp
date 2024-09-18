use crate::db_handler::DbHandler;
use crate::models::users::{User, UserResponse};
use anyhow::{anyhow, Result};
use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use reqwest::Client;
use sea_orm::prelude::Uuid;
use std::time::Duration;
use tokio::time::sleep;
use tracing::{info, instrument, warn};

pub struct UserFetcher {
    client: Client,
    base_url: String,
    max_retries: usize,
}

impl UserFetcher {
    pub fn new(base_url: &str, max_retries: usize) -> Self {
        let mut headers = HeaderMap::new();
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0",
            ),
        );

        Self {
            client: Client::builder().default_headers(headers).build().unwrap(),
            base_url: base_url.to_string(),
            max_retries,
        }
    }

    #[instrument(skip(self, db_handler), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_all_users(
        self,
        db_handler: &DbHandler,
        dao_discourse_id: Uuid,
    ) -> Result<()> {
        let mut page = 0;
        let mut total_users = 0;
        let mut previous_response: Option<UserResponse> = None;

        loop {
            let url = format!(
                "{}/directory_items.json?page={}&order=asc&period=all",
                self.base_url, page
            );
            let response = self.fetch_page_with_retries(&url, self.max_retries).await?;

            let page_users: Vec<User> = response
                .directory_items
                .iter()
                .map(|item| {
                    let mut user = item.user.clone();
                    user.likes_received = Some(item.likes_received);
                    user.likes_given = Some(item.likes_given);
                    user.topics_entered = Some(item.topics_entered);
                    user.topic_count = Some(item.topic_count);
                    user.post_count = Some(item.post_count);
                    user.posts_read = Some(item.posts_read);
                    user.days_visited = Some(item.days_visited);
                    user
                })
                .collect();
            let num_users = page_users.len();
            total_users += num_users;

            for user in page_users {
                db_handler.upsert_user(&user, dao_discourse_id).await?;
            }

            tracing::info!(
                "Fetched and upserted page {}: {} users (total users so far: {})",
                page + 1,
                num_users,
                total_users
            );

            if response.directory_items.is_empty() {
                tracing::info!("No more users to fetch. Stopping.");
                break;
            }

            if let Some(prev) = &previous_response {
                if serde_json::to_string(&prev.directory_items)?
                    == serde_json::to_string(&response.directory_items)?
                {
                    info!("Detected identical response. Stopping fetch.");
                    break;
                }
            }

            previous_response = Some(response);
            page += 1;
            sleep(Duration::from_millis(500)).await;
        }

        Ok(())
    }

    #[instrument(skip(self), fields(url = %url, max_retries = max_retries))]
    async fn fetch_page_with_retries(&self, url: &str, max_retries: usize) -> Result<UserResponse> {
        let mut attempt = 0;
        let mut delay = Duration::from_secs(1);

        loop {
            match self.client.get(url).send().await {
                Ok(response) => {
                    if response.status().is_success() {
                        let resp_json = response.json::<UserResponse>().await?;
                        return Ok(resp_json);
                    } else if response.status().is_server_error()
                        || response.status().as_u16() == 429
                    {
                        attempt += 1;
                        if attempt > max_retries {
                            return Err(anyhow!(
                                "Max retries reached. Last error: HTTP {}",
                                response.status()
                            ));
                        }

                        if response.status().as_u16() == 429 {
                            let retry_after = response
                                .headers()
                                .get("Retry-After")
                                .and_then(|h| h.to_str().ok())
                                .and_then(|s| s.parse::<u64>().ok())
                                .map(Duration::from_secs)
                                .unwrap_or(Duration::from_secs(60));

                            warn!(
                                "Rate limited. Waiting for {:?} before retrying...",
                                retry_after
                            );
                            sleep(retry_after).await;
                        } else {
                            warn!(
                                "Server error {}. Retrying in {:?}...",
                                response.status(),
                                delay
                            );
                            sleep(delay).await;
                            delay *= 2;
                        }
                    } else {
                        let status = response.status();
                        let body = response.text().await.unwrap_or_default();
                        return Err(anyhow!("Request failed with status {}: {}", status, body));
                    }
                }
                Err(e) => {
                    attempt += 1;
                    if attempt > max_retries {
                        return Err(anyhow!("Max retries reached. Last error: {}", e));
                    }
                    warn!("Request error: {}. Retrying in {:?}...", e, delay);
                    sleep(delay).await;
                    delay *= 2; // Exponential backoff
                }
            }
        }
    }
}
