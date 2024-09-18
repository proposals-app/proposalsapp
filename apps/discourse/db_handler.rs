use anyhow::{Context, Result};
use sea_orm::{
    prelude::Uuid, ColumnTrait, ConnectOptions, Database, DatabaseConnection, EntityTrait,
    QueryFilter, Set,
};
use seaorm::discourse_user;

use crate::models::{categories::Category, users::User};

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

    pub async fn upsert_category(&self, category: &Category, dao_discourse_id: Uuid) -> Result<()> {
        let existing_category = seaorm::discourse_category::Entity::find()
            .filter(
                sea_orm::Condition::all()
                    .add(seaorm::discourse_category::Column::ExternalId.eq(category.id))
                    .add(seaorm::discourse_category::Column::DaoDiscourseId.eq(dao_discourse_id)),
            )
            .one(&self.conn)
            .await
            .context("discourse_category::Entity::find")?;

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
                .context("discourse_category::Entity::update")?;
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
                .context("discourse_category::Entity::insert")?;
        }

        Ok(())
    }
}
