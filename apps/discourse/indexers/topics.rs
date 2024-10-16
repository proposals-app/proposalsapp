use crate::indexers::posts::PostIndexer;
use crate::models::topics::TopicResponse;
use crate::{api_handler::ApiHandler, db_handler::DbHandler};
use anyhow::{Context, Result};
use reqwest::StatusCode;
use sea_orm::prelude::Uuid;
use std::sync::Arc;
use tracing::{info, instrument};

pub struct TopicIndexer {
    api_handler: Arc<ApiHandler>,
}

impl TopicIndexer {
    pub fn new(api_handler: Arc<ApiHandler>) -> Self {
        Self { api_handler }
    }

    #[instrument(skip(self, db_handler), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_all_topics(
        self,
        db_handler: Arc<DbHandler>,
        dao_discourse_id: Uuid,
    ) -> Result<()> {
        let mut total_topics = 0;
        let mut page = 0;

        loop {
            let url = format!("/latest.json?order=created&ascending=true&page={}", page);

            let response: Result<TopicResponse> = self
                .api_handler
                .fetch(&url)
                .await
                .context("Failed to fetch topics");

            match response {
                Ok(response) => {
                    let per_page = response.topic_list.per_page;
                    let num_topics = response.topic_list.topics.len() as i32;
                    total_topics += num_topics;

                    for topic in &response.topic_list.topics {
                        db_handler.upsert_topic(topic, dao_discourse_id).await?;
                    }

                    info!(
                        page = page,
                        num_topics = num_topics,
                        total_topics = total_topics,
                        "Fetched and upserted topics"
                    );

                    if response.topic_list.topics.is_empty() || num_topics < per_page {
                        info!("Reached last page or no more topics. Stopping.");
                        break;
                    }

                    page += 1;
                }
                Err(e) => {
                    if let Some(status) =
                        e.downcast_ref::<reqwest::Error>().and_then(|e| e.status())
                    {
                        if status == StatusCode::NOT_FOUND {
                            info!("Received 404 error. No more pages available. Stopping.");
                            break;
                        }
                    }
                    // If it's not a 404 error, propagate the error
                    return Err(e);
                }
            }
        }

        info!(total_topics = total_topics, "Finished updating topics");
        Ok(())
    }

    #[instrument(skip(self, db_handler), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_new_topics(
        self,
        db_handler: Arc<DbHandler>,
        dao_discourse_id: Uuid,
    ) -> Result<()> {
        let mut total_topics = 0;
        let mut page = 0;

        loop {
            let url = format!("/latest.json?order=created&ascending=true&page={}", page);

            let response: Result<TopicResponse> = self
                .api_handler
                .fetch(&url)
                .await
                .context("Failed to fetch topics");

            match response {
                Ok(response) => {
                    let per_page = response.topic_list.per_page;
                    let num_topics = response.topic_list.topics.len() as i32;
                    total_topics += num_topics;

                    for topic in &response.topic_list.topics {
                        db_handler.upsert_topic(topic, dao_discourse_id).await?;

                        let post_fetcher = PostIndexer::new(Arc::clone(&self.api_handler));
                        post_fetcher
                            .update_posts_for_topic(
                                Arc::clone(&db_handler),
                                dao_discourse_id,
                                topic.id,
                            )
                            .await?;
                    }

                    info!(
                        url = url,
                        "Fetched and upserted page {}: {} new topics (total topics so far: {})",
                        page,
                        num_topics,
                        total_topics
                    );

                    if response.topic_list.topics.is_empty() || num_topics < per_page {
                        info!("Reached last page or no more topics. Stopping.");
                        break;
                    }

                    page += 1;
                }
                Err(e) => {
                    if e.to_string().contains("404") {
                        info!(page = page, "Reached end of pages (404 error). Stopping.");
                        break;
                    }
                    // If it's not a 404 error, propagate the error
                    return Err(e);
                }
            }
        }

        info!(
            "Finished updating new topics. Total topics: {}",
            total_topics
        );
        Ok(())
    }
}
