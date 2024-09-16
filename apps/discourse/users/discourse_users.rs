use anyhow::{anyhow, Context, Result};
use dotenv::dotenv;
use reqwest::Client;
use sea_orm::{
    prelude::Uuid, ColumnTrait, Condition, Database, DatabaseConnection, EntityTrait, QueryFilter,
    Set,
};
use seaorm::{dao_discourse, discourse_user};
use std::sync::Arc;
use std::time::Duration;
use tokio::time::sleep;
use tracing::instrument;
use tracing::{error, info, warn};
use utils::tracing::setup_tracing;
mod models;
use models::{Response, User};

struct DbHandler {
    conn: DatabaseConnection,
}

impl DbHandler {
    async fn new(database_url: &str) -> Result<Self> {
        let conn = Database::connect(database_url).await?;
        Ok(Self { conn })
    }

    #[instrument(skip(self, user), fields(user_id = user.id, dao_discourse_id = %dao_discourse_id))]
    async fn upsert_user(&self, user: &User, dao_discourse_id: Uuid) -> Result<()> {
        let existing_user = discourse_user::Entity::find()
            .filter(
                Condition::all()
                    .add(discourse_user::Column::ExternalId.eq(user.id))
                    .add(discourse_user::Column::DaoDiscourseId.eq(dao_discourse_id)),
            )
            .one(&self.conn)
            .await
            .context("discourse_user::Entity::find")?;

        if let Some(existing_user) = existing_user {
            let mut user_update: discourse_user::ActiveModel = existing_user.into();
            user_update.username = Set(user.username.clone());
            user_update.name = Set(user.name.clone());
            user_update.avatar_template = Set(user.avatar_template.clone());
            user_update.title = Set(user.title.clone());
            user_update.likes_received = Set(Some(user.likes_received.unwrap_or(0) as i64));
            user_update.likes_given = Set(Some(user.likes_given.unwrap_or(0) as i64));
            user_update.topics_entered = Set(Some(user.topics_entered.unwrap_or(0) as i64));
            user_update.topic_count = Set(Some(user.topic_count.unwrap_or(0) as i64));
            user_update.post_count = Set(Some(user.post_count.unwrap_or(0) as i64));
            user_update.posts_read = Set(Some(user.posts_read.unwrap_or(0) as i64));
            user_update.days_visited = Set(Some(user.days_visited.unwrap_or(0) as i64));
            discourse_user::Entity::update(user_update)
                .exec(&self.conn)
                .await
                .context("discourse_user::Entity::update")?;
        } else {
            let user_model = discourse_user::ActiveModel {
                external_id: Set(user.id),
                username: Set(user.username.clone()),
                name: Set(user.name.clone()),
                avatar_template: Set(user.avatar_template.clone()),
                title: Set(user.title.clone()),
                likes_received: Set(Some(user.likes_received.unwrap_or(0) as i64)),
                likes_given: Set(Some(user.likes_given.unwrap_or(0) as i64)),
                topics_entered: Set(Some(user.topics_entered.unwrap_or(0) as i64)),
                topic_count: Set(Some(user.topic_count.unwrap_or(0) as i64)),
                post_count: Set(Some(user.post_count.unwrap_or(0) as i64)),
                posts_read: Set(Some(user.posts_read.unwrap_or(0) as i64)),
                days_visited: Set(Some(user.days_visited.unwrap_or(0) as i64)),
                dao_discourse_id: Set(dao_discourse_id),
                ..Default::default()
            };
            discourse_user::Entity::insert(user_model)
                .exec(&self.conn)
                .await
                .context("discourse_user::Entity::insert")?;
        }

        Ok(())
    }
}

struct UserFetcher {
    client: Client,
    base_url: String,
    max_retries: usize,
}

impl UserFetcher {
    fn new(base_url: &str, max_retries: usize) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.to_string(),
            max_retries,
        }
    }

    #[instrument(skip(self, db_handler), fields(dao_discourse_id = %dao_discourse_id))]
    async fn update_all_users(&self, db_handler: &DbHandler, dao_discourse_id: Uuid) -> Result<()> {
        let mut page = 0;
        let mut total_users = 0;

        loop {
            let response = self.fetch_page(page).await?;

            let page_users: Vec<User> = response
                .directory_items
                .iter()
                .map(|item| {
                    let mut user = item.user.clone();
                    user.likes_received = Some(item.likes_received);
                    user.likes_given = Some(item.likes_given);
                    user.topics_entered = Some(item.topics_entered);
                    user.topic_count = Some(item.topic_count);
                    user.post_count = Some(item.post_count);
                    user.posts_read = Some(item.posts_read);
                    user.days_visited = Some(item.days_visited);
                    user
                })
                .collect();
            let num_users = page_users.len();
            total_users += num_users;

            for user in page_users {
                db_handler.upsert_user(&user, dao_discourse_id).await?;
            }

            info!(
                "Fetched and upserted page {}: {} users (total users so far: {})",
                page + 1,
                num_users,
                total_users
            );

            if response.directory_items.is_empty() {
                info!("No more users to fetch. Stopping.");
                break;
            }

            page += 1;
            sleep(Duration::from_millis(500)).await;
        }

        Ok(())
    }

    #[instrument(skip(self), fields(page = page))]
    async fn fetch_page(&self, page: usize) -> Result<Response> {
        let url = format!(
            "{}/directory_items.json?page={}&order=asc&period=all",
            self.base_url, page
        );
        self.fetch_page_with_retries(&self.client, &url, self.max_retries)
            .await
    }

    #[instrument(skip(self, client), fields(url = %url, max_retries = max_retries))]
    async fn fetch_page_with_retries(
        &self,
        client: &Client,
        url: &str,
        max_retries: usize,
    ) -> Result<Response> {
        let mut attempt = 0;
        let mut delay = Duration::from_secs(1);

        loop {
            match client.get(url).send().await {
                Ok(response) => {
                    if response.status().is_success() {
                        let resp_json = response.json::<Response>().await?;
                        return Ok(resp_json);
                    } else if response.status().is_server_error()
                        || response.status().as_u16() == 429
                    {
                        attempt += 1;
                        if attempt > max_retries {
                            return Err(anyhow!(
                                "Max retries reached. Last error: HTTP {}",
                                response.status()
                            ));
                        }

                        if response.status().as_u16() == 429 {
                            let retry_after = response
                                .headers()
                                .get("Retry-After")
                                .and_then(|h| h.to_str().ok())
                                .and_then(|s| s.parse::<u64>().ok())
                                .map(Duration::from_secs)
                                .unwrap_or(Duration::from_secs(60));

                            warn!(
                                "Rate limited. Waiting for {:?} before retrying...",
                                retry_after
                            );
                            sleep(retry_after).await;
                        } else {
                            warn!(
                                "Server error {}. Retrying in {:?}...",
                                response.status(),
                                delay
                            );
                            sleep(delay).await;
                            delay *= 2;
                        }
                    } else {
                        let status = response.status();
                        let body = response.text().await.unwrap_or_default();
                        return Err(anyhow!("Request failed with status {}: {}", status, body));
                    }
                }
                Err(e) => {
                    attempt += 1;
                    if attempt > max_retries {
                        return Err(anyhow!("Max retries reached. Last error: {}", e));
                    }
                    warn!("Request error: {}. Retrying in {:?}...", e, delay);
                    sleep(delay).await;
                    delay *= 2; // Exponential backoff
                }
            }
        }
    }
}

#[tokio::main]
#[instrument]
async fn main() -> Result<()> {
    dotenv().ok();
    setup_tracing();

    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL must be set")?;
    let db_handler = Arc::new(DbHandler::new(&database_url).await?);

    let dao_discourses = dao_discourse::Entity::find().all(&db_handler.conn).await?;

    let mut handles = vec![];

    for dao_discourse in dao_discourses {
        let fetcher = UserFetcher::new(&dao_discourse.discourse_base_url, 3);
        let db_handler_clone = Arc::clone(&db_handler);
        let handle = tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(60 * 60));
            loop {
                interval.tick().await;
                match fetcher
                    .update_all_users(&db_handler_clone, dao_discourse.id)
                    .await
                {
                    Ok(_) => {
                        info!(
                            "Successfully updated users for {}",
                            dao_discourse.discourse_base_url
                        );
                    }
                    Err(e) => {
                        error!(
                            "Error updating users for {} (ID: {}): {}",
                            dao_discourse.discourse_base_url, dao_discourse.id, e
                        );
                    }
                }
            }
        });
        handles.push(handle);
    }

    futures::future::join_all(handles).await;

    Ok(())
}
