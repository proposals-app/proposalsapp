use crate::indexers::posts::PostIndexer;
use crate::models::topics::TopicResponse;
use crate::{db_handler::DbHandler, discourse_api::DiscourseApi};
use anyhow::Result;
use sea_orm::prelude::Uuid;
use std::sync::Arc;
use tokio::task::JoinSet;
use tracing::{info, instrument};

pub struct TopicIndexer {
    discourse_api: Arc<DiscourseApi>,
}

impl TopicIndexer {
    pub fn new(discourse_api: Arc<DiscourseApi>) -> Self {
        Self { discourse_api }
    }

    #[instrument(skip(self, db_handler), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_all_topics(
        self,
        db_handler: Arc<DbHandler>,
        dao_discourse_id: Uuid,
    ) -> Result<()> {
        self.update_topics(db_handler, dao_discourse_id, true, None, false)
            .await
    }

    #[instrument(skip(self, db_handler), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_new_topics(
        self,
        db_handler: Arc<DbHandler>,
        dao_discourse_id: Uuid,
    ) -> Result<()> {
        const MAX_PAGES: usize = 3;
        self.update_topics(db_handler, dao_discourse_id, false, Some(MAX_PAGES), true)
            .await
    }

    #[instrument(skip(self, db_handler), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_topics(
        self,
        db_handler: Arc<DbHandler>,
        dao_discourse_id: Uuid,
        ascending: bool,
        max_pages: Option<usize>,
        priority: bool,
    ) -> Result<()> {
        let mut total_topics = 0;
        let mut page = 0;
        let mut join_set = JoinSet::new();

        loop {
            let url = format!(
                "/latest.json?order=created&ascending={}&page={}",
                ascending, page
            );
            info!(url = %url, "Fetching topic");

            match self
                .discourse_api
                .fetch::<TopicResponse>(&url, priority)
                .await
            {
                Ok(response) => {
                    let per_page = response.topic_list.per_page;
                    let num_topics = response.topic_list.topics.len() as i32;
                    total_topics += num_topics;

                    for topic in &response.topic_list.topics {
                        db_handler.upsert_topic(topic, dao_discourse_id).await?;

                        let post_fetcher = PostIndexer::new(Arc::clone(&self.discourse_api));
                        let db_handler_clone = Arc::clone(&db_handler);
                        let dao_discourse_id_clone = dao_discourse_id;
                        let topic_id = topic.id;

                        join_set.spawn(async move {
                            if let Err(e) = post_fetcher
                                .update_posts_for_topic(
                                    db_handler_clone,
                                    dao_discourse_id_clone,
                                    topic_id,
                                    priority,
                                )
                                .await
                            {
                                eprintln!("Error updating posts for topic {}: {:?}", topic_id, e);
                            }
                        });
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

                    if let Some(max) = max_pages {
                        if page >= max {
                            info!("Reached maximum number of pages ({}). Stopping.", max);
                            break;
                        }
                    }
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

        while let Some(result) = join_set.join_next().await {
            if let Err(e) = result {
                eprintln!("Error in topic tasks: {:?}", e);
            }
        }

        Ok(())
    }
}
