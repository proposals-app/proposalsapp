use crate::api_handler::ApiHandler;
use crate::db_handler::DbHandler;
use crate::models::users::{User, UserDetailResponse, UserResponse};
use anyhow::Result;
use sea_orm::prelude::Uuid;
use std::sync::Arc;
use tracing::{info, instrument};

pub struct UserFetcher {
    api_handler: Arc<ApiHandler>,
    base_url: String,
}

impl UserFetcher {
    pub fn new(base_url: &str, api_handler: Arc<ApiHandler>) -> Self {
        Self {
            api_handler,
            base_url: base_url.to_string(),
        }
    }

    #[instrument(skip(self, db_handler), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_all_users(
        self,
        db_handler: &DbHandler,
        dao_discourse_id: Uuid,
    ) -> Result<()> {
        let mut page = 0;
        let mut total_users = 0;
        let mut previous_response: Option<UserResponse> = None;

        loop {
            let url = format!(
                "{}/directory_items.json?page={}&order=asc&period=all",
                self.base_url, page
            );
            let response: UserResponse = self.api_handler.fetch(&url).await?;

            let page_users: Vec<User> = response
                .directory_items
                .iter()
                .map(|item| {
                    let mut user = item.user.clone();
                    user.likes_received = Some(item.likes_received);
                    user.likes_given = Some(item.likes_given);
                    user.topics_entered = Some(item.topics_entered);
                    user.topic_count = Some(item.topic_count);
                    user.post_count = Some(item.post_count);
                    user.posts_read = Some(item.posts_read);
                    user.days_visited = Some(item.days_visited);
                    user
                })
                .collect();
            let num_users = page_users.len();
            total_users += num_users;

            for mut user in page_users {
                user.avatar_template = self.process_avatar_url(&user.avatar_template);
                db_handler.upsert_user(&user, dao_discourse_id).await?;
            }

            tracing::info!(
                "Fetched and upserted page {}: {} users (total users so far: {})",
                page + 1,
                num_users,
                total_users
            );

            if response.directory_items.is_empty() {
                tracing::info!("No more users to fetch. Stopping.");
                break;
            }

            if let Some(prev) = &previous_response {
                if serde_json::to_string(&prev.directory_items)?
                    == serde_json::to_string(&response.directory_items)?
                {
                    info!("Detected identical response. Stopping fetch.");
                    break;
                }
            }

            previous_response = Some(response);
            page += 1;
        }

        Ok(())
    }

    #[instrument(skip(self, db_handler), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_new_users(
        self,
        db_handler: &DbHandler,
        dao_discourse_id: Uuid,
    ) -> Result<()> {
        let mut page = 0;
        let mut total_users = 0;
        let max_pages = 5;

        let mut previous_response: Option<UserResponse> = None;

        while page < max_pages {
            let url = format!(
                "{}/directory_items.json?page={}&period=daily",
                self.base_url, page
            );
            let response: UserResponse = self.api_handler.fetch(&url).await?;

            let page_users: Vec<User> = response
                .directory_items
                .iter()
                .map(|item| {
                    let mut user = item.user.clone();
                    user.likes_received = Some(item.likes_received);
                    user.likes_given = Some(item.likes_given);
                    user.topics_entered = Some(item.topics_entered);
                    user.topic_count = Some(item.topic_count);
                    user.post_count = Some(item.post_count);
                    user.posts_read = Some(item.posts_read);
                    user.days_visited = Some(item.days_visited);
                    user
                })
                .collect();
            let num_users = page_users.len();
            total_users += num_users;

            for mut user in page_users {
                user.avatar_template = self.process_avatar_url(&user.avatar_template);
                db_handler.upsert_user(&user, dao_discourse_id).await?;
            }

            tracing::info!(
                "Fetched and upserted page {}: {} users (total users so far: {})",
                page + 1,
                num_users,
                total_users
            );

            if response.directory_items.is_empty() {
                tracing::info!("No more users to fetch. Stopping.");
                break;
            }

            if let Some(prev) = &previous_response {
                if serde_json::to_string(&prev.directory_items)?
                    == serde_json::to_string(&response.directory_items)?
                {
                    info!("Detected identical response. Stopping fetch.");
                    break;
                }
            }

            previous_response = Some(response);
            page += 1;
        }

        Ok(())
    }

    pub async fn fetch_user_by_username(
        &self,
        username: &str,
        db_handler: &DbHandler,
        dao_discourse_id: Uuid,
    ) -> Result<()> {
        let url = format!("{}/u/{}.json", self.base_url, username);
        let response: UserDetailResponse = self.api_handler.fetch(&url).await?;

        let user = User {
            id: response.user.id,
            username: response.user.username,
            name: response.user.name,
            avatar_template: self.process_avatar_url(&response.user.avatar_template),
            title: response.user.title,
            likes_received: Some(response.user.likes_received),
            likes_given: Some(response.user.likes_given),
            topics_entered: None,
            topic_count: None,
            post_count: Some(response.user.post_count),
            posts_read: None,
            days_visited: None,
        };

        db_handler.upsert_user(&user, dao_discourse_id).await?;
        Ok(())
    }

    fn process_avatar_url(&self, avatar_template: &String) -> String {
        if avatar_template.starts_with("http") {
            // It's already a full URL, just replace {size}
            avatar_template.replace("{size}", "120")
        } else {
            // It's a relative URL, prepend the base URL and replace {size}
            format!(
                "{}{}",
                self.base_url,
                avatar_template.replace("{size}", "120")
            )
        }
    }
}
