use crate::{
    db_handler::upsert_user,
    discourse_api::DiscourseApi,
    models::users::{User, UserDetailResponse, UserResponse},
};
use anyhow::{Context, Result};
use reqwest::Client;
use sea_orm::prelude::Uuid;
use std::sync::Arc;
use tracing::{error, info, instrument};

pub struct UserIndexer {
    discourse_api: Arc<DiscourseApi>,
    http_client: Arc<Client>, // Make http_client an Arc
}

impl UserIndexer {
    pub fn new(discourse_api: Arc<DiscourseApi>, http_client: Arc<Client>) -> Self {
        Self {
            discourse_api,
            http_client, // Receive the shared http_client
        }
    }

    #[instrument(skip(self), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_all_users(&self, dao_discourse_id: Uuid) -> Result<()> {
        info!("Starting to update all users");

        self.update_users(dao_discourse_id, false, false).await
    }

    #[instrument(skip(self), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_recent_users(&self, dao_discourse_id: Uuid) -> Result<()> {
        info!("Starting to update new users");

        self.update_users(dao_discourse_id, true, true).await
    }

    #[instrument(skip(self), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_users(&self, dao_discourse_id: Uuid, recent: bool, priority: bool) -> Result<()> {
        info!("Starting to update users");

        let mut page = 0;
        let mut total_users = 0;
        let mut previous_response: Option<UserResponse> = None;
        let mut previous_repeat = 0;
        let order = if recent { "desc" } else { "asc" };
        let page_limit = if recent { 5 } else { -1 }; // -1 indicates no page limit for all users

        loop {
            let url = format!(
                "/directory_items.json?page={}&order={}&period=all",
                page, order
            );
            info!(url, "Fetching users");
            let response: UserResponse = self
                .discourse_api
                .queue(&url, priority)
                .await
                .with_context(|| format!("Failed to fetch users from {}", url))?;

            let page_users: Vec<User> = response
                .directory_items
                .iter()
                .map(|item| {
                    let mut user = item.user.clone();
                    user.likes_received = item.likes_received;
                    user.likes_given = item.likes_given;
                    user.topics_entered = item.topics_entered;
                    user.topic_count = item.topic_count;
                    user.post_count = item.post_count;
                    user.posts_read = item.posts_read;
                    user.days_visited = item.days_visited;
                    user
                })
                .collect();
            let num_users = page_users.len();
            total_users += num_users;

            for mut user in page_users {
                user.avatar_template = self.process_avatar_url(&user.avatar_template).await?;
                if let Err(e) = upsert_user(&user, dao_discourse_id).await {
                    error!(
                        error = ?e,
                        user_id = user.id,
                        "Failed to upsert user"
                    );
                    return Err(e).context("Failed to upsert user")?;
                }
            }

            info!(
                page = page + 1,
                num_users, total_users, url, "Fetched and upserted users"
            );

            if response.directory_items.is_empty() {
                info!("No more users to fetch. Stopping.");
                break;
            }

            if let Some(prev) = &previous_response {
                if serde_json::to_string(&prev.directory_items)? == serde_json::to_string(&response.directory_items)? {
                    info!("Detected identical response. Stopping fetch.");
                    previous_repeat += 1;
                    if previous_repeat == 2 {
                        break;
                    }
                }
            }

            previous_response = Some(response);
            page += 1;

            if recent && page == page_limit {
                info!("Reached page limit for recent users. Stopping.");
                break;
            }
        }

        info!(total_users, "Finished updating users");
        Ok(())
    }

    #[instrument(skip(self), fields(username = %username, dao_discourse_id = %dao_discourse_id))]
    pub async fn fetch_user_by_username(&self, username: &str, dao_discourse_id: Uuid, priority: bool) -> Result<()> {
        info!("Fetching user by username");

        let url = format!("/u/{}.json", username);
        info!(url, "Fetching user by username");

        let response = self
            .discourse_api
            .queue::<UserDetailResponse>(&url, priority)
            .await
            .with_context(|| format!("Failed to fetch user by username: {}", username))?;

        let user = User {
            id: response.user.id,
            username: response.user.username,
            name: response.user.name,
            avatar_template: self
                .process_avatar_url(&response.user.avatar_template)
                .await?,
            title: response.user.title,
            likes_received: None,
            likes_given: None,
            topics_entered: None,
            topic_count: None,
            post_count: None,
            posts_read: None,
            days_visited: None,
        };

        upsert_user(&user, dao_discourse_id).await
    }

    #[instrument(skip(self))]
    async fn process_avatar_url(&self, avatar_template: &str) -> Result<String> {
        let full_url = if avatar_template.starts_with("http") {
            // It's already a full URL, just replace {size}
            avatar_template.replace("{size}", "120")
        } else {
            // It's a relative URL, prepend the base URL and replace {size}
            format!(
                "{}{}",
                self.discourse_api.base_url,
                avatar_template.replace("{size}", "120")
            )
        };

        // Attempt to fetch the URL and check for redirects
        info!(url = %full_url, "Fetching avatar URL to check for redirects");
        let response = self
            .http_client // Use the shared http_client
            .get(&full_url)
            .send()
            .await
            .with_context(|| format!("Failed to fetch avatar URL: {}", full_url))?;

        if response.status().is_redirection() {
            // If there's a redirect, get the final URL
            if let Some(final_url) = response
                .headers()
                .get("location")
                .and_then(|h| h.to_str().ok())
            {
                info!(original_url = %full_url, redirected_url = %final_url, "Avatar URL redirected");
                Ok(final_url.to_string())
            } else {
                error!(url = %full_url, "Redirection without a location header");
                Ok(full_url) // Return the original URL if no location header
            }
        } else if response.status().is_success() {
            info!(url = %full_url, "Avatar URL fetched successfully");
            Ok(full_url) // Return the original URL if no redirect and the
                         // request was successful
        } else {
            error!(url = %full_url, status = %response.status(), "Failed to fetch avatar URL");
            Ok(full_url) // Return the original URL if the request failed
        }
    }
}
