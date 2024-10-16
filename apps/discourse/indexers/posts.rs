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
}

impl PostIndexer {
    pub fn new(api_handler: Arc<ApiHandler>) -> Self {
        Self { api_handler }
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
            let url = format!("/t/{}.json?page={}", topic_id, page);
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
                            Err(e) => {
                                if e.to_string().contains("fk_discourse_post_user") {
                                    warn!(
                                        post_id = post.id,
                                        username = post.username,
                                        "User not found, fetching user details"
                                    );
                                    let user_fetcher =
                                        UserIndexer::new(Arc::clone(&self.api_handler));
                                    match user_fetcher
                                        .fetch_user_by_username(
                                            &post.username,
                                            db_handler,
                                            dao_discourse_id,
                                        )
                                        .await
                                    {
                                        Ok(_) => {
                                            // Try to upsert the post again with the fetched user
                                            if let Err(e) =
                                                db_handler.upsert_post(post, dao_discourse_id).await
                                            {
                                                error!(
                                                    error = %e,
                                                    post_id = post.id,
                                                    topic_id = topic_id,
                                                    "Failed to upsert post after fetching user"
                                                );
                                            }
                                        }
                                        Err(e) => {
                                            warn!(
                                                error = %e,
                                                post_id = post.id,
                                                username = post.username,
                                                "Failed to fetch user, using unknown user"
                                            );
                                            // Get or create the unknown user
                                            let unknown_user = db_handler
                                                .get_or_create_unknown_user(dao_discourse_id)
                                                .await?;

                                            // Create a new post with the unknown user
                                            let mut unknown_post = post.clone();
                                            unknown_post.user_id = unknown_user.id;
                                            unknown_post.username = unknown_user.username.clone();

                                            // Upsert the post with the unknown user
                                            if let Err(e) = db_handler
                                                .upsert_post(&unknown_post, dao_discourse_id)
                                                .await
                                            {
                                                error!(
                                                    error = %e,
                                                    post_id = post.id,
                                                    topic_id = topic_id,
                                                    "Failed to upsert post with unknown user"
                                                );
                                            }
                                        }
                                    }
                                } else {
                                    error!(
                                        error = %e,
                                        post_id = post.id,
                                        topic_id = topic_id,
                                        "Failed to upsert post"
                                    );
                                }
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
