use crate::{
    RECENT_LOOKBACK_HOURS,
    db_handler::{db, upsert_revision},
    discourse_api::{DiscourseApi, has_http_status, process_upload_urls},
    indexers::handle_join_result,
    models::revisions::Revision,
};
use anyhow::{Context, Result};
use chrono::{Duration, Utc};
use proposalsapp_db::models::{discourse_post, discourse_post_revision};
use reqwest::StatusCode;
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
                    handle_join_result(result, "revision update")?;
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
            handle_join_result(result, "revision update")?;
        }

        info!(
            "Finished updating revisions (recent_only: {}, priority: {}).",
            recent_only, priority
        );
        Ok(())
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
    debug!("Updating revisions for post");

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

    let expected_versions: HashSet<i32> = (2..=post_summary.version).collect();
    if expected_versions.is_subset(&existing_revision_versions) {
        debug!(post_id = %post_summary.id, "No missing revisions detected for this post.");
        return Ok(());
    }

    debug!(post_id = %post_summary.id, "Walking provider revision chain from latest");

    // Revision IDs and content versions diverge when hide/unhide events occur.
    // Walking backwards from `latest` is the provider-authoritative way to
    // discover every accessible content version.
    let mut endpoint = "latest".to_string();
    let mut visited_revision_ids = HashSet::new();
    loop {
        let url = format!(
            "/posts/{}/revisions/{endpoint}.json",
            post_summary.external_id
        );
        debug!(%url, "Fetching revision");

        let mut revision: Revision = match discourse_api.queue(&url, priority).await {
            Ok(revision) => revision,
            Err(error) if has_http_status(&error, StatusCode::FORBIDDEN) => {
                warn!(%url, "Discourse does not expose this revision chain publicly; stopping");
                break;
            }
            Err(error) => {
                error!(error = ?error, %url, "Failed to fetch revision data");
                return Err(error.context(format!(
                    "Failed to fetch revision {endpoint} for post {}",
                    post_summary.external_id
                )));
            }
        };

        if revision.post_id != post_summary.external_id {
            anyhow::bail!(
                "Discourse revision {} belongs to post {}, expected {}",
                revision.current_revision,
                revision.post_id,
                post_summary.external_id
            );
        }
        if !visited_revision_ids.insert(revision.current_revision) {
            anyhow::bail!(
                "Discourse revision chain for post {} contains a cycle at {}",
                post_summary.external_id,
                revision.current_revision
            );
        }

        if expected_versions.contains(&revision.current_version)
            && !existing_revision_versions.contains(&revision.current_version)
        {
            if let Some(body_changes) = &mut revision.body_changes {
                body_changes.side_by_side_markdown = process_upload_urls(
                    &body_changes.side_by_side_markdown,
                    &discourse_api.base_url,
                );
            }
            if let Some(title_changes) = &mut revision.title_changes {
                title_changes.inline =
                    process_upload_urls(&title_changes.inline, &discourse_api.base_url);
            }

            upsert_revision(&revision, dao_discourse_id, post_summary.id)
                .await
                .with_context(|| {
                    format!(
                        "Failed to upsert content version {} from revision {} for post {}",
                        revision.current_version,
                        revision.current_revision,
                        post_summary.external_id
                    )
                })?;
        }

        let Some(previous_revision) = revision.previous_revision else {
            break;
        };
        endpoint = previous_revision.to_string();
    }

    debug!(post_id = %post_summary.id, "Successfully updated missing revisions for post.");
    Ok(())
}
