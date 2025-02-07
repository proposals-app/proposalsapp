use crate::{
    db_handler::upsert_topic, discourse_api::DiscourseApi, indexers::posts::PostIndexer,
    models::topics::TopicResponse,
};
use anyhow::{Context, Result};
use chrono::Utc;
use sea_orm::prelude::Uuid;
use std::sync::Arc;
use tokio::task::JoinSet;
use tracing::{error, info, instrument};

pub struct TopicIndexer {
    discourse_api: Arc<DiscourseApi>,
}

impl TopicIndexer {
    pub fn new(discourse_api: Arc<DiscourseApi>) -> Self {
        Self { discourse_api }
    }

    #[instrument(skip(self), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_all_topics(self, dao_discourse_id: Uuid) -> Result<()> {
        info!("Starting to update all topics");

        self.update_topics(dao_discourse_id, true, false, false)
            .await
    }

    #[instrument(skip(self), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_recent_topics(self, dao_discourse_id: Uuid) -> Result<()> {
        info!("Starting to update new topics");

        self.update_topics(dao_discourse_id, false, true, true)
            .await
    }

    #[instrument(skip(self), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_topics(
        self,
        dao_discourse_id: Uuid,
        ascending: bool,
        recent: bool,
        priority: bool,
    ) -> Result<()> {
        info!("Starting to update topics");

        let mut total_topics = 0;
        let mut page = 0;
        let mut join_set = JoinSet::new();
        let recent_limit = chrono::Duration::hours(6);
        let mut has_more = true;

        loop {
            if !has_more {
                break;
            }

            let order_by = if recent { "activity" } else { "created" };
            let asc = if ascending { "&ascending=true" } else { "" };

            let url = format!("/latest.json?order={}{}&page={}", order_by, asc, page);
            info!(url, "Fetching topics");

            match self
                .discourse_api
                .queue::<TopicResponse>(&url, priority)
                .await
            {
                Ok(response) => {
                    let per_page = response.topic_list.per_page;
                    let mut num_topics = 0;

                    for topic in &response.topic_list.topics {
                        if recent && topic.last_posted_at < (Utc::now() - recent_limit) {
                            info!("Reached topics older than {}. Stopping.", recent_limit);
                            has_more = false;
                        }

                        total_topics += 1;
                        num_topics += 1;

                        if let Err(e) = upsert_topic(topic, dao_discourse_id).await {
                            error!(
                                error = ?e,
                                topic_id = topic.id,
                                "Failed to upsert topic"
                            );
                            return Err(e).context("Failed to upsert topic")?;
                        }

                        let post_fetcher = PostIndexer::new(Arc::clone(&self.discourse_api));
                        let dao_discourse_id_clone = dao_discourse_id;
                        let topic_id = topic.id;

                        join_set.spawn(async move {
                            if let Err(e) = post_fetcher
                                .update_posts_for_topic(dao_discourse_id_clone, topic_id, priority)
                                .await
                            {
                                error!(
                                    error = ?e,
                                    topic_id = topic_id,
                                    "Error updating posts for topic"
                                );
                            }
                        });
                    }

                    info!(
                        page = page + 1,
                        num_topics, total_topics, url, "Fetched and upserted topics"
                    );

                    if response.topic_list.topics.is_empty() || num_topics < per_page {
                        info!("Reached last page or no more topics. Stopping.");
                        has_more = false;
                    } else {
                        page += 1;
                    }
                }
                Err(e) => {
                    if e.to_string().contains("404") {
                        info!(page, "Reached end of pages (404 error). Stopping.");
                        break;
                    }
                    error!(
                        error = ?e,
                        page,
                        "Failed to fetch topics"
                    );
                    return Err(e).context("Failed to fetch topics")?;
                }
            }
        }

        info!(total_topics, "Finished updating topics");

        while let Some(result) = join_set.join_next().await {
            if let Err(e) = result {
                error!(error = ?e, "Error in topic tasks");
            }
        }

        Ok(())
    }
}
