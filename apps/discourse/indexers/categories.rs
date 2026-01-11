use crate::{
    db_handler::upsert_category,
    discourse_api::DiscourseApi,
    models::categories::{Category, CategoryResponse},
};
use anyhow::{Context, Result};
use sea_orm::prelude::Uuid;
use std::sync::Arc;
use tracing::{debug, error, info, instrument, warn};

#[derive(Clone)] // Add Clone derive
pub struct CategoryIndexer {
    discourse_api: Arc<DiscourseApi>,
}

impl CategoryIndexer {
    pub fn new(discourse_api: Arc<DiscourseApi>) -> Self {
        Self { discourse_api }
    }

    /// Fetches all categories and subcategories, performs a full refresh.
    /// Categories change infrequently, so a single fetch is usually sufficient.
    #[instrument(skip(self), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_all_categories(&self, dao_discourse_id: Uuid) -> Result<()> {
        info!("Starting full category update");

        let url = "/categories.json?include_subcategories=true";
        debug!(url = %url, "Fetching categories");

        let response: CategoryResponse = match self.discourse_api.queue(url, false).await {
            Ok(res) => res,
            Err(e) => {
                if e.to_string().contains("404") || e.to_string().contains("Not Found") {
                    warn!(url = %url, "Categories endpoint not found, skipping category refresh.");
                    return Ok(());
                }
                error!(error = ?e, url = %url, "Failed to fetch categories");
                return Err(e).context("Failed to fetch categories");
            }
        };

        if response.category_list.categories.is_empty() {
            info!("Received empty category list. Stopping.");
            return Ok(());
        }

        let mut all_categories = Vec::new();
        flatten_categories(&response.category_list.categories, &mut all_categories);

        let total_processed_categories = all_categories.len();
        for category in all_categories {
            if let Err(e) = upsert_category(&category, dao_discourse_id).await {
                error!(
                    error = ?e,
                    category_id = category.id,
                    category_name = %category.name,
                    "Failed to upsert category, continuing..."
                );
            }
        }

        info!(total_processed_categories, "Finished updating categories.");
        Ok(())
    }
}

/// Recursively flattens the category list, including subcategories.
#[instrument(skip(categories, result))]
fn flatten_categories(categories: &[Category], result: &mut Vec<Category>) {
    for category in categories {
        // Clone the category
        let category_to_add = category.clone();
        result.push(category_to_add);

        // Recursively flatten children
        if let Some(subcategories) = &category.subcategory_list
            && !subcategories.is_empty()
        {
            debug!(
                parent_category_id = category.id,
                num_subcategories = subcategories.len(),
                "Flattening subcategories"
            );
            flatten_categories(subcategories, result);
        }
    }
}
