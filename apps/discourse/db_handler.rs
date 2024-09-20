use crate::models::posts::Post;
use crate::models::topics::Topic;
use crate::models::{categories::Category, users::User};
use anyhow::Result;
use sea_orm::DbErr;
use sea_orm::{
    prelude::Uuid, ColumnTrait, ConnectOptions, Database, DatabaseConnection, EntityTrait,
    QueryFilter, Set,
};
use seaorm::discourse_user;

pub struct DbHandler {
    pub conn: DatabaseConnection,
}

impl DbHandler {
    pub async fn new(database_url: &str) -> Result<Self> {
        let mut opt = ConnectOptions::new(database_url.to_string());
        opt.sqlx_logging(false);
        let conn = Database::connect(opt).await?;
        Ok(Self { conn })
    }

    pub async fn upsert_user(&self, user: &User, dao_discourse_id: Uuid) -> Result<()> {
        let existing_user = discourse_user::Entity::find()
            .filter(
                sea_orm::Condition::all()
                    .add(discourse_user::Column::ExternalId.eq(user.id))
                    .add(discourse_user::Column::DaoDiscourseId.eq(dao_discourse_id)),
            )
            .one(&self.conn)
            .await
            .map_err(|err: DbErr| {
                anyhow::anyhow!(
                    "Failed to find existing user with external ID {} for DAO discourse ID {}: {}",
                    user.id,
                    dao_discourse_id,
                    err
                )
            })?;

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
                .map_err(|err: DbErr| {
                    anyhow::anyhow!(
                        "Failed to update existing user with external ID {} for DAO discourse ID {}: {}",
                        user.id,
                        dao_discourse_id,
                        err
                    )
                })?;
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
                .map_err(|err: DbErr| {
                    anyhow::anyhow!(
                        "Failed to insert new user with external ID {} for DAO discourse ID {}: {}",
                        user.id,
                        dao_discourse_id,
                        err
                    )
                })?;
        }

        Ok(())
    }

    pub async fn upsert_category(&self, category: &Category, dao_discourse_id: Uuid) -> Result<()> {
        let existing_category = seaorm::discourse_category::Entity::find()
            .filter(
                sea_orm::Condition::all()
                    .add(seaorm::discourse_category::Column::ExternalId.eq(category.id))
                    .add(seaorm::discourse_category::Column::DaoDiscourseId.eq(dao_discourse_id)),
            )
            .one(&self.conn)
            .await
            .map_err(|err: DbErr| {
                anyhow::anyhow!(
                    "Failed to find existing category with external ID {} for DAO discourse ID {}: {}",
                    category.id,
                    dao_discourse_id,
                    err
                )
            })?;

        if let Some(existing_category) = existing_category {
            let mut category_update: seaorm::discourse_category::ActiveModel =
                existing_category.into();
            category_update.name = Set(category.name.clone());
            category_update.color = Set(category.color.clone());
            category_update.text_color = Set(category.text_color.clone());
            category_update.slug = Set(category.slug.clone());
            category_update.topic_count = Set(category.topic_count);
            category_update.post_count = Set(category.post_count);
            category_update.description = Set(category.description.clone());
            category_update.description_text = Set(category.description_text.clone());
            category_update.topics_day = Set(category.topics_day);
            category_update.topics_week = Set(category.topics_week);
            category_update.topics_month = Set(category.topics_month);
            category_update.topics_year = Set(category.topics_year);
            category_update.topics_all_time = Set(category.topics_all_time);
            seaorm::discourse_category::Entity::update(category_update)
                .exec(&self.conn)
                .await
                .map_err(|err: DbErr| {
                    anyhow::anyhow!(
                        "Failed to update existing category with external ID {} for DAO discourse ID {}: {}",
                        category.id,
                        dao_discourse_id,
                        err
                    )
                })?;
        } else {
            let category_model = seaorm::discourse_category::ActiveModel {
                external_id: Set(category.id),
                name: Set(category.name.clone()),
                color: Set(category.color.clone()),
                text_color: Set(category.text_color.clone()),
                slug: Set(category.slug.clone()),
                topic_count: Set(category.topic_count),
                post_count: Set(category.post_count),
                description: Set(category.description.clone()),
                description_text: Set(category.description_text.clone()),
                topics_day: Set(category.topics_day),
                topics_week: Set(category.topics_week),
                topics_month: Set(category.topics_month),
                topics_year: Set(category.topics_year),
                topics_all_time: Set(category.topics_all_time),
                dao_discourse_id: Set(dao_discourse_id),
                ..Default::default()
            };
            seaorm::discourse_category::Entity::insert(category_model)
                .exec(&self.conn)
                .await
                .map_err(|err: DbErr| {
                    anyhow::anyhow!(
                        "Failed to insert new category with external ID {} for DAO discourse ID {}: {}",
                        category.id,
                        dao_discourse_id,
                        err
                    )
                })?;
        }

        Ok(())
    }

    pub async fn upsert_topic(&self, topic: &Topic, dao_discourse_id: Uuid) -> Result<()> {
        let existing_topic = seaorm::discourse_topic::Entity::find()
            .filter(
                sea_orm::Condition::all()
                    .add(seaorm::discourse_topic::Column::ExternalId.eq(topic.id))
                    .add(seaorm::discourse_topic::Column::DaoDiscourseId.eq(dao_discourse_id)),
            )
            .one(&self.conn)
            .await
            .map_err(|err: DbErr| {
                anyhow::anyhow!(
                    "Failed to find existing topic with external ID {} for DAO discourse ID {}: {}",
                    topic.id,
                    dao_discourse_id,
                    err
                )
            })?;

        if let Some(existing_topic) = existing_topic {
            let mut topic_update: seaorm::discourse_topic::ActiveModel = existing_topic.into();
            topic_update.title = Set(topic.title.clone());
            topic_update.fancy_title = Set(topic.fancy_title.clone());
            topic_update.slug = Set(topic.slug.clone());
            topic_update.posts_count = Set(topic.posts_count);
            topic_update.reply_count = Set(topic.reply_count);
            topic_update.created_at = Set(topic.created_at.naive_utc());
            topic_update.last_posted_at = Set(topic.last_posted_at.naive_utc());
            topic_update.bumped_at = Set(topic.bumped_at.naive_utc());
            topic_update.pinned = Set(topic.pinned);
            topic_update.visible = Set(topic.visible);
            topic_update.closed = Set(topic.closed);
            topic_update.archived = Set(topic.archived);
            topic_update.views = Set(topic.views);
            topic_update.like_count = Set(topic.like_count);
            topic_update.category_id = Set(topic.category_id);
            topic_update.pinned_globally = Set(topic.pinned_globally);
            seaorm::discourse_topic::Entity::update(topic_update)
                .exec(&self.conn)
                .await
                .map_err(|err: DbErr| {
                    anyhow::anyhow!(
                        "Failed to update existing topic with external ID {} for DAO discourse ID {}: {}",
                        topic.id,
                        dao_discourse_id,
                        err
                    )
                })?;
        } else {
            let topic_model = seaorm::discourse_topic::ActiveModel {
                external_id: Set(topic.id),
                title: Set(topic.title.clone()),
                fancy_title: Set(topic.fancy_title.clone()),
                slug: Set(topic.slug.clone()),
                posts_count: Set(topic.posts_count),
                reply_count: Set(topic.reply_count),
                created_at: Set(topic.created_at.naive_utc()),
                last_posted_at: Set(topic.last_posted_at.naive_utc()),
                bumped_at: Set(topic.bumped_at.naive_utc()),
                pinned: Set(topic.pinned),
                visible: Set(topic.visible),
                closed: Set(topic.closed),
                archived: Set(topic.archived),
                views: Set(topic.views),
                like_count: Set(topic.like_count),
                category_id: Set(topic.category_id),
                pinned_globally: Set(topic.pinned_globally),
                dao_discourse_id: Set(dao_discourse_id),
                ..Default::default()
            };
            seaorm::discourse_topic::Entity::insert(topic_model)
                .exec(&self.conn)
                .await
                .map_err(|err: DbErr| {
                    anyhow::anyhow!(
                        "Failed to insert new topic with external ID {} for DAO discourse ID {}: {}",
                        topic.id,
                        dao_discourse_id,
                        err
                    )
                })?;
        }

        Ok(())
    }

    pub async fn upsert_post(&self, post: &Post, dao_discourse_id: Uuid) -> Result<()> {
        let existing_post = seaorm::discourse_post::Entity::find()
            .filter(
                sea_orm::Condition::all()
                    .add(seaorm::discourse_post::Column::ExternalId.eq(post.id))
                    .add(seaorm::discourse_post::Column::DaoDiscourseId.eq(dao_discourse_id)),
            )
            .one(&self.conn)
            .await
            .map_err(|err: DbErr| {
                anyhow::anyhow!(
                    "Failed to find existing post with external ID {} for DAO discourse ID {}: {}",
                    post.id,
                    dao_discourse_id,
                    err
                )
            })?;

        if let Some(existing_post) = existing_post {
            let mut post_update: seaorm::discourse_post::ActiveModel = existing_post.into();
            post_update.name = Set(post.name.clone());
            post_update.username = Set(post.username.clone());
            post_update.created_at = Set(post.created_at.naive_utc());
            post_update.cooked = Set(post.cooked.clone());
            post_update.post_number = Set(post.post_number);
            post_update.post_type = Set(post.post_type);
            post_update.updated_at = Set(post.updated_at.naive_utc());
            post_update.reply_count = Set(post.reply_count);
            post_update.reply_to_post_number = Set(post.reply_to_post_number);
            post_update.quote_count = Set(post.quote_count);
            post_update.incoming_link_count = Set(post.incoming_link_count);
            post_update.reads = Set(post.reads);
            post_update.readers_count = Set(post.readers_count);
            post_update.score = Set(post.score);
            post_update.topic_id = Set(post.topic_id);
            post_update.topic_slug = Set(post.topic_slug.clone());
            post_update.display_username = Set(post.display_username.clone());
            post_update.primary_group_name = Set(post.primary_group_name.clone());
            post_update.flair_name = Set(post.flair_name.clone());
            post_update.flair_url = Set(post.flair_url.clone());
            post_update.flair_bg_color = Set(post.flair_bg_color.clone());
            post_update.flair_color = Set(post.flair_color.clone());
            post_update.version = Set(post.version);
            post_update.user_id = Set(post.user_id);
            seaorm::discourse_post::Entity::update(post_update)
                .exec(&self.conn)
                .await
                .map_err(|err: DbErr| {
                               anyhow::anyhow!(
                                   "Failed to update existing post with external ID {} for DAO discourse ID {}. Error: {}. Post details: {:?}",
                                   post.id,
                                   dao_discourse_id,
                                   err,
                                   post
                               )
                           })?;
        } else {
            let post_model = seaorm::discourse_post::ActiveModel {
                external_id: Set(post.id),
                name: Set(post.name.clone()),
                username: Set(post.username.clone()),
                created_at: Set(post.created_at.naive_utc()),
                cooked: Set(post.cooked.clone()),
                post_number: Set(post.post_number),
                post_type: Set(post.post_type),
                updated_at: Set(post.updated_at.naive_utc()),
                reply_count: Set(post.reply_count),
                reply_to_post_number: Set(post.reply_to_post_number),
                quote_count: Set(post.quote_count),
                incoming_link_count: Set(post.incoming_link_count),
                reads: Set(post.reads),
                readers_count: Set(post.readers_count),
                score: Set(post.score),
                topic_id: Set(post.topic_id),
                topic_slug: Set(post.topic_slug.clone()),
                display_username: Set(post.display_username.clone()),
                primary_group_name: Set(post.primary_group_name.clone()),
                flair_name: Set(post.flair_name.clone()),
                flair_url: Set(post.flair_url.clone()),
                flair_bg_color: Set(post.flair_bg_color.clone()),
                flair_color: Set(post.flair_color.clone()),
                version: Set(post.version),
                user_id: Set(post.user_id),
                dao_discourse_id: Set(dao_discourse_id),
                ..Default::default()
            };
            seaorm::discourse_post::Entity::insert(post_model)
                .exec(&self.conn)
                .await
                .map_err(|err: DbErr| {
                               anyhow::anyhow!(
                                   "Failed to insert new post with external ID {} for DAO discourse ID {}. Error: {}. Post details: {:?}. User ID: {}",
                                   post.id,
                                   dao_discourse_id,
                                   err,
                                   post,
                                   post.user_id
                               )
                           })?;
        }

        Ok(())
    }
}
