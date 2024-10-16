use crate::api_handler::ApiHandler;
use crate::db_handler::DbHandler;
use crate::models::users::{User, UserDetailResponse, UserResponse};
use anyhow::Result;
use sea_orm::prelude::Uuid;
use std::sync::Arc;
use tracing::{info, instrument};

pub struct UserIndexer {
    api_handler: Arc<ApiHandler>,
}

impl UserIndexer {
    pub fn new(api_handler: Arc<ApiHandler>) -> Self {
        Self { api_handler }
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
        let mut previous_repeat = 0;
        loop {
            let url = format!("/directory_items.json?page={}&order=asc&period=all", page);
            let response: UserResponse = self.api_handler.fetch(&url).await?;

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
                user.avatar_template = self.process_avatar_url(&user.avatar_template);
                db_handler.upsert_user(&user, dao_discourse_id).await?;
            }

            info!(
                page = page + 1,
                num_users = num_users,
                total_users = total_users,
                url = url,
                "Fetched and upserted users"
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
                    previous_repeat = previous_repeat + 1;
                    if previous_repeat == 3 {
                        break;
                    }
                }
            }

            previous_response = Some(response);
            page += 1;
        }

        info!(total_users = total_users, "Finished updating all users");
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
            let url = format!("/directory_items.json?page={}&period=daily", page);
            let response: UserResponse = self.api_handler.fetch(&url).await?;

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
                user.avatar_template = self.process_avatar_url(&user.avatar_template);
                db_handler.upsert_user(&user, dao_discourse_id).await?;
            }

            info!(
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

    #[instrument(skip(self, db_handler), fields(username = %username, dao_discourse_id = %dao_discourse_id))]
    pub async fn fetch_user_by_username(
        &self,
        username: &str,
        db_handler: &DbHandler,
        dao_discourse_id: Uuid,
    ) -> Result<()> {
        let url = format!("/u/{}.json", username);

        info!("Fetch user by username: {}", url);

        let response = self.api_handler.fetch::<UserDetailResponse>(&url).await?;

        let user = User {
            id: response.user.id,
            username: response.user.username,
            name: response.user.name,
            avatar_template: self.process_avatar_url(&response.user.avatar_template),
            title: response.user.title,
            likes_received: None,
            likes_given: None,
            topics_entered: None,
            topic_count: None,
            post_count: None,
            posts_read: None,
            days_visited: None,
        };

        db_handler.upsert_user(&user, dao_discourse_id).await?;
        Ok(())
    }

    fn process_avatar_url(&self, avatar_template: &str) -> String {
        if avatar_template.starts_with("http") {
            // It's already a full URL, just replace {size}
            avatar_template.replace("{size}", "120")
        } else {
            // It's a relative URL, prepend the base URL and replace {size}
            format!("{}", avatar_template.replace("{size}", "120"))
        }
    }
}
