use crate::{
    db_handler::upsert_category,
    discourse_api::DiscourseApi,
    models::categories::{Category, CategoryResponse},
};
use anyhow::{Context, Result};
use sea_orm::prelude::Uuid;
use std::{
    collections::hash_map::DefaultHasher,
    hash::{Hash, Hasher},
    sync::Arc,
};
use tracing::{debug, error, info, instrument, warn};

const MAX_CATEGORY_PAGES: u32 = 50; // Safety break for pagination

#[derive(Clone)] // Add Clone derive
pub struct CategoryIndexer {
    discourse_api: Arc<DiscourseApi>,
}

impl CategoryIndexer {
    pub fn new(discourse_api: Arc<DiscourseApi>) -> Self {
        Self { discourse_api }
    }

    /// Fetches all categories and subcategories, performs a full refresh.
    /// Categories change infrequently, so a "recent" fetch isn't usually necessary.
    #[instrument(skip(self), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_all_categories(&self, dao_discourse_id: Uuid) -> Result<()> {
        info!("Starting full category update");

        let mut page: u32 = 0; // Use u32 for page number
        let mut total_processed_categories = 0;
        let mut last_response_hash: Option<u64> = None;
        let mut consecutive_identical_responses = 0;

        loop {
            // Fetch categories including subcategories.
            // Note: Discourse's category pagination can be inconsistent.
            // We add safety breaks.
            let url = format!("/categories.json?include_subcategories=true&page={}", page);
            debug!(%url, "Fetching categories page");

            let response: CategoryResponse = match self
                .discourse_api
                .queue(&url, false) // Categories are low priority
                .await
            {
                Ok(res) => res,
                Err(e) => {
                    // Handle 404 specifically as end-of-pages signal
                    if e.to_string().contains("404") || e.to_string().contains("Not Found") {
                        info!(
                            page,
                            "Received 404/Not Found, assuming end of category pages."
                        );
                        break;
                    }
                    // For other errors, log and return error
                    error!(error = ?e, page, url = %url, "Failed to fetch categories page");
                    return Err(e).context(format!("Failed to fetch categories page {}", page));
                }
            };

            // Check for end condition: empty response
            if response.category_list.categories.is_empty() {
                info!(page, "Received empty category list. Stopping.");
                break;
            }

            // Check for end condition: identical response (potential API loop/bug)
            // Use std::hash::Hash on the response struct (requires deriving Hash) or serialize to string
            if let Ok(serialized) = serde_json::to_string(&response.category_list.categories) {
                let current_hash = {
                    let mut hasher = DefaultHasher::new();
                    serialized.hash(&mut hasher);
                    hasher.finish()
                };

                if Some(current_hash) == last_response_hash {
                    consecutive_identical_responses += 1;
                    warn!(
                        page,
                        consecutive_identical_responses, "Detected identical category response page. Potential issue."
                    );
                    if consecutive_identical_responses >= 2 {
                        error!(
                            page,
                            "Stopping category fetch due to repeated identical responses."
                        );
                        break;
                    }
                } else {
                    consecutive_identical_responses = 0; // Reset counter
                    last_response_hash = Some(current_hash); // Update hash only if different
                }
            }

            // Flatten the nested structure and process
            let mut current_page_categories = Vec::new();
            flatten_categories(
                &response.category_list.categories,
                &mut current_page_categories,
            );

            let num_categories_on_page = current_page_categories.len();
            total_processed_categories += num_categories_on_page;

            for category in current_page_categories {
                if let Err(e) = upsert_category(&category, dao_discourse_id).await {
                    // Log error but continue processing other categories on the page
                    error!(
                        error = ?e,
                        category_id = category.id,
                        category_name = %category.name,
                        "Failed to upsert category, continuing..."
                    );
                    // Optionally, collect errors and return an aggregate error at the end
                }
            }

            info!(
                page,
                num_categories_on_page, total_processed_categories, "Processed categories page"
            );

            // Safety break: prevent infinite loops if pagination logic fails
            if page >= MAX_CATEGORY_PAGES {
                error!(
                    page,
                    MAX_CATEGORY_PAGES, "Reached maximum category page limit. Stopping."
                );
                break;
            }

            page += 1;
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
        if let Some(subcategories) = &category.subcategory_list {
            if !subcategories.is_empty() {
                debug!(
                    parent_category_id = category.id,
                    num_subcategories = subcategories.len(),
                    "Flattening subcategories"
                );
                flatten_categories(subcategories, result);
            }
        }
    }
}
