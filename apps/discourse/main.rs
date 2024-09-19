use anyhow::{Context, Result};
use dotenv::dotenv;
use sea_orm::EntityTrait;
use std::sync::Arc;
use std::time::Duration;
use tracing::{error, info};
use utils::tracing::setup_tracing;

mod db_handler;
mod fetchers;
mod models;

use db_handler::DbHandler;
use fetchers::categories::CategoryFetcher;
use fetchers::topics::TopicFetcher;
use fetchers::users::UserFetcher;

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    setup_tracing();

    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL must be set")?;
    let db_handler = Arc::new(DbHandler::new(&database_url).await?);

    let dao_discourses = seaorm::dao_discourse::Entity::find()
        .all(&db_handler.conn)
        .await?;

    let mut handles = vec![];
    for dao_discourse in dao_discourses {
        // Spawn user fetcher thread
        let db_handler_users_clone = Arc::clone(&db_handler);
        let dao_discourse_users_clone = dao_discourse.clone();
        let user_handle = tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(60 * 60));
            loop {
                interval.tick().await;
                let user_fetcher =
                    UserFetcher::new(&dao_discourse_users_clone.discourse_base_url, 3);
                match user_fetcher
                    .update_all_users(&db_handler_users_clone, dao_discourse_users_clone.id)
                    .await
                {
                    Ok(_) => {
                        info!(
                            "Successfully updated users for {}",
                            dao_discourse_users_clone.discourse_base_url
                        );
                    }
                    Err(e) => {
                        error!(
                            "Error updating users for {} (ID: {}): {}",
                            dao_discourse_users_clone.discourse_base_url,
                            dao_discourse_users_clone.id,
                            e
                        );
                    }
                }
            }
        });

        // Spawn category fetcher thread
        let db_handler_category_clone = Arc::clone(&db_handler);
        let dao_discourse_category_clone = dao_discourse.clone();
        let category_handle = tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(60 * 60));
            loop {
                interval.tick().await;
                let category_fetcher =
                    CategoryFetcher::new(&dao_discourse_category_clone.discourse_base_url, 3);
                match category_fetcher
                    .update_all_categories(
                        &db_handler_category_clone,
                        dao_discourse_category_clone.id,
                    )
                    .await
                {
                    Ok(_) => {
                        info!(
                            "Successfully updated categories for {}",
                            dao_discourse_category_clone.discourse_base_url
                        );
                    }
                    Err(e) => {
                        error!(
                            "Error updating categories for {} (ID: {}): {}",
                            dao_discourse_category_clone.discourse_base_url,
                            dao_discourse_category_clone.id,
                            e
                        );
                    }
                }
            }
        });

        // Spawn topic fetcher thread
        let db_handler_topic_clone = Arc::clone(&db_handler);
        let dao_discourse_topic_clone = dao_discourse.clone();
        let topic_handle = tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(60 * 60));
            loop {
                interval.tick().await;
                let topic_fetcher =
                    TopicFetcher::new(&dao_discourse_topic_clone.discourse_base_url, 3);
                match topic_fetcher
                    .update_all_topics(&db_handler_topic_clone, dao_discourse_topic_clone.id)
                    .await
                {
                    Ok(_) => {
                        info!(
                            "Successfully updated topics for {}",
                            dao_discourse_topic_clone.discourse_base_url
                        );
                    }
                    Err(e) => {
                        error!(
                            "Error updating topics for {} (ID: {}): {}",
                            dao_discourse_topic_clone.discourse_base_url,
                            dao_discourse_topic_clone.id,
                            e
                        );
                    }
                }
            }
        });

        handles.push(user_handle);
        handles.push(category_handle);
        handles.push(topic_handle);
    }

    futures::future::join_all(handles).await;

    Ok(())
}
