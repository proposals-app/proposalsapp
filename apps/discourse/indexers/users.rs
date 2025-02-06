use crate::{
    db_handler::DbHandler,
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
    http_client: Client,
}

impl UserIndexer {
    pub fn new(discourse_api: Arc<DiscourseApi>) -> Self {
        Self {
            discourse_api,
            http_client: Client::new(),
        }
    }

    #[instrument(skip(self, db_handler), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_all_users(
        &self,
        db_handler: Arc<DbHandler>,
        dao_discourse_id: Uuid,
    ) -> Result<()> {
        info!("Starting to update all users");

        self.update_users(db_handler, dao_discourse_id, "all", false)
            .await
    }

    #[instrument(skip(self, db_handler), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_recent_users(
        &self,
        db_handler: Arc<DbHandler>,
        dao_discourse_id: Uuid,
    ) -> Result<()> {
        info!("Starting to update new users");

        self.update_users(db_handler, dao_discourse_id, "daily", true)
            .await
    }

    #[instrument(skip(self, db_handler), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_users(
        &self,
        db_handler: Arc<DbHandler>,
        dao_discourse_id: Uuid,
        period: &str,
        priority: bool,
    ) -> Result<()> {
        info!("Starting to update users");

        let mut page = 0;
        let mut total_users = 0;
        let mut previous_response: Option<UserResponse> = None;
        let mut previous_repeat = 0;

        loop {
            let url = format!(
                "/directory_items.json?page={}&order=asc&period={}",
                page, period
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
                if let Err(e) = db_handler.upsert_user(&user, dao_discourse_id).await {
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
                if serde_json::to_string(&prev.directory_items)?
                    == serde_json::to_string(&response.directory_items)?
                {
                    info!("Detected identical response. Stopping fetch.");
                    previous_repeat += 1;
                    if previous_repeat == 2 {
                        break;
                    }
                }
            }

            previous_response = Some(response);
            page += 1;
        }

        info!(total_users, "Finished updating all users");
        Ok(())
    }

    #[instrument(skip(self, db_handler), fields(username = %username, dao_discourse_id = %dao_discourse_id))]
    pub async fn fetch_user_by_username(
        &self,
        username: &str,
        db_handler: &DbHandler,
        dao_discourse_id: Uuid,
        priority: bool,
    ) -> Result<()> {
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

        db_handler.upsert_user(&user, dao_discourse_id).await
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
            .http_client
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
            Ok(full_url) // Return the original URL if no redirect and the request was successful
        } else {
            error!(url = %full_url, status = %response.status(), "Failed to fetch avatar URL");
            Ok(full_url) // Return the original URL if the request failed
        }
    }
}
