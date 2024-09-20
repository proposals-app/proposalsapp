use crate::api_handler::ApiHandler;
use crate::db_handler::DbHandler;
use crate::models::posts::PostResponse;
use anyhow::Result;
use sea_orm::prelude::Uuid;
use sea_orm::{ColumnTrait, EntityTrait, PaginatorTrait, QueryFilter};
use std::sync::Arc;
use std::time::Duration;
use tokio::time::sleep;
use tracing::{info, instrument};

pub struct PostFetcher {
    api_handler: Arc<ApiHandler>,
    base_url: String,
}

impl PostFetcher {
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
        let mut total_posts = 0;
        let mut previous_response: Option<PostResponse> = None;

        let current_posts_count = seaorm::discourse_post::Entity::find()
            .filter(seaorm::discourse_post::Column::TopicId.eq(topic_id))
            .count(&db_handler.conn)
            .await?;

        loop {
            let url = format!("{}/t/{}.json?page={}", self.base_url, topic_id, page);
            let response: PostResponse = self.api_handler.fetch(&url).await?;

            if response.posts_count <= current_posts_count as i32 {
                info!("No new posts to fetch for topic {}. Stopping.", topic_id);
                sleep(Duration::from_secs_f32(0.25)).await;
                break;
            }

            let num_posts = response.post_stream.posts.len();
            total_posts += num_posts;

            for post in &response.post_stream.posts {
                db_handler.upsert_post(&post, dao_discourse_id).await?;
            }

            info!(
                "Fetched and upserted page {} for topic {}: {} posts (total posts so far: {})",
                page + 1,
                topic_id,
                num_posts,
                total_posts
            );

            if response.post_stream.posts.is_empty() {
                info!("No more posts to fetch for topic {}. Stopping.", topic_id);
                break;
            }

            if let Some(prev) = &previous_response {
                if serde_json::to_string(&prev.post_stream.posts)?
                    == serde_json::to_string(&response.post_stream.posts)?
                {
                    info!(
                        "Detected identical response for topic {}. Stopping fetch.",
                        topic_id
                    );
                    break;
                }
            }

            previous_response = Some(response);
            page += 1;
            sleep(Duration::from_secs_f32(1.0)).await;
        }

        info!(
            "Finished updating posts for topic {}. Total posts: {}",
            topic_id, total_posts
        );
        Ok(())
    }
}
