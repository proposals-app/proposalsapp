#![warn(unused_extern_crates)]

use crate::metrics::Metrics;
use anyhow::{Context, Result};
use axum::{routing::get, Router};
use db_handler::DbHandler;
use discourse_api::DiscourseApi;
use dotenv::dotenv;
use indexers::{
    categories::CategoryIndexer, revisions::RevisionIndexer, topics::TopicIndexer,
    users::UserIndexer,
};
use reqwest::Client;
use sea_orm::{prelude::Uuid, ColumnTrait, EntityTrait, QueryFilter};
use seaorm::dao_discourse;
use std::{collections::HashMap, sync::Arc, time::Duration};
use tokio::{
    signal,
    time::{interval_at, Instant},
};
use tracing::{error, info, warn};
use utils::tracing::setup_tracing;

mod db_handler;
mod discourse_api;
mod indexers;
mod metrics;
mod models;

const SLOW_INDEX: Duration = Duration::from_secs(6 * 60 * 60);

lazy_static::lazy_static! {
    static ref DAO_DISCOURSE_ID_TO_CATEGORY_IDS_PROPOSALS: HashMap<Uuid, Vec<i32>> = {
        let mut m = HashMap::new();

        //forum.arbitrum.foundation
        m.insert(Uuid::parse_str("099352eb-b859-44ff-acbc-76806d304086").unwrap(), vec![7,8,9]);
        // Add more mappings as needed
        m
    };
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    let _tracing = setup_tracing().await?;

    info!("Application starting up");

    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL must be set")?;

    let metrics = Arc::new(Metrics::new());
    let db_handler = Arc::new(DbHandler::new(&database_url, Arc::clone(&metrics)).await?);
    info!(database_url = %database_url, "Initial database connection established");

    let app = Router::new().route("/", get(|| async { "OK" }));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        info!(address = %addr, "Starting health check server");
        if let Err(e) = axum::serve(listener, app).await {
            error!(error = ?e, "Health check server error");
        }
    });
    info!(port = 3000, address = %addr, "Health check server initialized and listening");

    let dao_discourses = seaorm::dao_discourse::Entity::find()
        .filter(dao_discourse::Column::Enabled.eq(true))
        .all(&db_handler.conn)
        .await?;

    let mut handles = vec![];
    let mut discourse_apis = HashMap::new();

    for dao_discourse in dao_discourses {
        let discourse_api = Arc::new(DiscourseApi::new(
            dao_discourse.discourse_base_url.clone(),
            dao_discourse.with_user_agent,
            Arc::clone(&metrics),
        ));
        discourse_apis.insert(dao_discourse.id, Arc::clone(&discourse_api));

        // Spawn category fetcher thread
        let db_handler_category_clone = Arc::clone(&db_handler);
        let dao_discourse_category_clone = dao_discourse.clone();
        let api_handler = Arc::clone(&discourse_apis[&dao_discourse.id]);
        let category_handle = tokio::spawn(async move {
            let start = Instant::now() + Duration::from_secs(10);
            let mut interval = interval_at(start, SLOW_INDEX);

            interval.tick().await;
            loop {
                interval.tick().await;

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
                            discourse_url = %dao_discourse_category_clone.discourse_base_url,
                            "Successfully updated categories"
                        );
                    }
                    Err(e) => {
                        error!(
                            error = ?e,
                            discourse_url = %dao_discourse_category_clone.discourse_base_url,
                            discourse_id = %dao_discourse_category_clone.id,
                            "Error updating categories"
                        );
                    }
                }
            }
        });

        // Spawn user fetcher thread
        let db_handler_users_clone = Arc::clone(&db_handler);
        let dao_discourse_users_clone = dao_discourse.clone();
        let api_handler = Arc::clone(&discourse_apis[&dao_discourse.id]);
        let user_handle = tokio::spawn(async move {
            let start = Instant::now() + Duration::from_secs(10);
            let mut interval = interval_at(start, SLOW_INDEX);

            interval.tick().await;
            loop {
                interval.tick().await;
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
                            discourse_url = %dao_discourse_users_clone.discourse_base_url,
                            "Successfully updated users"
                        );
                    }
                    Err(e) => {
                        error!(
                            error = ?e,
                            discourse_url = %dao_discourse_users_clone.discourse_base_url,
                            discourse_id = %dao_discourse_users_clone.id,
                            "Error updating users"
                        );
                    }
                }
            }
        });

        // Spawn topic fetcher thread
        let db_handler_topic_clone = Arc::clone(&db_handler);
        let dao_discourse_topic_clone = dao_discourse.clone();
        let api_handler = Arc::clone(&discourse_apis[&dao_discourse.id]);
        let topic_handle = tokio::spawn(async move {
            let start = Instant::now() + Duration::from_secs(10);
            let mut interval = interval_at(start, SLOW_INDEX);

            interval.tick().await;
            loop {
                interval.tick().await;
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
                            discourse_url = %dao_discourse_topic_clone.discourse_base_url,
                            "Successfully updated topics"
                        );
                    }
                    Err(e) => {
                        error!(
                            error = ?e,
                            discourse_url = %dao_discourse_topic_clone.discourse_base_url,
                            discourse_id = %dao_discourse_topic_clone.id,
                            "Error updating topics"
                        );
                    }
                }
            }
        });

        // Spawn revision fetcher thread
        let db_handler_revision_clone = Arc::clone(&db_handler);
        let dao_discourse_revision_clone = dao_discourse.clone();
        let api_handler = Arc::clone(&discourse_apis[&dao_discourse.id]);
        let revision_handle = tokio::spawn(async move {
            let start = Instant::now() + Duration::from_secs(10);
            let mut interval = interval_at(start, SLOW_INDEX);
            interval.tick().await;
            loop {
                interval.tick().await;
                let revision_fetcher = RevisionIndexer::new(Arc::clone(&api_handler));
                match revision_fetcher
                    .update_all_revisions(
                        Arc::clone(&db_handler_revision_clone),
                        dao_discourse_revision_clone.id,
                    )
                    .await
                {
                    Ok(_) => {
                        info!(
                            discourse_url = %dao_discourse_revision_clone.discourse_base_url,
                            "Successfully updated revisions"
                        );
                    }
                    Err(e) => {
                        error!(
                            error = ?e,
                            discourse_url = %dao_discourse_revision_clone.discourse_base_url,
                            discourse_id = %dao_discourse_revision_clone.id,
                            "Error updating revisions"
                        );
                    }
                }
            }
        });

        // Spawn new content fetcher thread
        let db_handler_newcontent_clone = Arc::clone(&db_handler);
        let dao_discourse_newcontent_clone = dao_discourse.clone();
        let api_handler = Arc::clone(&discourse_apis[&dao_discourse.id]);
        let newcontent_handle = tokio::spawn(async move {
            loop {
                while !api_handler.is_priority_queue_empty() {
                    tokio::time::sleep(Duration::from_millis(100)).await;
                }

                let user_fetcher = UserIndexer::new(Arc::clone(&api_handler));
                let topic_fetcher = TopicIndexer::new(Arc::clone(&api_handler));
                let revision_fetcher = RevisionIndexer::new(Arc::clone(&api_handler));

                let (user_result, topic_result, revision_result) = tokio::join!(
                    user_fetcher.update_recent_users(
                        Arc::clone(&db_handler_newcontent_clone),
                        dao_discourse_newcontent_clone.id,
                    ),
                    topic_fetcher.update_recent_topics(
                        Arc::clone(&db_handler_newcontent_clone),
                        dao_discourse_newcontent_clone.id,
                    ),
                    revision_fetcher.update_recent_revisions(
                        Arc::clone(&db_handler_newcontent_clone),
                        dao_discourse_newcontent_clone.id,
                    )
                );

                match user_result {
                    Ok(_) => {
                        info!(
                            discourse_url = %dao_discourse_newcontent_clone.discourse_base_url,
                            "Successfully updated new users"
                        );
                    }
                    Err(e) => {
                        error!(
                            error = ?e,
                            discourse_url = %dao_discourse_newcontent_clone.discourse_base_url,
                            discourse_id = %dao_discourse_newcontent_clone.id,
                            "Error updating new users"
                        );
                    }
                }

                match topic_result {
                    Ok(_) => {
                        info!(
                            discourse_url = %dao_discourse_newcontent_clone.discourse_base_url,
                            "Successfully updated new topics"
                        );
                    }
                    Err(e) => {
                        error!(
                            error = ?e,
                            discourse_url = %dao_discourse_newcontent_clone.discourse_base_url,
                            discourse_id = %dao_discourse_newcontent_clone.id,
                            "Error updating new topics"
                        );
                    }
                }

                match revision_result {
                    Ok(_) => {
                        info!(
                            discourse_url = %dao_discourse_newcontent_clone.discourse_base_url,
                            "Successfully updated new revisions"
                        );
                    }
                    Err(e) => {
                        error!(
                            error = ?e,
                            discourse_url = %dao_discourse_newcontent_clone.discourse_base_url,
                            discourse_id = %dao_discourse_newcontent_clone.id,
                            "Error updating new revisions"
                        );
                    }
                }

                // Wait for a short duration before checking again
                tokio::time::sleep(Duration::from_secs(1)).await;
            }
        });

        handles.push(category_handle);
        handles.push(user_handle);
        handles.push(topic_handle);
        handles.push(revision_handle);
        handles.push(newcontent_handle);
    }

    // Spawn uptime ping thread
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
                Err(e) => warn!(error = ?e, "Failed to send uptime ping"),
            }
            tokio::time::sleep(Duration::from_secs(10)).await;
        }
    });

    handles.push(uptime_handle);

    let graceful_shutdown = tokio::spawn(async move {
        signal::ctrl_c()
            .await
            .expect("Failed to listen for shutdown signal");
        info!("Shutting down gracefully...");
        // Perform cleanup here if needed
    });

    // Wait for all tasks to complete
    let _ = futures::future::join_all(handles).await;
    let _ = graceful_shutdown.await;

    Ok(())
}
