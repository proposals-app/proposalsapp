use crate::indexers::posts::PostIndexer;
use crate::models::topics::TopicResponse;
use crate::{api_handler::ApiHandler, db_handler::DbHandler};
use anyhow::Result;
use sea_orm::prelude::Uuid;
use std::sync::Arc;
use tracing::{info, instrument};

pub struct TopicIndexer {
    api_handler: Arc<ApiHandler>,
    base_url: String,
}

impl TopicIndexer {
    pub fn new(base_url: &str, api_handler: Arc<ApiHandler>) -> Self {
        Self {
            api_handler,
            base_url: base_url.to_string(),
        }
    }
    #[instrument(skip(self, db_handler), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_all_topics(
        self,
        db_handler: &DbHandler,
        dao_discourse_id: Uuid,
    ) -> Result<()> {
        let mut total_topics = 0;
        let mut page = 0;

        loop {
            let url = format!(
                "{}/latest.json?order=created&ascending=true&page={}",
                self.base_url, page
            );
            let response: TopicResponse = self.api_handler.fetch(&url).await?;

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

            if response.topic_list.topics.is_empty() {
                info!("No more topics to fetch. Stopping.");
                break;
            }

            if num_topics < per_page {
                info!("Reached last page. Stopping.");
                break;
            }

            page += 1;
        }

        info!(total_topics = total_topics, "Finished updating topics");
        Ok(())
    }

    #[instrument(skip(self, db_handler), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_new_topics(
        self,
        db_handler: &DbHandler,
        dao_discourse_id: Uuid,
    ) -> Result<()> {
        let mut total_topics = 0;
        let mut page = 0;

        loop {
            let url = format!(
                "{}/latest.json?order=created&ascending=true&page={}",
                self.base_url, page
            );
            let response: TopicResponse = self.api_handler.fetch(&url).await?;

            let per_page = response.topic_list.per_page;
            let num_topics = response.topic_list.topics.len() as i32;
            total_topics += num_topics;

            for topic in &response.topic_list.topics {
                db_handler.upsert_topic(topic, dao_discourse_id).await?;

                let post_fetcher = PostIndexer::new(&self.base_url, Arc::clone(&self.api_handler));
                post_fetcher
                    .update_posts_for_topic(db_handler, dao_discourse_id, topic.id)
                    .await?;
            }

            info!(
                url = url,
                "Fetched and upserted page {}: {} new topics (total topics so far: {})",
                page,
                num_topics,
                total_topics
            );

            if response.topic_list.topics.is_empty() {
                info!("No more new topics to fetch. Stopping.");
                break;
            }

            if num_topics < per_page {
                info!("Reached last page. Stopping.");
                break;
            }

            page += 1;
        }

        info!(
            "Finished updating new topics. Total topics: {}",
            total_topics
        );
        Ok(())
    }
}
