use crate::{
    MAX_PAGES_PER_RUN,
    db_handler::upsert_user,
    discourse_api::DiscourseApi,
    indexers::PageCursor,
    models::users::{User, UserDetailResponse, UserResponse},
};
use anyhow::{Context, Result};
use reqwest::Client;
use sea_orm::prelude::Uuid;
use std::{
    collections::hash_map::DefaultHasher,
    hash::{Hash, Hasher},
    sync::Arc,
    time::Instant,
};
use tracing::{debug, error, info, instrument, warn};

const RECENT_USER_PAGE_LIMIT: u32 = 5; // Limit pages for recent user check

#[derive(Clone, Copy)]
enum DirectoryOrder {
    Username,
    PostCount,
}

impl DirectoryOrder {
    fn as_str(self) -> &'static str {
        match self {
            DirectoryOrder::Username => "username",
            DirectoryOrder::PostCount => "post_count",
        }
    }
}

#[derive(Clone, Copy)]
enum DirectoryPeriod {
    All,
    Weekly,
}

impl DirectoryPeriod {
    fn as_str(self) -> &'static str {
        match self {
            DirectoryPeriod::All => "all",
            DirectoryPeriod::Weekly => "weekly",
        }
    }
}

fn build_directory_url(
    page: u32,
    order: DirectoryOrder,
    asc: bool,
    period: DirectoryPeriod,
) -> String {
    let mut url = format!(
        "/directory_items.json?page={page}&order={}&period={}",
        order.as_str(),
        period.as_str()
    );
    if asc {
        url.push_str("&asc=true");
    }
    url
}

// Derive Clone to allow easy cloning for tasks
#[derive(Clone)]
pub struct UserIndexer {
    discourse_api: Arc<DiscourseApi>,
    http_client: Arc<Client>, // Shared HTTP client for avatar checks
}

impl UserIndexer {
    pub fn new(discourse_api: Arc<DiscourseApi>, http_client: Arc<Client>) -> Self {
        Self {
            discourse_api,
            http_client,
        }
    }

    /// Fetches and updates users based on recent activity (weekly activity ranking).
    /// Limited to a few pages. Uses high priority for API requests.
    #[instrument(skip(self), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_recent_users(&self, dao_discourse_id: Uuid) -> Result<()> {
        info!("Starting update of recent users (high priority)");
        self.update_users_internal(
            dao_discourse_id,
            true, /* recent */
            true, /* priority */
            Some(RECENT_USER_PAGE_LIMIT),
        )
        .await
    }

    /// Fetches and updates *all* users from the directory in a stable order.
    /// This is a full refresh/backfill task. Uses low priority for API requests.
    #[instrument(skip(self), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_all_users(&self, dao_discourse_id: Uuid) -> Result<()> {
        info!("Starting full update of all users (low priority)");
        self.update_users_internal(
            dao_discourse_id,
            false, /* recent -> false means fetch all */
            false, /* priority */
            None,  /* no page limit */
        )
        .await
    }

    /// Internal helper to fetch and process users from the directory endpoint.
    #[instrument(skip(self), fields(dao_discourse_id = %dao_discourse_id, recent = recent, priority = priority, ?page_limit))]
    async fn update_users_internal(
        &self,
        dao_discourse_id: Uuid,
        recent: bool,
        priority: bool,
        page_limit: Option<u32>,
    ) -> Result<()> {
        let start_time = Instant::now();
        info!("Starting user update process");

        let mut pager = PageCursor::new(MAX_PAGES_PER_RUN);
        let mut total_processed_users = 0;
        let mut last_response_hash: Option<u64> = None;
        let mut consecutive_identical_responses = 0;

        let (order, asc, period) = if recent {
            (DirectoryOrder::PostCount, false, DirectoryPeriod::Weekly)
        } else {
            (DirectoryOrder::Username, true, DirectoryPeriod::All)
        };

        loop {
            let page = pager.page();
            let url = build_directory_url(page, order, asc, period);
            debug!(%url, "Fetching users page");

            let response: UserResponse = match self
                .discourse_api
                .queue(&url, priority) // Use priority flag
                .await
            {
                Ok(res) => res,
                Err(e) => {
                    // Handle 404 as end-of-pages signal
                    if e.to_string().contains("404") || e.to_string().contains("Not Found") {
                        info!(page, "Received 404/Not Found, assuming end of user pages.");
                        break;
                    }
                    error!(error = ?e, page, url = %url, "Failed to fetch users page");
                    return Err(e).context(format!("Failed to fetch users page {page}"));
                }
            };

            let directory_items = response.directory_items;
            let num_users_on_page = directory_items.len();

            if directory_items.is_empty() {
                info!(page, "Received empty user list. Stopping.");
                break;
            }

            // Check for identical response pages to detect potential API loops
            let current_hash = {
                let mut hasher = DefaultHasher::new();
                // Hash the relevant part of the response (e.g., serialized items)
                if let Ok(serialized) = serde_json::to_string(&directory_items) {
                    serialized.hash(&mut hasher);
                } else {
                    // Fallback hash if serialization fails (less reliable)
                    page.hash(&mut hasher);
                }
                hasher.finish()
            };

            if Some(current_hash) == last_response_hash {
                consecutive_identical_responses += 1;
                warn!(
                    page,
                    consecutive_identical_responses, "Detected identical user response page."
                );
                if consecutive_identical_responses >= 2 {
                    error!(
                        page,
                        "Stopping user fetch due to repeated identical responses."
                    );
                    break; // Assume an issue and stop
                }
            } else {
                consecutive_identical_responses = 0; // Reset counter
                last_response_hash = Some(current_hash); // Update hash only if different
            }

            total_processed_users += num_users_on_page;

            // Process users fetched on this page
            for item in directory_items {
                // Map DirectoryItem to the User struct expected by upsert_user
                let mut user = item.user; // Starts with basic user info
                // Add stats from the directory item
                user.likes_received = item.likes_received;
                user.likes_given = item.likes_given;
                user.topics_entered = item.topics_entered;
                user.topic_count = item.topic_count;
                user.post_count = item.post_count;
                user.posts_read = item.posts_read;
                user.days_visited = item.days_visited;

                // Process avatar URL asynchronously (could be parallelized further if needed)
                match self.process_avatar_url(&user.avatar_template).await {
                    Ok(processed_url) => user.avatar_template = processed_url,
                    Err(e) => {
                        // Log error but continue with the original template URL
                        warn!(error = ?e, username = %user.username, avatar_template = %user.avatar_template, "Failed to process avatar URL, using original.");
                    }
                }

                // Upsert the user data
                if let Err(e) = upsert_user(&user, dao_discourse_id).await {
                    error!(
                        error = ?e,
                        user_id = user.id,
                        username = %user.username,
                        "Failed to upsert user, continuing..."
                    );
                    // Optionally collect errors
                }
            }

            info!(
                page,
                num_users_on_page, total_processed_users, "Processed users page"
            );

            // Check termination conditions
            if let Some(limit) = page_limit
                && page >= limit
            {
                info!(page, limit, "Reached page limit for user fetch. Stopping.");
                break;
            }

            if !pager.advance("user directory pages") {
                break;
            }
        } // End loop

        let duration = start_time.elapsed();
        info!(total_processed_users, duration = ?duration, "Finished updating users.");
        Ok(())
    }

    /// Fetches user details by username and upserts them into the database.
    /// Returns the external user ID upon successful upsert.
    #[instrument(skip(self), fields(username = %username, dao_discourse_id = %dao_discourse_id, priority = priority))]
    pub async fn fetch_and_upsert_user(
        &self,
        username: &str,
        dao_discourse_id: Uuid,
        priority: bool,
    ) -> Result<i32> {
        // Return the user ID
        debug!("Fetching user by username for upsert");

        let url = format!("/u/{username}.json");
        debug!(%url, "Fetching user details");

        // Fetch user details from the API
        let response: UserDetailResponse = self
            .discourse_api
            .queue(&url, priority) // Use priority flag
            .await
            .with_context(|| format!("Failed to fetch user details for username: {username}"))?;

        let user_detail = response.user;

        // Process avatar URL
        let processed_avatar_url = match self.process_avatar_url(&user_detail.avatar_template).await
        {
            Ok(url) => url,
            Err(e) => {
                warn!(error = ?e, username = %username, avatar_template = %user_detail.avatar_template, "Failed to process avatar URL, using original.");
                user_detail.avatar_template // Use original on error
            }
        };

        // Construct the User object for upserting. Note: This endpoint doesn't provide stats.
        let user_to_upsert = User {
            id: user_detail.id,
            username: user_detail.username,
            name: user_detail.name,
            avatar_template: processed_avatar_url,
            title: user_detail.title,
            // Stats are not available from /u/{username}.json. Set to None.
            // `upsert_user` needs to handle these None values correctly
            // (i.e., not overwrite existing stats if the user record already exists).
            // The current `upsert_user` ON CONFLICT clause handles this correctly by only
            // updating the columns explicitly listed, which includes stats.
            likes_received: None,
            likes_given: None,
            topics_entered: None,
            topic_count: None,
            post_count: None,
            posts_read: None,
            days_visited: None,
        };

        // Upsert the user data
        upsert_user(&user_to_upsert, dao_discourse_id)
            .await
            .with_context(|| format!("Failed to upsert user fetched by username: {username}"))?;

        debug!(user_id = user_to_upsert.id, username = %username, "Successfully fetched and upserted user.");
        Ok(user_to_upsert.id) // Return the external user ID
    }

    /// Processes the avatar template URL, resolving relative paths and checking for redirects.
    #[instrument(skip(self, avatar_template))]
    async fn process_avatar_url(&self, avatar_template: &str) -> Result<String> {
        if avatar_template.is_empty() {
            return Ok(String::new()); // Handle empty template
        }

        // Construct the full URL, replacing {size} placeholder. Use a common size like 120.
        let sized_template = avatar_template.replace("{size}", "120");
        let full_url = if sized_template.starts_with("http") || sized_template.starts_with("//") {
            // Handle absolute URLs and protocol-relative URLs
            if sized_template.starts_with("//") {
                // Assume https for protocol-relative URLs
                format!("https:{sized_template}")
            } else {
                sized_template
            }
        } else {
            // Handle relative URLs (prepend base URL)
            format!(
                "{}{}",
                self.discourse_api.base_url.trim_end_matches('/'),
                if sized_template.starts_with('/') {
                    sized_template // Already starts with /
                } else {
                    format!("/{sized_template}") // Prepend / if missing
                }
            )
        };

        // Use a HEAD request first to check existence and redirects efficiently
        debug!(url = %full_url, "Checking avatar URL with HEAD request");
        match self.http_client.head(&full_url).send().await {
            Ok(response) => {
                let final_url = response.url().to_string(); // URL after potential redirects
                if response.status().is_success() {
                    debug!(original_url = %full_url, final_url = %final_url, status = %response.status(), "Avatar URL check successful.");
                    Ok(final_url) // Return the final URL (might be same as original)
                } else {
                    warn!(original_url = %full_url, final_url = %final_url, status = %response.status(), "Avatar HEAD request failed. Falling back to original URL.");
                    // Fallback to the originally constructed URL if HEAD fails (e.g., 404, 403)
                    Ok(full_url)
                }
            }
            Err(e) => {
                error!(error = ?e, url = %full_url, "Failed to send HEAD request for avatar URL. Falling back to original URL.");
                // Fallback to the originally constructed URL on network error
                Ok(full_url)
            }
        }
    }
}
