use crate::{
    models::{categories::Category, posts::Post, revisions::Revision, topics::Topic, users::User},
    DAO_DISCOURSE_ID_TO_CATEGORY_IDS_PROPOSALS,
};
use anyhow::Result;
use opentelemetry::{
    metrics::{Counter, UpDownCounter},
    KeyValue,
};
use sea_orm::{
    prelude::Uuid, ActiveValue::NotSet, ColumnTrait, ConnectOptions, Database, DatabaseConnection,
    DbErr, EntityTrait, QueryFilter, Set,
};
use seaorm::{discourse_post_revision, discourse_user};
use tracing::{debug, info, instrument};
use utils::{
    tracing::get_meter,
    types::{DiscussionJobData, JobData},
};

pub struct DbHandler {
    pub conn: DatabaseConnection,
    upsert_user_counter: Counter<u64>,
    upsert_category_counter: Counter<u64>,
    upsert_topic_counter: Counter<u64>,
    upsert_post_counter: Counter<u64>,
    upsert_revision_counter: Counter<u64>,
    total_users_counter: UpDownCounter<i64>,
    total_categories_counter: UpDownCounter<i64>,
    total_topics_counter: UpDownCounter<i64>,
    total_posts_counter: UpDownCounter<i64>,
    total_revisions_counter: UpDownCounter<i64>,
}

impl DbHandler {
    #[instrument(skip(database_url))]
    pub async fn new(database_url: &str) -> Result<Self> {
        let mut opt = ConnectOptions::new(database_url.to_string());
        opt.sqlx_logging(false);
        let conn = Database::connect(opt).await?;
        info!("Database connection established");

        let meter = get_meter();

        Ok(Self {
            conn,
            upsert_user_counter: meter.u64_counter("discourse_db_upsert_user_total").build(),
            upsert_category_counter: meter
                .u64_counter("discourse_db_upsert_category_total")
                .build(),
            upsert_topic_counter: meter.u64_counter("discourse_db_upsert_topic_total").build(),
            upsert_post_counter: meter.u64_counter("discourse_db_upsert_post_total").build(),
            upsert_revision_counter: meter
                .u64_counter("discourse_db_upsert_revision_total")
                .build(),
            total_users_counter: meter
                .i64_up_down_counter("discourse_db_total_users")
                .build(),
            total_categories_counter: meter
                .i64_up_down_counter("discourse_db_total_categories")
                .build(),
            total_topics_counter: meter
                .i64_up_down_counter("discourse_db_total_topics")
                .build(),
            total_posts_counter: meter
                .i64_up_down_counter("discourse_db_total_posts")
                .build(),
            total_revisions_counter: meter
                .i64_up_down_counter("discourse_db_total_revisions")
                .build(),
        })
    }

    pub async fn get_or_create_unknown_user(&self, dao_discourse_id: Uuid) -> Result<User> {
        let unknown_user = User {
            id: -1,
            username: "unknown_user".to_string(),
            name: Some("Unknown User".to_string()),
            avatar_template: "".to_string(),
            title: None,
            likes_received: Some(0),
            likes_given: Some(0),
            topics_entered: Some(0),
            topic_count: Some(0),
            post_count: Some(0),
            posts_read: Some(0),
            days_visited: Some(0),
        };

        match self.upsert_user(&unknown_user, dao_discourse_id).await {
            Ok(_) => Ok(unknown_user),
            Err(e) => Err(anyhow::anyhow!("Failed to create unknown user: {}", e)),
        }
    }

    #[instrument(skip(self, user, dao_discourse_id), fields(user_id = user.id, user_username = %user.username))]
    pub async fn upsert_user(&self, user: &User, dao_discourse_id: Uuid) -> Result<()> {
        info!(
            user_id = user.id,
            user_username = %user.username,
            dao_discourse_id = %dao_discourse_id,
            "Upserting user"
        );
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
                    "Failed to find existing user {:?} for DAO discourse ID {}: {}",
                    user,
                    dao_discourse_id,
                    err
                )
            })?;

        match existing_user {
            Some(existing_user) => {
                debug!("Updating existing user");
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
                            "Failed to update existing user {:?} for DAO discourse ID {}: {}",
                            user,
                            dao_discourse_id,
                            err
                        )
                    })?;
            }
            None => {
                debug!("Inserting new user");
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
                            "Failed to insert new user {:?} for DAO discourse ID {}: {}",
                            user,
                            dao_discourse_id,
                            err
                        )
                    })?;
                self.total_users_counter.add(
                    1,
                    &[KeyValue::new(
                        "dao_discourse_id",
                        dao_discourse_id.to_string(),
                    )],
                );
            }
        }
        info!("User upserted successfully");
        self.upsert_user_counter.add(
            1,
            &[KeyValue::new(
                "dao_discourse_id",
                dao_discourse_id.to_string(),
            )],
        );
        Ok(())
    }

    #[instrument(skip(self, category, dao_discourse_id), fields(category_id = category.id, cateogory_name = %category.name))]
    pub async fn upsert_category(&self, category: &Category, dao_discourse_id: Uuid) -> Result<()> {
        info!(
            category_id = category.id,
            category_name = %category.name,
            dao_discourse_id = %dao_discourse_id,
            "Upserting category"
        );
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
                    "Failed to find existing category {:?} for DAO discourse ID {}: {}",
                    category,
                    dao_discourse_id,
                    err
                )
            })?;

        match existing_category {
            Some(existing_category) => {
                debug!("Updating existing category");
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
                            "Failed to update existing category {:?} for DAO discourse ID {}: {}",
                            category,
                            dao_discourse_id,
                            err
                        )
                    })?;
            }
            None => {
                debug!("Inserting new category");
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
                            "Failed to insert new category {:?} for DAO discourse ID {}: {}",
                            category,
                            dao_discourse_id,
                            err
                        )
                    })?;
                self.total_categories_counter.add(
                    1,
                    &[KeyValue::new(
                        "dao_discourse_id",
                        dao_discourse_id.to_string(),
                    )],
                );
            }
        }
        info!("Category upserted successfully");
        self.upsert_category_counter.add(
            1,
            &[KeyValue::new(
                "dao_discourse_id",
                dao_discourse_id.to_string(),
            )],
        );
        Ok(())
    }

    #[instrument(skip(self, topic, dao_discourse_id), fields(topic_id = topic.id, topic_title = %topic.title))]
    pub async fn upsert_topic(&self, topic: &Topic, dao_discourse_id: Uuid) -> Result<()> {
        info!(
            topic_id = topic.id,
            topic_title = %topic.title,
            dao_discourse_id = %dao_discourse_id,
            "Upserting topic"
        );
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
                    "Failed to find existing topic {:?} for DAO discourse ID {}: {}",
                    topic,
                    dao_discourse_id,
                    err
                )
            })?;

        match existing_topic {
            Some(existing_topic) => {
                debug!("Updating existing topic");
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
                            "Failed to update existing topic {:?} for DAO discourse ID {}: {}",
                            topic,
                            dao_discourse_id,
                            err
                        )
                    })?;
            }
            None => {
                debug!("Inserting new topic");
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
                let result = seaorm::discourse_topic::Entity::insert(topic_model)
                    .exec(&self.conn)
                    .await
                    .map_err(|err: DbErr| {
                        anyhow::anyhow!(
                            "Failed to insert new topic {:?} for DAO discourse ID {}: {}",
                            topic,
                            dao_discourse_id,
                            err
                        )
                    })?;

                if let Some(category_ids) =
                    DAO_DISCOURSE_ID_TO_CATEGORY_IDS_PROPOSALS.get(&dao_discourse_id)
                {
                    if category_ids.contains(&topic.category_id) {
                        let job_data = DiscussionJobData {
                            discourse_topic_id: result.last_insert_id,
                        };

                        seaorm::job_queue::Entity::insert(seaorm::job_queue::ActiveModel {
                            id: NotSet,
                            r#type: Set(DiscussionJobData::job_type().to_string()),
                               data: Set(serde_json::to_value(job_data)?),
                            status: Set("PENDING".into()),
                            created_at: NotSet,
                        })
                        .exec(&self.conn)
                        .await
                        .map_err(|err: DbErr| {
                            anyhow::anyhow!(
                                "Failed to create MAPPER_NEW_PROPOSAL_DISCUSSION job for topic ID {}: {}",
                                result.last_insert_id,
                                err
                            )
                        })?;
                    }
                }

                self.total_topics_counter.add(
                    1,
                    &[KeyValue::new(
                        "dao_discourse_id",
                        dao_discourse_id.to_string(),
                    )],
                );
            }
        }
        info!("Topic upserted successfully");
        self.upsert_topic_counter.add(
            1,
            &[KeyValue::new(
                "dao_discourse_id",
                dao_discourse_id.to_string(),
            )],
        );

        Ok(())
    }

    #[instrument(skip(self, post, dao_discourse_id), fields(post_id = post.id, post_username = %post.username))]
    pub async fn upsert_post(&self, post: &Post, dao_discourse_id: Uuid) -> Result<()> {
        info!(
            post_id = post.id,
            post_username = %post.username,
            dao_discourse_id = %dao_discourse_id,
            "Upserting post"
        );
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
                    "Failed to find existing post {:?} for DAO discourse ID {}: {}",
                    post,
                    dao_discourse_id,
                    err
                )
            })?;

        match existing_post {
            Some(existing_post) => {
                debug!("Updating existing post");
                let mut post_update: seaorm::discourse_post::ActiveModel = existing_post.into();
                post_update.name = Set(post.name.clone());
                post_update.username = Set(post.username.clone());
                post_update.created_at = Set(post.created_at.naive_utc());
                post_update.cooked = Set(post.raw.clone());
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
                post_update.can_view_edit_history = Set(post.can_view_edit_history);
                seaorm::discourse_post::Entity::update(post_update)
                    .exec(&self.conn)
                    .await
                    .map_err(|err: DbErr| {
                        anyhow::anyhow!(
                            "Failed to update existing post {:?} for DAO discourse ID {}: {}.",
                            post,
                            dao_discourse_id,
                            err,
                        )
                    })?;
            }
            None => {
                debug!("Inserting new post");
                let post_model = seaorm::discourse_post::ActiveModel {
                    external_id: Set(post.id),
                    name: Set(post.name.clone()),
                    username: Set(post.username.clone()),
                    created_at: Set(post.created_at.naive_utc()),
                    cooked: Set(post.raw.clone()),
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
                    can_view_edit_history: Set(post.can_view_edit_history),
                    ..Default::default()
                };
                seaorm::discourse_post::Entity::insert(post_model)
                    .exec(&self.conn)
                    .await
                    .map_err(|err: DbErr| {
                        anyhow::anyhow!(
                            "Failed to insert new post {:?} for DAO discourse ID {}: {}",
                            post,
                            dao_discourse_id,
                            err,
                        )
                    })?;
                self.total_posts_counter.add(
                    1,
                    &[KeyValue::new(
                        "dao_discourse_id",
                        dao_discourse_id.to_string(),
                    )],
                );
            }
        }
        info!("Post upserted successfully");
        self.upsert_post_counter.add(
            1,
            &[KeyValue::new(
                "dao_discourse_id",
                dao_discourse_id.to_string(),
            )],
        );

        Ok(())
    }

    #[instrument(skip(self, revision, dao_discourse_id), fields(revision_version = revision.current_version, post_id = revision.post_id))]
    pub async fn upsert_revision(
        &self,
        revision: &Revision,
        dao_discourse_id: Uuid,
        discourse_post_id: Uuid,
    ) -> Result<()> {
        info!(
            revision = revision.current_version,
            post_id = %revision.post_id,
            dao_discourse_id = %dao_discourse_id,
            "Upserting revision"
        );

        let cooked_body_before = Some("".into());
        let cooked_body_after = Some("".into());

        let cooked_title_before = revision
            .title_changes
            .as_ref()
            .map(|tc| tc.get_cooked_before());
        let cooked_title_after = revision
            .title_changes
            .as_ref()
            .map(|tc| tc.get_cooked_after());

        let existing_revision = discourse_post_revision::Entity::find()
            .filter(discourse_post_revision::Column::ExternalPostId.eq(revision.post_id))
            .filter(discourse_post_revision::Column::Version.eq(revision.current_version))
            .filter(discourse_post_revision::Column::DaoDiscourseId.eq(dao_discourse_id))
            .one(&self.conn)
            .await?;

        match existing_revision {
            Some(existing_revision) => {
                debug!("Updating existing revision");
                let mut revision_update: discourse_post_revision::ActiveModel =
                    existing_revision.into();
                revision_update.created_at = Set(revision.created_at.naive_utc());
                revision_update.username = Set(revision.username.clone());
                revision_update.body_changes =
                    Set(revision.body_changes.side_by_side_markdown.clone());
                if revision.title_changes.is_some() {
                    revision_update.title_changes = Set(Some(
                        revision.title_changes.as_ref().unwrap().inline.clone(),
                    ));
                }
                revision_update.edit_reason = Set(revision.edit_reason.clone());
                revision_update.cooked_body_before = Set(cooked_body_before);
                revision_update.cooked_title_before = Set(cooked_title_before);
                revision_update.cooked_body_after = Set(cooked_body_after);
                revision_update.cooked_title_after = Set(cooked_title_after);
                discourse_post_revision::Entity::update(revision_update)
                    .exec(&self.conn)
                    .await?;
            }
            None => {
                debug!("Inserting new revision");
                let revision_model = discourse_post_revision::ActiveModel {
                    external_post_id: Set(revision.post_id),
                    version: Set(revision.current_version),
                    created_at: Set(revision.created_at.naive_utc()),
                    username: Set(revision.username.clone()),
                    body_changes: Set(revision.body_changes.side_by_side_markdown.clone()),
                    title_changes: match revision.title_changes.as_ref() {
                        Some(title) => Set(Some(title.inline.clone())),
                        None => NotSet,
                    },
                    edit_reason: Set(revision.edit_reason.clone()),
                    cooked_body_before: Set(cooked_body_before),
                    cooked_title_before: Set(cooked_title_before),
                    cooked_body_after: Set(cooked_body_after),
                    cooked_title_after: Set(cooked_title_after),
                    dao_discourse_id: Set(dao_discourse_id),
                    discourse_post_id: Set(discourse_post_id),
                    ..Default::default()
                };
                discourse_post_revision::Entity::insert(revision_model)
                    .exec(&self.conn)
                    .await?;
                self.total_revisions_counter.add(
                    1,
                    &[KeyValue::new(
                        "dao_discourse_id",
                        dao_discourse_id.to_string(),
                    )],
                );
            }
        }
        info!("Revision upserted successfully");
        self.upsert_revision_counter.add(
            1,
            &[KeyValue::new(
                "dao_discourse_id",
                dao_discourse_id.to_string(),
            )],
        );

        Ok(())
    }
}
