use crate::{
    db_handler::upsert_category,
    discourse_api::DiscourseApi,
    models::categories::{Category, CategoryResponse},
};
use anyhow::{Context, Result};
use sea_orm::prelude::Uuid;
use std::sync::Arc;
use tracing::{error, info, instrument};

pub struct CategoryIndexer {
    discourse_api: Arc<DiscourseApi>,
}

impl CategoryIndexer {
    pub fn new(discourse_api: Arc<DiscourseApi>) -> Self {
        Self { discourse_api }
    }

    #[instrument(skip(self), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_all_categories(&self, dao_discourse_id: Uuid) -> Result<()> {
        info!("Starting to update all categories");

        let mut page = 0;
        let mut total_categories = 0;
        let mut previous_response: Option<CategoryResponse> = None;

        loop {
            let url = format!("/categories.json?include_subcategories=true&page={}", page);
            info!(url, "Fetching categories");

            let response: CategoryResponse = self
                .discourse_api
                .queue(&url, false)
                .await
                .with_context(|| format!("Failed to fetch categories from {}", url))?;

            let mut all_categories = Vec::new();
            flatten_categories(&response.category_list.categories, &mut all_categories);

            let num_categories = all_categories.len();
            total_categories += num_categories;

            for category in all_categories {
                if let Err(e) = upsert_category(&category, dao_discourse_id).await {
                    error!(
                        error = ?e,
                        category_id = category.id,
                        "Failed to upsert category"
                    );
                    return Err(e).context("Failed to upsert category")?;
                }
            }

            info!(
                page = page + 1,
                num_categories, total_categories, "Fetched and upserted categories"
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

#[instrument]
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
