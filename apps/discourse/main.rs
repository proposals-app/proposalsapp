use anyhow::{Context, Result};
use api_handler::ApiHandler;
use axum::routing::get;
use axum::Router;
use dotenv::dotenv;
use reqwest::Client;
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
use seaorm::dao_discourse;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tracing::{error, info, warn};
use utils::tracing::setup_tracing;

mod api_handler;
mod db_handler;
mod indexers;
mod models;

use db_handler::DbHandler;
use indexers::categories::CategoryIndexer;
use indexers::topics::TopicIndexer;
use indexers::users::UserIndexer;

const WAIT_FIRST: bool = true;

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    setup_tracing();

    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL must be set")?;
    info!(database_url = %database_url, "Database URL loaded");

    let db_handler = Arc::new(DbHandler::new(&database_url).await?);
    info!("Database handler initialized");

    let app = Router::new().route("/", get("OK"));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        info!(address = %addr, "Starting health check server");
        if let Err(e) = axum::serve(listener, app).await {
            error!(error = %e, "Health check server error");
        }
    });
    info!(port = 3000, "Health check server initialized");

    let dao_discourses = seaorm::dao_discourse::Entity::find()
        .filter(dao_discourse::Column::Enabled.eq(true))
        .all(&db_handler.conn)
        .await?;

    let mut handles = vec![];
    let mut api_handlers = HashMap::new();

    for dao_discourse in dao_discourses {
        let api_handler = Arc::new(ApiHandler::new(dao_discourse.discourse_base_url.clone()));
        api_handlers.insert(dao_discourse.id, Arc::clone(&api_handler));

        // Spawn category fetcher thread
        let db_handler_category_clone = Arc::clone(&db_handler);
        let dao_discourse_category_clone = dao_discourse.clone();
        let api_handler = Arc::clone(&api_handlers[&dao_discourse.id]);
        let category_handle = tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(6 * 60 * 60));
            loop {
                if WAIT_FIRST {
                    interval.tick().await;
                }
                let category_fetcher = CategoryIndexer::new(Arc::clone(&api_handler));
                match category_fetcher
                    .update_all_categories(
                        Arc::clone(&db_handler_category_clone),
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
                if !WAIT_FIRST {
                    interval.tick().await;
                }
            }
        });

        // Spawn user fetcher thread
        let db_handler_users_clone = Arc::clone(&db_handler);
        let dao_discourse_users_clone = dao_discourse.clone();
        let api_handler = Arc::clone(&api_handlers[&dao_discourse.id]);
        let user_handle = tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(6 * 60 * 60));
            loop {
                if WAIT_FIRST {
                    interval.tick().await;
                }
                let user_fetcher = UserIndexer::new(Arc::clone(&api_handler));
                match user_fetcher
                    .update_all_users(
                        Arc::clone(&db_handler_users_clone),
                        dao_discourse_users_clone.id,
                    )
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
                if !WAIT_FIRST {
                    interval.tick().await;
                }
            }
        });

        // Spawn topic fetcher thread
        let db_handler_topic_clone = Arc::clone(&db_handler);
        let dao_discourse_topic_clone = dao_discourse.clone();
        let api_handler = Arc::clone(&api_handlers[&dao_discourse.id]);
        let topic_handle = tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(6 * 60 * 60));
            loop {
                if WAIT_FIRST {
                    interval.tick().await;
                }
                let topic_fetcher = TopicIndexer::new(Arc::clone(&api_handler));
                match topic_fetcher
                    .update_all_topics(
                        Arc::clone(&db_handler_topic_clone),
                        dao_discourse_topic_clone.id,
                    )
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
                if !WAIT_FIRST {
                    interval.tick().await;
                }
            }
        });

        let db_handler_newcontent_clone = Arc::clone(&db_handler);
        let dao_discourse_newcontent_clone = dao_discourse.clone();
        let api_handler = Arc::clone(&api_handlers[&dao_discourse.id]);
        let newcontent_handle = tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(5 * 60));
            loop {
                interval.tick().await;
                let user_fetcher = UserIndexer::new(Arc::clone(&api_handler));

                match user_fetcher
                    .update_new_users(
                        Arc::clone(&db_handler_newcontent_clone),
                        dao_discourse_newcontent_clone.id,
                    )
                    .await
                {
                    Ok(_) => {
                        info!(
                            "Successfully updated new users for {}",
                            dao_discourse_newcontent_clone.discourse_base_url
                        );
                    }
                    Err(e) => {
                        error!(
                            "Error updating new users for {} (ID: {}): {}",
                            dao_discourse_newcontent_clone.discourse_base_url,
                            dao_discourse_newcontent_clone.id,
                            e
                        );
                    }
                }

                let topic_fetcher = TopicIndexer::new(Arc::clone(&api_handler));

                match topic_fetcher
                    .update_new_topics(
                        Arc::clone(&db_handler_newcontent_clone),
                        dao_discourse_newcontent_clone.id,
                    )
                    .await
                {
                    Ok(_) => {
                        info!(
                            "Successfully updated new topics for {}",
                            dao_discourse_newcontent_clone.discourse_base_url
                        );
                    }
                    Err(e) => {
                        error!(
                            "Error updating new topics for {} (ID: {}): {}",
                            dao_discourse_newcontent_clone.discourse_base_url,
                            dao_discourse_topic_clone.id,
                            e
                        );
                    }
                }
            }
        });

        handles.push(category_handle);
        handles.push(user_handle);
        handles.push(topic_handle);
        handles.push(newcontent_handle);
    }

    let uptime_handle = tokio::spawn(async move {
        let client = Client::new();
        loop {
            match client
                .get(
                    std::env::var("BETTERSTACK_KEY")
                        .expect("BETTERSTACK_KEY missing")
                        .to_string(),
                )
                .send()
                .await
            {
                Ok(_) => info!("Uptime ping sent successfully"),
                Err(e) => warn!("Failed to send uptime ping: {:?}", e),
            }
            tokio::time::sleep(Duration::from_secs(10)).await;
        }
    });

    handles.push(uptime_handle);

    futures::future::join_all(handles).await;

    Ok(())
}
