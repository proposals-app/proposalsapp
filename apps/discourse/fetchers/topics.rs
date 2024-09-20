use crate::db_handler::DbHandler;
use crate::models::topics::TopicResponse;
use anyhow::{anyhow, Result};
use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use reqwest::Client;
use sea_orm::prelude::Uuid;
use std::time::Duration;
use tokio::time::sleep;
use tracing::{info, instrument, warn};

pub struct TopicFetcher {
    client: Client,
    base_url: String,
    max_retries: usize,
}

impl TopicFetcher {
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
    pub async fn update_all_topics(
        self,
        db_handler: &DbHandler,
        dao_discourse_id: Uuid,
    ) -> Result<()> {
        let mut page = 1;
        let mut total_topics = 0;
        let mut previous_response: Option<TopicResponse> = None;

        loop {
            let url = format!(
                "{}/latest.json?order=created&ascending=true&page={}",
                self.base_url, page
            );
            let response = self.fetch_page_with_retries(&url, self.max_retries).await?;

            let num_topics = response.topic_list.topics.len();
            total_topics += num_topics;

            for topic in &response.topic_list.topics {
                db_handler.upsert_topic(topic, dao_discourse_id).await?;
            }

            info!(
                "Fetched and upserted page {}: {} topics (total topics so far: {})",
                page, num_topics, total_topics
            );

            if response.topic_list.topics.is_empty() {
                tracing::info!("No more topics to fetch. Stopping.");
                break;
            }

            if let Some(prev) = &previous_response {
                if serde_json::to_string(&prev.topic_list.topics)?
                    == serde_json::to_string(&response.topic_list.topics)?
                {
                    info!("Detected identical response. Stopping fetch.");
                    break;
                }
            }

            previous_response = Some(response);
            page += 1;
            sleep(Duration::from_secs_f32(1.0)).await;
        }

        info!("Finished updating topics. Total topics: {}", total_topics);
        Ok(())
    }

    #[instrument(skip(self), fields(url = %url, max_retries = max_retries))]
    async fn fetch_page_with_retries(
        &self,
        url: &str,
        max_retries: usize,
    ) -> Result<TopicResponse> {
        let mut attempt = 0;
        let mut delay = Duration::from_secs(2);

        loop {
            match self.client.get(url).send().await {
                Ok(response) => {
                    if response.status().is_success() {
                        let resp_json = response.json::<TopicResponse>().await?;
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
