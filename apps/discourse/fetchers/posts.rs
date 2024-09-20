use crate::db_handler::DbHandler;
use crate::models::posts::PostResponse;
use anyhow::{anyhow, Result};
use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use reqwest::Client;
use sea_orm::prelude::Uuid;
use sea_orm::{ColumnTrait, EntityTrait, PaginatorTrait, QueryFilter};
use std::time::Duration;
use tokio::time::sleep;
use tracing::{info, instrument, warn};

pub struct PostFetcher {
    client: Client,
    base_url: String,
    max_retries: usize,
}

impl PostFetcher {
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

    #[instrument(skip(self, db_handler), fields(dao_discourse_id = %dao_discourse_id, topic_id = topic_id))]
    pub async fn update_posts_for_topic(
        &self,
        db_handler: &DbHandler,
        dao_discourse_id: Uuid,
        topic_id: i32,
    ) -> Result<()> {
        let mut page = 0;
        let mut total_posts = 0;
        let mut previous_response: Option<PostResponse> = None;

        let current_posts_count = seaorm::discourse_post::Entity::find()
            .filter(seaorm::discourse_post::Column::TopicId.eq(topic_id))
            .count(&db_handler.conn)
            .await?;

        loop {
            let url = format!("{}/t/{}.json?page={}", self.base_url, topic_id, page);
            let response = self
                .fetch_posts_with_retries(&url, self.max_retries)
                .await?;

            if response.posts_count <= current_posts_count as i32 {
                info!("No new posts to fetch for topic {}. Stopping.", topic_id);
                sleep(Duration::from_secs_f32(0.5)).await;
                break;
            }

            let num_posts = response.post_stream.posts.len();
            total_posts += num_posts;

            for post in &response.post_stream.posts {
                db_handler.upsert_post(&post, dao_discourse_id).await?;
            }

            info!(
                "Fetched and upserted page {} for topic {}: {} posts (total posts so far: {})",
                page + 1,
                topic_id,
                num_posts,
                total_posts
            );

            if response.post_stream.posts.is_empty() {
                info!("No more posts to fetch for topic {}. Stopping.", topic_id);
                break;
            }

            if let Some(prev) = &previous_response {
                if serde_json::to_string(&prev.post_stream.posts)?
                    == serde_json::to_string(&response.post_stream.posts)?
                {
                    info!(
                        "Detected identical response for topic {}. Stopping fetch.",
                        topic_id
                    );
                    break;
                }
            }

            previous_response = Some(response);
            page += 1;
            sleep(Duration::from_secs_f32(1.0)).await;
        }

        info!(
            "Finished updating posts for topic {}. Total posts: {}",
            topic_id, total_posts
        );
        Ok(())
    }

    #[instrument(skip(self), fields(url = %url, max_retries = max_retries))]
    async fn fetch_posts_with_retries(
        &self,
        url: &str,
        max_retries: usize,
    ) -> Result<PostResponse> {
        let mut attempt = 0;
        let mut delay = Duration::from_secs(1);

        loop {
            match self.client.get(url).send().await {
                Ok(response) => {
                    if response.status().is_success() {
                        let resp_json = response.json::<PostResponse>().await?;
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
