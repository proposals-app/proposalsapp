use crate::api_handler::ApiHandler;
use crate::models::categories::CategoryResponse;
use crate::DbHandler;
use anyhow::Result;
use sea_orm::prelude::Uuid;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::sleep;
use tracing::info;
use tracing::instrument;

pub struct CategoryFetcher {
    api_handler: Arc<ApiHandler>,
    base_url: String,
}

impl CategoryFetcher {
    pub fn new(base_url: &str, api_handler: Arc<ApiHandler>) -> Self {
        Self {
            api_handler,
            base_url: base_url.to_string(),
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
            let response: CategoryResponse = self.api_handler.fetch(&url).await?;

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
}
