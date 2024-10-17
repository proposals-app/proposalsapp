use crate::discourse_api::DiscourseApi;
use crate::models::categories::Category;
use crate::models::categories::CategoryResponse;
use crate::DbHandler;
use anyhow::Result;
use sea_orm::prelude::Uuid;
use std::sync::Arc;
use tracing::debug;
use tracing::error;
use tracing::info;
use tracing::instrument;

pub struct CategoryIndexer {
    discourse_api: Arc<DiscourseApi>,
}

impl CategoryIndexer {
    pub fn new(discourse_api: Arc<DiscourseApi>) -> Self {
        Self { discourse_api }
    }

    #[instrument(skip(self, db_handler), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_all_categories(
        &self,
        db_handler: Arc<DbHandler>,
        dao_discourse_id: Uuid,
    ) -> Result<()> {
        let mut page = 0;
        let mut total_categories = 0;
        let mut previous_response: Option<CategoryResponse> = None;

        loop {
            let url = format!("/categories.json?include_subcategories=true&page={}", page);
            debug!(url = %url, "Fetching categories");
            let response: CategoryResponse = self.discourse_api.fetch(&url, true).await?;

            let mut all_categories = Vec::new();
            flatten_categories(&response.category_list.categories, &mut all_categories);

            let num_categories = all_categories.len();
            total_categories += num_categories;

            for category in all_categories {
                db_handler
                    .upsert_category(&category, dao_discourse_id)
                    .await
                    .map_err(|e| {
                        error!(
                            error = %e,
                            category_id = category.id,
                            "Failed to upsert category"
                        );
                        e
                    })?;
            }

            info!(
                page = page + 1,
                categories_fetched = num_categories,
                total_categories = total_categories,
                "Fetched and upserted categories"
            );

            if response.category_list.categories.is_empty() {
                info!("No more categories to fetch. Stopping.");
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
        }

        info!(total_categories, "Finished updating categories");
        Ok(())
    }
}

fn flatten_categories(categories: &[Category], result: &mut Vec<Category>) {
    for category in categories {
        let mut category_clone = category.clone();
        category_clone.subcategory_list = None; // Remove subcategory_list to avoid redundancy
        result.push(category_clone);

        if let Some(subcategories) = &category.subcategory_list {
            flatten_categories(subcategories, result);
        }
    }
}
