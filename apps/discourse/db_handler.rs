use crate::models::{
    categories::Category, posts::Post, revisions::Revision, topics::Topic, users::User,
};
use anyhow::{Context, Result};
use chrono::Utc;
use once_cell::sync::OnceCell;
use proposalsapp_db::models::{
    discourse_category, discourse_post, discourse_post_like, discourse_post_revision,
    discourse_topic, discourse_user,
};
use sea_orm::{
    ActiveValue::NotSet, ColumnTrait, Condition, DatabaseConnection, EntityTrait, PaginatorTrait,
    QueryFilter, Set, prelude::Uuid, sea_query::OnConflict,
};
use std::time::Duration;
use tracing::{debug, info, instrument};

// Use a OnceCell for safe, one-time initialization.
pub static DB: OnceCell<DatabaseConnection> = OnceCell::new();

/// Initializes the database connection pool.
/// Reads the DATABASE_URL from environment variables.
#[instrument]
pub async fn initialize_db() -> Result<()> {
    let database_url =
        std::env::var("DATABASE_URL").context("DATABASE_URL environment variable not set")?;

    let mut opt = sea_orm::ConnectOptions::new(database_url);
    opt.max_connections(25) // Increased to handle concurrent API requests
        .min_connections(5)
        .connect_timeout(Duration::from_secs(15))
        .acquire_timeout(Duration::from_secs(30))
        .idle_timeout(Duration::from_secs(5 * 60))
        .max_lifetime(Duration::from_secs(30 * 60))
        .sqlx_logging(false);

    let db = sea_orm::Database::connect(opt)
        .await
        .context("Failed to connect to the database")?;

    DB.set(db)
        .map_err(|_| anyhow::anyhow!("Failed to set database connection"))
}

/// Retrieves the global database connection.
/// Panics if the database is not initialized.
///
/// # Safety
/// This function should only be called after `initialize_db()` has completed successfully.
/// The initialization happens at service startup before any database operations.
#[inline(always)]
pub fn db() -> &'static DatabaseConnection {
    DB.get()
        .expect("Database connection not initialized. Call initialize_db first.")
}

/// Retrieves the global database connection, returning an error if not initialized.
/// Use this in contexts where graceful error handling is preferred over panicking.
#[inline(always)]
#[allow(dead_code)]
pub fn try_db() -> Result<&'static DatabaseConnection> {
    DB.get().ok_or_else(|| {
        anyhow::anyhow!("Database connection not initialized. Call initialize_db first.")
    })
}

/// Gets or creates a generic 'unknown' user record for associating orphaned content.
#[instrument(fields(dao_discourse_id = %dao_discourse_id))]
pub async fn get_or_create_unknown_user(dao_discourse_id: Uuid) -> Result<User> {
    // Define the 'unknown' user details. Using ID -1 is conventional.
    let unknown_user = User {
        id: -1,
        username: "unknown_user".to_string(),
        name: Some("Unknown User".to_string()),
        avatar_template: "".to_string(), // Placeholder avatar
        title: None,
        likes_received: Some(0),
        likes_given: Some(0),
        topics_entered: Some(0),
        topic_count: Some(0),
        post_count: Some(0),
        posts_read: Some(0),
        days_visited: Some(0),
    };

    // Attempt to upsert this user. Errors during DB operation are propagated.
    upsert_user(&unknown_user, dao_discourse_id).await?;
    debug!("Ensured 'unknown_user' exists in the database.");
    Ok(unknown_user)
}

/// Inserts or updates a user record in the database based on external ID and DAO discourse ID.
#[instrument(skip(user), fields(user_id = user.id, user_username = %user.username, dao_discourse_id = %dao_discourse_id))]
pub async fn upsert_user(user: &User, dao_discourse_id: Uuid) -> Result<()> {
    let user_model = discourse_user::ActiveModel {
        external_id: Set(user.id),
        username: Set(user.username.clone()),
        name: Set(user.name.clone()),
        avatar_template: Set(user.avatar_template.clone()),
        title: Set(user.title.clone()),
        // Use unwrap_or(0) for safety, converting to i64 as required by schema.
        likes_received: Set(Some(user.likes_received.unwrap_or(0) as i64)),
        likes_given: Set(Some(user.likes_given.unwrap_or(0) as i64)),
        topics_entered: Set(Some(user.topics_entered.unwrap_or(0) as i64)),
        topic_count: Set(Some(user.topic_count.unwrap_or(0) as i64)),
        post_count: Set(Some(user.post_count.unwrap_or(0) as i64)),
        posts_read: Set(Some(user.posts_read.unwrap_or(0) as i64)),
        days_visited: Set(Some(user.days_visited.unwrap_or(0) as i64)),
        dao_discourse_id: Set(dao_discourse_id),
        ..Default::default() // Use default for fields like `id`, `created_at`, etc.
    };

    // Define the conflict action: update specified columns if the unique key constraint fails.
    let on_conflict = OnConflict::columns([
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
        // `updated_at` should be automatically handled by the database or model behavior if configured.
    ])
    .to_owned();

    // Execute the insert operation with conflict resolution.
    discourse_user::Entity::insert(user_model)
        .on_conflict(on_conflict)
        .exec(db()) // Use the db() helper function
        .await
        .with_context(|| format!("Failed to upsert user with external_id {}", user.id))?;

    debug!("User upserted successfully.");
    Ok(())
}

/// Inserts or updates a category record in the database.
#[instrument(skip(category), fields(category_id = category.id, category_name = %category.name, dao_discourse_id = %dao_discourse_id))]
pub async fn upsert_category(category: &Category, dao_discourse_id: Uuid) -> Result<()> {
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

    let on_conflict = OnConflict::columns([
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
    .to_owned();

    discourse_category::Entity::insert(category_model)
        .on_conflict(on_conflict)
        .exec(db())
        .await
        .with_context(|| format!("Failed to upsert category with external_id {}", category.id))?;

    debug!("Category upserted successfully.");
    Ok(())
}

/// Inserts or updates a topic record.
#[instrument(skip(topic), fields(topic_id = topic.id, topic_title = %topic.title, dao_discourse_id = %dao_discourse_id))]
pub async fn upsert_topic(topic: &Topic, dao_discourse_id: Uuid) -> Result<()> {
    let topic_model = discourse_topic::ActiveModel {
        external_id: Set(topic.id),
        title: Set(topic.title.clone()),
        fancy_title: Set(topic.fancy_title.clone()),
        slug: Set(topic.slug.clone()),
        posts_count: Set(topic.posts_count),
        reply_count: Set(topic.reply_count),
        // Ensure DateTime is converted to NaiveDateTime for the database.
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

    let on_conflict = OnConflict::columns([
        discourse_topic::Column::ExternalId,
        discourse_topic::Column::DaoDiscourseId,
    ])
    .update_columns([
        discourse_topic::Column::Title,
        discourse_topic::Column::FancyTitle,
        discourse_topic::Column::Slug,
        discourse_topic::Column::PostsCount,
        discourse_topic::Column::ReplyCount,
        discourse_topic::Column::CreatedAt, // Ensure we update timestamps if needed
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
    .to_owned();

    discourse_topic::Entity::insert(topic_model)
        .on_conflict(on_conflict)
        .exec(db())
        .await
        .with_context(|| format!("Failed to upsert topic with external_id {}", topic.id))?;

    debug!(topic_id = topic.id, "Topic upserted successfully.");
    Ok(())
}

/// Inserts or updates a post record. Handles potential deletion flags based on raw content.
#[instrument(skip(post), fields(post_id = post.id, post_username = %post.username, dao_discourse_id = %dao_discourse_id))]
pub async fn upsert_post(post: &Post, dao_discourse_id: Uuid) -> Result<()> {
    // Determine if the post is considered deleted based on specific raw content patterns.
    let mut is_deleted = post.raw.as_ref().is_some_and(|raw| {
        raw == "(post deleted by author)"
            || raw == "<p>(post deleted by author)</p>"
            || raw.is_empty()
    });

    let cooked_content = if is_deleted {
        NotSet
    } else {
        match &post.raw {
            Some(raw) => {
                if !raw.is_empty() {
                    Set(Some(raw.clone()))
                } else {
                    // probably was moderated
                    is_deleted = true;
                    NotSet
                }
            }
            None => NotSet,
        }
    };

    let post_model = discourse_post::ActiveModel {
        external_id: Set(post.id),
        name: Set(post.name.clone()),
        username: Set(post.username.clone()),
        created_at: Set(post.created_at.naive_utc()),
        cooked: cooked_content,
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
        deleted: Set(is_deleted),
        ..Default::default()
    };

    let on_conflict = OnConflict::columns([
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
    .to_owned();

    discourse_post::Entity::insert(post_model)
        .on_conflict(on_conflict)
        .exec(db())
        .await
        .with_context(|| format!("Failed to upsert post with external_id {}", post.id))?;

    debug!("Post upserted successfully.");
    Ok(())
}

/// Inserts or updates a post revision record.
#[instrument(skip(revision), fields(revision_version = revision.current_version, post_id = revision.post_id, dao_discourse_id = %dao_discourse_id, discourse_post_id = %discourse_post_id))]
pub async fn upsert_revision(
    revision: &Revision,
    dao_discourse_id: Uuid,
    discourse_post_id: Uuid, // This is the internal UUID of the post
) -> Result<()> {
    // Extract structured diff content. Log errors but don't fail the upsert.
    let cooked_body_before = revision.get_cooked_markdown_before();
    let cooked_body_after = revision.get_cooked_markdown_after();

    let cooked_title_before = revision
        .title_changes
        .as_ref()
        .map(|tc| tc.get_cooked_before_html());
    let cooked_title_after = revision
        .title_changes
        .as_ref()
        .map(|tc| tc.get_cooked_after_html());

    let revision_model = discourse_post_revision::ActiveModel {
        external_post_id: Set(revision.post_id), // Store the external Discourse post ID
        version: Set(revision.current_version),
        created_at: Set(revision.created_at.naive_utc()),
        username: Set(revision.username.clone()),
        body_changes: Set(revision.body_changes.side_by_side_markdown.clone()), // Raw diff HTML
        title_changes: Set(revision.title_changes.as_ref().map(|tc| tc.inline.clone())),
        edit_reason: Set(revision.edit_reason.clone()),
        // Store the processed before/after content
        cooked_body_before: Set(Some(cooked_body_before)),
        cooked_title_before: Set(cooked_title_before),
        cooked_body_after: Set(Some(cooked_body_after)),
        cooked_title_after: Set(cooked_title_after),
        dao_discourse_id: Set(dao_discourse_id),
        discourse_post_id: Set(discourse_post_id), // Link to the internal post UUID
        ..Default::default()
    };

    let on_conflict = OnConflict::columns([
        // Unique constraint should be on internal post ID, version, and DAO.
        discourse_post_revision::Column::DiscoursePostId,
        discourse_post_revision::Column::Version,
        discourse_post_revision::Column::DaoDiscourseId,
    ])
    .update_columns([
        // It's unlikely a revision itself changes, but update fields just in case.
        discourse_post_revision::Column::CreatedAt,
        discourse_post_revision::Column::Username,
        discourse_post_revision::Column::BodyChanges,
        discourse_post_revision::Column::TitleChanges,
        discourse_post_revision::Column::EditReason,
        discourse_post_revision::Column::CookedBodyBefore,
        discourse_post_revision::Column::CookedTitleBefore,
        discourse_post_revision::Column::CookedBodyAfter,
        discourse_post_revision::Column::CookedTitleAfter,
        discourse_post_revision::Column::DiscoursePostId, // Ensure internal FK is updated if needed
    ])
    .to_owned();

    discourse_post_revision::Entity::insert(revision_model)
        .on_conflict(on_conflict)
        .exec(db())
        .await
        .with_context(|| {
            format!(
                "Failed to upsert revision v{} for post {}",
                revision.current_version, revision.post_id
            )
        })?;

    debug!("Revision upserted successfully.");
    Ok(())
}

/// Inserts multiple post like records efficiently, avoiding duplicates.
#[instrument(fields(post_id = post_id, user_count = user_ids.len(), dao_discourse_id = %dao_discourse_id))]
pub async fn upsert_post_likes_batch(
    post_id: i32,       // External Discourse Post ID
    user_ids: Vec<i32>, // External Discourse User IDs
    dao_discourse_id: Uuid,
) -> Result<()> {
    if user_ids.is_empty() {
        debug!("No user IDs provided for batch like upsert, skipping.");
        return Ok(());
    }

    // 1. Find existing likes for this specific post and DAO instance
    let existing_likes = discourse_post_like::Entity::find()
        .filter(
            Condition::all()
                .add(discourse_post_like::Column::ExternalDiscoursePostId.eq(post_id))
                .add(discourse_post_like::Column::DaoDiscourseId.eq(dao_discourse_id))
                .add(discourse_post_like::Column::ExternalUserId.is_in(user_ids.clone())), // Filter by provided users
        )
        .all(db())
        .await
        .context("Failed to query existing post likes")?;

    // 2. Create a set of user IDs that already have a like recorded
    let existing_user_ids: std::collections::HashSet<i32> = existing_likes
        .into_iter()
        .map(|like| like.external_user_id)
        .collect();

    // 3. Determine which user IDs are new likes
    let new_likes_models: Vec<discourse_post_like::ActiveModel> = user_ids
        .into_iter()
        .filter(|user_id| !existing_user_ids.contains(user_id)) // Filter out existing ones
        .map(|user_id| discourse_post_like::ActiveModel {
            id: NotSet, // Let DB generate UUID
            external_discourse_post_id: Set(post_id),
            external_user_id: Set(user_id),
            created_at: Set(Utc::now().naive_utc()), // Set creation time
            dao_discourse_id: Set(dao_discourse_id),
        })
        .collect();

    // 4. Insert only the new likes
    let new_likes_count = new_likes_models.len();
    if new_likes_count > 0 {
        discourse_post_like::Entity::insert_many(new_likes_models)
            .exec(db())
            .await
            .with_context(|| {
                format!(
                    "Failed to batch insert {new_likes_count} new post likes for post {post_id}"
                )
            })?;
        info!(
            post_id,
            new_likes_inserted = new_likes_count,
            "Successfully batch inserted new post likes."
        );
    } else {
        debug!(post_id, "No new likes to insert for this batch.");
    }

    Ok(())
}

/// Fetches the count of likes for a specific post from the database.
#[instrument(fields(post_external_id = post_external_id, dao_discourse_id = %dao_discourse_id))]
pub async fn get_post_like_count(post_external_id: i32, dao_discourse_id: Uuid) -> Result<u64> {
    let count = discourse_post_like::Entity::find()
        .filter(
            Condition::all()
                .add(discourse_post_like::Column::ExternalDiscoursePostId.eq(post_external_id))
                .add(discourse_post_like::Column::DaoDiscourseId.eq(dao_discourse_id)),
        )
        .count(db())
        .await
        .with_context(|| format!("Failed to count post likes for post {post_external_id}"))?;

    debug!(
        post_external_id,
        dao_discourse_id = %dao_discourse_id,
        count,
        "Fetched post like count from DB"
    );
    Ok(count)
}
