use crate::DbHandler;
use anyhow::{anyhow, Result};
use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use reqwest::Client;
use sea_orm::prelude::Uuid;
use std::time::Duration;
use tokio::time::sleep;
use tracing::instrument;
use tracing::{info, warn};

use crate::models::categories::CategoryResponse;

pub struct CategoryFetcher {
    client: Client,
    max_retries: usize,
    base_url: String,
}

impl CategoryFetcher {
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
    pub async fn update_all_categories(
        self,
        db_handler: &DbHandler,
        dao_discourse_id: Uuid,
    ) -> Result<()> {
        let mut page = 0;
        let mut total_categories = 0;
        let mut previous_response: Option<CategoryResponse> = None;

        loop {
            let url = format!("{}/categories.json?page={}", self.base_url, page);
            let response = self.fetch_page_with_retries(&url, self.max_retries).await?;

            let num_categories = response.category_list.categories.len();
            total_categories += num_categories;

            for category in &response.category_list.categories {
                db_handler
                    .upsert_category(category, dao_discourse_id)
                    .await?;
            }

            info!(
                "Fetched and upserted page {}: {} categories (total categories so far: {})",
                page + 1,
                num_categories,
                total_categories
            );

            if response.category_list.categories.is_empty() {
                tracing::info!("No more categories to fetch. Stopping.");
                break;
            }

            if let Some(prev) = &previous_response {
                if serde_json::to_string(&prev.category_list.categories)?
                    == serde_json::to_string(&response.category_list.categories)?
                {
                    info!("Detected identical response. Stopping fetch.");
                    break;
                }
            }

            previous_response = Some(response);
            page += 1;
            sleep(Duration::from_secs_f32(1.0)).await;
        }

        info!(
            "Finished updating categories. Total categories: {}",
            total_categories
        );
        Ok(())
    }

    #[instrument(skip(self), fields(url = %url, max_retries = max_retries))]
    async fn fetch_page_with_retries(
        &self,
        url: &str,
        max_retries: usize,
    ) -> Result<CategoryResponse> {
        let mut attempt = 0;
        let mut delay = Duration::from_secs(1);

        loop {
            match self.client.get(url).send().await {
                Ok(response) => {
                    if response.status().is_success() {
                        let resp_json = response.json::<CategoryResponse>().await?;
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
