use crate::{
    RECENT_LOOKBACK_HOURS,
    db_handler::{db, upsert_revision},
    discourse_api::{DiscourseApi, process_upload_urls},
    models::revisions::Revision,
};
use anyhow::{Context, Result};
use chrono::{Duration, Utc};
use futures::stream::{self, StreamExt, TryStreamExt};
use proposalsapp_db::models::{discourse_post, discourse_post_revision};
use sea_orm::{
    ColumnTrait, Condition, EntityTrait, FromQueryResult, QueryFilter, QuerySelect, prelude::Uuid,
    sea_query::Expr,
};
use std::{collections::HashSet, sync::Arc};
use tokio::task::JoinSet;
use tracing::{debug, error, info, instrument, warn};

#[derive(Clone)] // Add Clone derive
pub struct RevisionIndexer {
    discourse_api: Arc<DiscourseApi>,
}

// Define a helper struct to hold the query result
#[derive(Debug, FromQueryResult)]
struct PostWithRevisionCount {
    id: Uuid,
    external_id: i32,
    version: i32,
    revision_count: i64,
}

impl RevisionIndexer {
    pub fn new(discourse_api: Arc<DiscourseApi>) -> Self {
        Self { discourse_api }
    }

    /// Updates revisions for posts that have been recently updated and might be missing revisions.
    /// Uses high priority for API requests.
    #[instrument(skip(self), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_recent_revisions(&self, dao_discourse_id: Uuid) -> Result<()> {
        info!("Starting update of recent revisions (high priority)");
        self.update_revisions_internal(
            dao_discourse_id,
            true, /* recent_only */
            true, /* priority */
        )
        .await
    }

    /// Updates revisions for potentially *all* posts that might be missing revisions.
    /// Uses low priority for API requests. This is a full refresh/backfill task.
    #[instrument(skip(self), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_all_revisions(&self, dao_discourse_id: Uuid) -> Result<()> {
        info!("Starting full update of all revisions (low priority)");
        self.update_revisions_internal(
            dao_discourse_id,
            false, /* recent_only */
            false, /* priority */
        )
        .await
    }

    /// Internal helper to fetch posts needing revision updates and process them.
    #[instrument(skip(self), fields(dao_discourse_id = %dao_discourse_id, recent_only = recent_only, priority = priority))]
    async fn update_revisions_internal(
        &self,
        dao_discourse_id: Uuid,
        recent_only: bool,
        priority: bool,
    ) -> Result<()> {
        let posts_needing_update = self
            .fetch_posts_needing_revision_update(dao_discourse_id, recent_only)
            .await
            .context("Failed to fetch posts needing revision updates")?;

        if posts_needing_update.is_empty() {
            info!("No posts found needing revision updates.");
            return Ok(());
        }

        info!(
            count = posts_needing_update.len(),
            "Found posts needing revision updates. Processing..."
        );

        let mut join_set = JoinSet::new();
        let max_concurrent_posts = 20; // Limit concurrent post processing

        for post_summary in posts_needing_update {
            // Check if we need to limit concurrency
            if join_set.len() >= max_concurrent_posts {
                // Wait for one task to complete before spawning more
                if let Some(result) = join_set.join_next().await {
                    Self::handle_join_result(result);
                }
            }

            let api_handler = Arc::clone(&self.discourse_api);
            // Spawn task to update revisions for a single post
            join_set.spawn(async move {
                // Pass priority down
                update_revisions_for_post(api_handler, dao_discourse_id, post_summary, priority)
                    .await
            });
        }

        // Wait for remaining tasks to complete
        while let Some(result) = join_set.join_next().await {
            Self::handle_join_result(result);
        }

        info!(
            "Finished updating revisions (recent_only: {}, priority: {}).",
            recent_only, priority
        );
        Ok(())
    }

    /// Handles the result of a completed task from the JoinSet.
    fn handle_join_result(result: Result<Result<()>, tokio::task::JoinError>) {
        match result {
            Ok(Ok(())) => { /* Task completed successfully */ }
            Ok(Err(e)) => {
                // Task completed with an application error (logged within the task)
                warn!(error = ?e, "Revision update task for a post failed.");
            }
            Err(e) => {
                // Task panicked or was cancelled
                error!(error = ?e, "Revision update task join error (panic or cancellation).");
            }
        }
    }

    /// Fetches posts from the DB that might be missing revision data.
    /// Filters by recent updates if `recent_only` is true.
    #[instrument(skip(self), fields(dao_discourse_id = %dao_discourse_id, recent_only = recent_only))]
    async fn fetch_posts_needing_revision_update(
        &self,
        dao_discourse_id: Uuid,
        recent_only: bool,
    ) -> Result<Vec<PostWithRevisionCount>> {
        // Return the helper struct
        info!("Fetching posts needing revision update from DB");

        let mut query = discourse_post::Entity::find().filter(
            Condition::all()
                .add(discourse_post::Column::DaoDiscourseId.eq(dao_discourse_id))
                .add(discourse_post::Column::Version.gt(1)) // Only posts with edits
                .add(discourse_post::Column::CanViewEditHistory.eq(true)) // Only if allowed
                .add(discourse_post::Column::Deleted.eq(false)), // Skip deleted posts
        );

        if recent_only {
            let lookback_time = Utc::now() - Duration::hours(RECENT_LOOKBACK_HOURS);
            debug!(?lookback_time, "Filtering for posts updated recently");
            query = query.filter(discourse_post::Column::UpdatedAt.gte(lookback_time.naive_utc()));
        }

        // Fetch posts and their existing revision counts efficiently
        let posts_with_revision_counts: Vec<PostWithRevisionCount> = query
            .left_join(discourse_post_revision::Entity)
            .select_only()
            // Select necessary columns from `discourse_post`
            .column(discourse_post::Column::Id)
            .column(discourse_post::Column::ExternalId)
            .column(discourse_post::Column::Version)
            .column(discourse_post::Column::DaoDiscourseId)
            .column(discourse_post::Column::UpdatedAt)
            // Count the revisions associated with each post
            .column_as(
                Expr::col((
                    discourse_post_revision::Entity,
                    discourse_post_revision::Column::Id,
                ))
                .count(),
                "revision_count",
            )
            .group_by(discourse_post::Column::Id) // Group by the columns we selected from discourse_post
            .group_by(discourse_post::Column::ExternalId)
            .group_by(discourse_post::Column::Version)
            .group_by(discourse_post::Column::DaoDiscourseId)
            .group_by(discourse_post::Column::UpdatedAt)
            .into_model::<PostWithRevisionCount>() // Use the helper struct
            .all(db())
            .await
            .context("Failed to fetch posts with revision counts")?;

        // Filter posts where the stored revision count is less than expected
        let filtered_posts: Vec<PostWithRevisionCount> = posts_with_revision_counts
            .into_iter()
            .filter(|post_summary| {
                let expected_revisions = (post_summary.version - 1).max(0) as i64; // Version 1 has 0 revisions
                post_summary.revision_count < expected_revisions
            })
            .inspect(|post_summary| {
                // Use inspect for logging within iterator chain
                debug!(post_id = %post_summary.id, post_external_id = post_summary.external_id, post_version = post_summary.version, db_revision_count = post_summary.revision_count, "Post identified as needing revision update.");
            })
            .collect();

        info!(
            count = filtered_posts.len(),
            recent_only, "Found posts needing revision updates"
        );
        Ok(filtered_posts)
    }
}

/// Fetches and upserts all missing revisions for a single post.
#[instrument(skip(discourse_api, post_summary), fields(post_id = %post_summary.id, external_post_id = post_summary.external_id, post_version = post_summary.version, dao_discourse_id = %dao_discourse_id, priority = priority))]
async fn update_revisions_for_post(
    discourse_api: Arc<DiscourseApi>,
    dao_discourse_id: Uuid,
    post_summary: PostWithRevisionCount, // Take ownership of the summary struct
    priority: bool,
) -> Result<()> {
    info!("Updating revisions for post");

    // Fetch existing revision versions for this post from the DB
    let existing_revision_versions: HashSet<i32> = discourse_post_revision::Entity::find()
        .filter(discourse_post_revision::Column::DiscoursePostId.eq(post_summary.id))
        .select_only()
        .column(discourse_post_revision::Column::Version)
        .into_tuple() // Fetch version as a tuple (i32,)
        .all(db())
        .await?
        .into_iter()
        .map(|(version,)| version) // Extract the i32 version from the tuple
        .collect();
    debug!(post_id = %post_summary.id, ?existing_revision_versions, "Found existing revision versions in DB.");

    // Determine which revisions are missing (from 2 up to the post's current version)
    let mut missing_versions = Vec::new();
    for rev_num in 2..=post_summary.version {
        if !existing_revision_versions.contains(&rev_num) {
            missing_versions.push(rev_num);
        }
    }

    if missing_versions.is_empty() {
        debug!(post_id = %post_summary.id, "No missing revisions detected for this post.");
        return Ok(());
    }

    info!(post_id = %post_summary.id, missing_count = missing_versions.len(), ?missing_versions, "Fetching missing revisions.");

    // Fetch and process missing revisions concurrently
    let results = stream::iter(missing_versions)
        .map(|rev_num| {
            let api = Arc::clone(&discourse_api);
            let post_internal_id = post_summary.id; // Internal UUID
            let post_external_id = post_summary.external_id; // External ID

            async move {
                let url = format!("/posts/{post_external_id}/revisions/{rev_num}.json");
                debug!(%url, "Fetching revision");

                // Fetch the revision data
                let mut revision: Revision = match api.queue(&url, priority).await {
                    Ok(rev) => rev,
                    Err(e) => {
                        error!(error = ?e, %url, rev_num, "Failed to fetch revision data");
                        // Return error to stop processing this revision
                        return Err(e.context(format!(
                            "Failed to fetch revision v{rev_num} for post {post_external_id}"
                        )));
                    }
                };

                // Process upload URLs in revision body content (sync function)
                let processed_body =
                    process_upload_urls(&revision.body_changes.side_by_side_markdown, api.clone());
                revision.body_changes.side_by_side_markdown = processed_body;

                // Process title changes if they exist (sync function)
                if let Some(title_changes) = &mut revision.title_changes {
                    let processed_title = process_upload_urls(&title_changes.inline, api.clone());
                    title_changes.inline = processed_title;
                }

                // Upsert the processed revision data
                upsert_revision(&revision, dao_discourse_id, post_internal_id)
                    .await
                    .with_context(|| {
                        format!(
                            "Failed to upsert revision v{rev_num} for post_id {post_internal_id}"
                        )
                    })
            }
        })
        .buffer_unordered(5) // Limit concurrent revision fetches per post
        .try_collect::<Vec<()>>() // Collect results, stop on first error
        .await;

    match results {
        Ok(_) => {
            info!(post_id = %post_summary.id, "Successfully updated missing revisions for post.");
            Ok(())
        }
        Err(e) => {
            error!(post_id = %post_summary.id, error = ?e, "Failed to update some revisions for post.");
            Err(e) // Propagate the first error encountered
        }
    }
}
