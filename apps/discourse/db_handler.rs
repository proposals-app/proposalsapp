use crate::{
    models::{categories::Category, posts::Post, revisions::Revision, topics::Topic, users::User},
    DAO_DISCOURSE_ID_TO_CATEGORY_IDS_PROPOSALS,
};
use anyhow::{Context, Result};
use chrono::Utc;
use once_cell::sync::OnceCell;
use proposalsapp_db::models::{discourse_category, discourse_post, discourse_post_like, discourse_post_revision, discourse_topic, discourse_user, job_queue};
use sea_orm::{prelude::Uuid, sea_query::OnConflict, ActiveValue::NotSet, ColumnTrait, Condition, ConnectOptions, Database, DatabaseConnection, EntityTrait, PaginatorTrait, QueryFilter, Set};
use std::time::Duration;
use tracing::{info, instrument};
use utils::types::{DiscussionJobData, JobData};

pub static DB: OnceCell<DatabaseConnection> = OnceCell::new();

pub async fn initialize_db() -> Result<()> {
    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL environment variable not set")?;

    let mut opt = ConnectOptions::new(database_url);
    opt.max_connections(10)
        .min_connections(5)
        .connect_timeout(Duration::from_secs(8))
        .acquire_timeout(Duration::from_secs(8))
        .idle_timeout(Duration::from_secs(8))
        .max_lifetime(Duration::from_secs(8))
        .sqlx_logging(false);

    let db = Database::connect(opt)
        .await
        .context("Failed to connect to the database")?;

    DB.set(db)
        .map_err(|_| anyhow::anyhow!("Failed to set database connection"))
}

#[instrument(fields(dao_discourse_id = %dao_discourse_id))]
pub async fn get_or_create_unknown_user(dao_discourse_id: Uuid) -> Result<User> {
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

    upsert_user(&unknown_user, dao_discourse_id).await?;
    info!("Created or retrieved unknown user");
    Ok(unknown_user)
}

#[instrument(skip( user), fields(user_id = user.id, user_username = %user.username, dao_discourse_id = %dao_discourse_id))]
pub async fn upsert_user(user: &User, dao_discourse_id: Uuid) -> Result<()> {
    // Create an active model for the user
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

    // Perform the upsert operation
    discourse_user::Entity::insert(user_model)
        .on_conflict(
            OnConflict::columns([
                discourse_user::Column::ExternalId,
                discourse_user::Column::DaoDiscourseId,
            ])
            .update_columns([
                discourse_user::Column::Username,
                discourse_user::Column::Name,
                discourse_user::Column::AvatarTemplate,
                discourse_user::Column::Title,
                discourse_user::Column::LikesReceived,
                discourse_user::Column::LikesGiven,
                discourse_user::Column::TopicsEntered,
                discourse_user::Column::TopicCount,
                discourse_user::Column::PostCount,
                discourse_user::Column::PostsRead,
                discourse_user::Column::DaysVisited,
            ])
            .to_owned(),
        )
        .exec(DB.get().unwrap())
        .await?;

    info!("User upserted successfully");

    Ok(())
}

#[instrument(skip( category), fields(category_id = category.id, category_name = %category.name, dao_discourse_id = %dao_discourse_id))]
pub async fn upsert_category(category: &Category, dao_discourse_id: Uuid) -> Result<()> {
    // Create an active model for the category
    let category_model = discourse_category::ActiveModel {
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

    // Perform the upsert operation
    discourse_category::Entity::insert(category_model)
        .on_conflict(
            OnConflict::columns([
                discourse_category::Column::ExternalId,
                discourse_category::Column::DaoDiscourseId,
            ])
            .update_columns([
                discourse_category::Column::Name,
                discourse_category::Column::Color,
                discourse_category::Column::TextColor,
                discourse_category::Column::Slug,
                discourse_category::Column::TopicCount,
                discourse_category::Column::PostCount,
                discourse_category::Column::Description,
                discourse_category::Column::DescriptionText,
                discourse_category::Column::TopicsDay,
                discourse_category::Column::TopicsWeek,
                discourse_category::Column::TopicsMonth,
                discourse_category::Column::TopicsYear,
                discourse_category::Column::TopicsAllTime,
            ])
            .to_owned(),
        )
        .exec(DB.get().unwrap())
        .await?;

    info!("Category upserted successfully");
    Ok(())
}

#[instrument(skip( topic), fields(topic_id = topic.id, topic_title = %topic.title, dao_discourse_id = %dao_discourse_id))]
pub async fn upsert_topic(topic: &Topic, dao_discourse_id: Uuid) -> Result<()> {
    // Create an active model for the topic
    let topic_model = discourse_topic::ActiveModel {
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

    // Perform the upsert operation
    let stored_topic = discourse_topic::Entity::insert(topic_model)
        .on_conflict(
            OnConflict::columns([
                discourse_topic::Column::ExternalId,
                discourse_topic::Column::DaoDiscourseId,
            ])
            .update_columns([
                discourse_topic::Column::Title,
                discourse_topic::Column::FancyTitle,
                discourse_topic::Column::Slug,
                discourse_topic::Column::PostsCount,
                discourse_topic::Column::ReplyCount,
                discourse_topic::Column::CreatedAt,
                discourse_topic::Column::LastPostedAt,
                discourse_topic::Column::BumpedAt,
                discourse_topic::Column::Pinned,
                discourse_topic::Column::Visible,
                discourse_topic::Column::Closed,
                discourse_topic::Column::Archived,
                discourse_topic::Column::Views,
                discourse_topic::Column::LikeCount,
                discourse_topic::Column::CategoryId,
                discourse_topic::Column::PinnedGlobally,
            ])
            .to_owned(),
        )
        .exec(DB.get().unwrap())
        .await?;

    if let Some(category_ids) = DAO_DISCOURSE_ID_TO_CATEGORY_IDS_PROPOSALS.get(&dao_discourse_id) {
        if category_ids.contains(&topic.category_id) {
            let job_data = DiscussionJobData {
                discourse_topic_id: stored_topic.last_insert_id,
            };

            job_queue::Entity::insert(job_queue::ActiveModel {
                id: NotSet,
                r#type: Set(DiscussionJobData::job_type().to_string()),
                data: Set(serde_json::to_value(job_data)?),
                status: Set("PENDING".into()),
                created_at: NotSet,
            })
            .exec(DB.get().unwrap())
            .await?;
        }
    }

    info!("Topic upserted successfully");
    Ok(())
}

#[instrument(skip( post), fields(post_id = post.id, post_username = %post.username, dao_discourse_id = %dao_discourse_id))]
pub async fn upsert_post(post: &Post, dao_discourse_id: Uuid) -> Result<()> {
    // Create an active model for the post
    let post_model = discourse_post::ActiveModel {
        external_id: Set(post.id),
        name: Set(post.name.clone()),
        username: Set(post.username.clone()),
        created_at: Set(post.created_at.naive_utc()),
        cooked: match &post.raw {
            Some(raw) if raw == "<p>(post deleted by author)</p>" => NotSet,
            Some(raw) => Set(Some(raw.clone())),
            None => NotSet,
        },
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
        deleted: Set(post
            .raw
            .as_ref()
            .is_some_and(|raw| raw == "<p>(post deleted by author)</p>")),
        ..Default::default()
    };

    // Perform the upsert operation
    discourse_post::Entity::insert(post_model)
        .on_conflict(
            OnConflict::columns([
                discourse_post::Column::ExternalId,
                discourse_post::Column::DaoDiscourseId,
            ])
            .update_columns([
                discourse_post::Column::Name,
                discourse_post::Column::Username,
                discourse_post::Column::CreatedAt,
                discourse_post::Column::Cooked,
                discourse_post::Column::PostNumber,
                discourse_post::Column::PostType,
                discourse_post::Column::UpdatedAt,
                discourse_post::Column::ReplyCount,
                discourse_post::Column::ReplyToPostNumber,
                discourse_post::Column::QuoteCount,
                discourse_post::Column::IncomingLinkCount,
                discourse_post::Column::Reads,
                discourse_post::Column::ReadersCount,
                discourse_post::Column::Score,
                discourse_post::Column::TopicId,
                discourse_post::Column::TopicSlug,
                discourse_post::Column::DisplayUsername,
                discourse_post::Column::PrimaryGroupName,
                discourse_post::Column::FlairName,
                discourse_post::Column::FlairUrl,
                discourse_post::Column::FlairBgColor,
                discourse_post::Column::FlairColor,
                discourse_post::Column::Version,
                discourse_post::Column::UserId,
                discourse_post::Column::CanViewEditHistory,
                discourse_post::Column::Deleted,
            ])
            .to_owned(),
        )
        .exec(DB.get().unwrap())
        .await?;

    info!("Post upserted successfully");
    Ok(())
}

#[instrument(skip( revision), fields(revision_version = revision.current_version, post_id = revision.post_id, dao_discourse_id = %dao_discourse_id))]
pub async fn upsert_revision(revision: &Revision, dao_discourse_id: Uuid, discourse_post_id: Uuid) -> Result<()> {
    let cooked_body_before = Some(revision.get_cooked_markdown_before());
    let cooked_body_after = Some(revision.get_cooked_markdown_after());

    let cooked_title_before = revision
        .title_changes
        .as_ref()
        .map(|tc| tc.get_cooked_before_html());
    let cooked_title_after = revision
        .title_changes
        .as_ref()
        .map(|tc| tc.get_cooked_after_html());

    // Create an active model for the revision
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

    // Perform the upsert operation
    discourse_post_revision::Entity::insert(revision_model)
        .on_conflict(
            OnConflict::columns([
                discourse_post_revision::Column::ExternalPostId,
                discourse_post_revision::Column::Version,
                discourse_post_revision::Column::DaoDiscourseId,
            ])
            .update_columns([
                discourse_post_revision::Column::CreatedAt,
                discourse_post_revision::Column::Username,
                discourse_post_revision::Column::BodyChanges,
                discourse_post_revision::Column::TitleChanges,
                discourse_post_revision::Column::EditReason,
                discourse_post_revision::Column::CookedBodyBefore,
                discourse_post_revision::Column::CookedTitleBefore,
                discourse_post_revision::Column::CookedBodyAfter,
                discourse_post_revision::Column::CookedTitleAfter,
            ])
            .to_owned(),
        )
        .exec(DB.get().unwrap())
        .await?;

    info!("Revision upserted successfully");
    Ok(())
}

#[instrument( fields(user_ids = ?user_ids, dao_discourse_id, post_id))]
pub async fn upsert_post_likes_batch(post_id: i32, user_ids: Vec<i32>, dao_discourse_id: Uuid) -> Result<()> {
    if user_ids.is_empty() {
        return Ok(());
    }

    // Find existing likes for the given post and users
    let existing_likes = discourse_post_like::Entity::find()
        .filter(
            Condition::all()
                .add(discourse_post_like::Column::ExternalDiscoursePostId.eq(post_id))
                .add(discourse_post_like::Column::ExternalUserId.is_in(user_ids.clone()))
                .add(discourse_post_like::Column::DaoDiscourseId.eq(dao_discourse_id)),
        )
        .all(DB.get().unwrap())
        .await?;

    // Extract the user IDs of existing likes
    let existing_user_ids: Vec<i32> = existing_likes
        .into_iter()
        .map(|like| like.external_user_id)
        .collect();

    // Determine which user IDs are not already in the database
    let new_user_ids: Vec<i32> = user_ids
        .into_iter()
        .filter(|user_id| !existing_user_ids.contains(user_id))
        .collect();

    // Calculate the number of new likes to insert
    let new_likes_count = new_user_ids.len();

    // Insert only the new likes
    if new_likes_count > 0 {
        let new_likes = new_user_ids
            .into_iter()
            .map(|user_id| discourse_post_like::ActiveModel {
                id: NotSet,
                external_discourse_post_id: Set(post_id),
                external_user_id: Set(user_id),
                created_at: Set(Utc::now().naive_utc()),
                dao_discourse_id: Set(dao_discourse_id),
            })
            .collect::<Vec<_>>();

        discourse_post_like::Entity::insert_many(new_likes)
            .exec(DB.get().unwrap())
            .await?;

        info!("Batch upserted post likes successfully");
    } else {
        info!("All likes already exist, skipping insertion");
    }

    Ok(())
}

#[instrument(fields(post_external_id = post_external_id, dao_discourse_id = %dao_discourse_id))]
pub async fn get_post_like_count(post_external_id: i32, dao_discourse_id: Uuid) -> Result<u64> {
    let count = discourse_post_like::Entity::find()
        .filter(
            Condition::all()
                .add(discourse_post_like::Column::ExternalDiscoursePostId.eq(post_external_id))
                .add(discourse_post_like::Column::DaoDiscourseId.eq(dao_discourse_id)),
        )
        .count(DB.get().unwrap())
        .await?;

    info!(post_external_id, dao_discourse_id = %dao_discourse_id, count, "Fetched post like count");

    Ok(count)
}
