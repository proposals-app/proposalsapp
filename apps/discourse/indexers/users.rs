use crate::{
    db_handler::DbHandler,
    discourse_api::DiscourseApi,
    models::users::{User, UserDetailResponse, UserResponse},
};
use anyhow::{Context, Result};
use sea_orm::prelude::Uuid;
use std::sync::Arc;
use tracing::{error, info, instrument};

pub struct UserIndexer {
    discourse_api: Arc<DiscourseApi>,
}

impl UserIndexer {
    pub fn new(discourse_api: Arc<DiscourseApi>) -> Self {
        Self { discourse_api }
    }

    #[instrument(skip(self, db_handler), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_all_users(
        &self,
        db_handler: Arc<DbHandler>,
        dao_discourse_id: Uuid,
    ) -> Result<()> {
        self.update_users(db_handler, dao_discourse_id, "all", None, false)
            .await
    }

    #[instrument(skip(self, db_handler), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_new_users(
        &self,
        db_handler: Arc<DbHandler>,
        dao_discourse_id: Uuid,
    ) -> Result<()> {
        const MAX_PAGES: usize = 3;
        self.update_users(db_handler, dao_discourse_id, "daily", Some(MAX_PAGES), true)
            .await
    }

    #[instrument(skip(self, db_handler), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_users(
        &self,
        db_handler: Arc<DbHandler>,
        dao_discourse_id: Uuid,
        period: &str,
        max_pages: Option<usize>,
        priority: bool,
    ) -> Result<()> {
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
                .fetch(&url, priority)
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
                user.avatar_template = self.process_avatar_url(&user.avatar_template);
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
                    if previous_repeat == 3 {
                        break;
                    }
                }
            }

            previous_response = Some(response);
            page += 1;

            if let Some(max) = max_pages {
                if page >= max {
                    info!("Reached maximum number of pages ({}). Stopping.", max);
                    break;
                }
            }
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
        let url = format!("/u/{}.json", username);
        info!(url, "Fetching user by username");

        let response = self
            .discourse_api
            .fetch::<UserDetailResponse>(&url, priority)
            .await
            .with_context(|| format!("Failed to fetch user by username: {}", username))?;

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

        db_handler.upsert_user(&user, dao_discourse_id).await
    }

    fn process_avatar_url(&self, avatar_template: &str) -> String {
        if avatar_template.starts_with("http") {
            // It's already a full URL, just replace {size}
            avatar_template.replace("{size}", "120")
        } else {
            // It's a relative URL, prepend the base URL and replace {size}
            format!(
                "{}{}",
                self.discourse_api.base_url,
                avatar_template.replace("{size}", "120")
            )
        }
    }
}
