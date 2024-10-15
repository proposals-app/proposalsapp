use crate::api_handler::ApiHandler;
use crate::db_handler::DbHandler;
use crate::indexers::users::UserIndexer;
use crate::models::posts::PostResponse;
use anyhow::Result;
use sea_orm::prelude::Uuid;
use std::sync::Arc;
use tracing::{error, info, instrument, warn};

pub struct PostIndexer {
    api_handler: Arc<ApiHandler>,
    base_url: String,
}

impl PostIndexer {
    pub fn new(base_url: &str, api_handler: Arc<ApiHandler>) -> Self {
        Self {
            api_handler,
            base_url: base_url.to_string(),
        }
    }
    #[instrument(skip(self, db_handler), fields(dao_discourse_id = %dao_discourse_id, topic_id = topic_id))]
    pub async fn update_posts_for_topic(
        &self,
        db_handler: &DbHandler,
        dao_discourse_id: Uuid,
        topic_id: i32,
    ) -> Result<()> {
        let mut page = 0;
        let mut total_posts_fetched: i32 = 0;
        let mut total_posts_count: i32 = 0;

        loop {
            let url = format!("{}/t/{}.json?page={}", self.base_url, topic_id, page);
            match self.api_handler.fetch::<PostResponse>(&url).await {
                Ok(response) => {
                    if total_posts_count == 0 {
                        total_posts_count = response.posts_count;
                    }

                    let num_posts = response.post_stream.posts.len() as i32;
                    total_posts_fetched += num_posts;

                    for post in &response.post_stream.posts {
                        match db_handler.upsert_post(post, dao_discourse_id).await {
                            Ok(_) => {
                                info!(
                                    post_id = post.id,
                                    topic_id = topic_id,
                                    "Successfully upserted post"
                                );
                            }
                            Err(e) if e.to_string().contains("fk_discourse_post_user") => {
                                warn!(
                                    post_id = post.id,
                                    username = post.username,
                                    "User not found, fetching user details"
                                );
                                let user_fetcher =
                                    UserIndexer::new(&self.base_url, Arc::clone(&self.api_handler));
                                user_fetcher
                                    .fetch_user_by_username(
                                        &post.username,
                                        db_handler,
                                        dao_discourse_id,
                                    )
                                    .await?;

                                db_handler.upsert_post(post, dao_discourse_id).await?;
                                info!(
                                    post_id = post.id,
                                    username = post.username,
                                    "Successfully fetched user and upserted post"
                                );
                            }
                            Err(e) => {
                                error!(
                                    error = %e,
                                    post_id = post.id,
                                    topic_id = topic_id,
                                    "Failed to upsert post"
                                );
                                return Err(anyhow::anyhow!("Failed to upsert post: {}", e));
                            }
                        }
                    }

                    info!(
                        topic_id = topic_id,
                        page = page + 1,
                        num_posts = num_posts,
                        total_posts_fetched = total_posts_fetched,
                        total_posts_count = total_posts_count,
                        url = url,
                        "Fetched and upserted posts for topic"
                    );

                    if total_posts_fetched >= total_posts_count
                        || response.post_stream.posts.is_empty()
                    {
                        info!(
                            topic_id = topic_id,
                            "Finished fetching all posts for topic. Stopping."
                        );
                        break;
                    }

                    page += 1;
                }
                Err(e) => {
                    if e.to_string().contains("404") {
                        info!(
                            topic_id = topic_id,
                            page = page,
                            "Reached end of pages (404 error). Stopping."
                        );
                        break;
                    } else {
                        error!(
                            error = %e,
                            topic_id = topic_id,
                            page = page,
                            "Failed to fetch posts for topic"
                        );
                        return Err(anyhow::anyhow!("Failed to fetch posts for topic: {}", e));
                    }
                }
            }
        }

        info!(
            topic_id = topic_id,
            total_posts_fetched = total_posts_fetched,
            total_posts_count = total_posts_count,
            "Finished updating posts for topic"
        );
        Ok(())
    }
}
