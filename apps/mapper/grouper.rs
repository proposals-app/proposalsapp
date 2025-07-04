use crate::DB;
use anyhow::{Context, Result};
use proposalsapp_db::models::{
    dao_discourse, discourse_topic, job_queue, proposal, proposal_group,
};
use sea_orm::{
    ActiveValue::NotSet, ColumnTrait, EntityTrait, QueryFilter, QueryOrder, Set, prelude::Uuid,
};
use tracing::{Span, error, info, instrument, warn};
use utils::types::{
    DiscussionJobData, JobType, ProposalGroupItem, ProposalItem, ProposalJobData, TopicItem,
};

#[instrument()]
pub async fn run_group_task() -> Result<()> {
    let pending_jobs = job_queue::Entity::find()
        .filter(
            job_queue::Column::Status
                .eq("PENDING")
                .and(job_queue::Column::Type.is_in(vec![
                    JobType::MapperNewProposalDiscussion.to_string(),
                    JobType::MapperNewSnapshotProposal.to_string(),
                ])),
        )
        .order_by_asc(job_queue::Column::CreatedAt)
        .all(DB.get().unwrap())
        .await
        .context("Failed to fetch pending jobs")?;

    Span::current().record("job_count", pending_jobs.len());

    for job in pending_jobs {
        let span = Span::current();
        span.record("job_id", job.id);
        span.record("job_type", &job.r#type);

        info!(job_id = job.id, job_type = %job.r#type, "Processing job");

        let job_type: JobType = job.r#type.parse().context("Failed to parse job type")?;

        let job_result = match job_type {
            JobType::MapperNewProposalDiscussion => {
                let data: DiscussionJobData = serde_json::from_value(job.data.clone())
                    .context("Failed to deserialize discussion job data")?;
                process_new_discussion_job(job.id, data.discourse_topic_id).await
            }
            JobType::MapperNewSnapshotProposal => {
                let data: ProposalJobData = serde_json::from_value(job.data.clone())
                    .context("Failed to deserialize proposal job data")?;
                process_snapshot_proposal_job(job.id, data.proposal_id).await
            }
        };

        match job_result {
            Ok(_) => {
                // Update job status to COMPLETED only if processing was successful
                let job_id = job.id;
                let mut job: job_queue::ActiveModel = job.into();
                job.status = Set("COMPLETED".to_string());
                job_queue::Entity::update(job)
                    .exec(DB.get().unwrap())
                    .await
                    .context("Failed to update job status for job")?;

                info!(job_id = job_id, "Job completed successfully");
            }
            Err(e) => {
                error!(
                    error = %e,
                    job_id = job.id,
                    "Job processing failed"
                );
            }
        }
    }

    Ok(())
}

#[instrument(fields(job_id = job_id, discourse_topic_id = %discourse_topic_id))]
async fn process_new_discussion_job(job_id: i32, discourse_topic_id: Uuid) -> Result<()> {
    info!(
        job_id = job_id,
        discourse_topic_id = %discourse_topic_id,
        "Starting to process new discussion job"
    );

    // Find the discourse topic
    let topic = match discourse_topic::Entity::find_by_id(discourse_topic_id)
        .one(DB.get().unwrap())
        .await
        .context("Failed to find discourse topic")?
    {
        Some(topic) => {
            info!(
                job_id = job_id,
                discourse_topic_id = %discourse_topic_id,
                "Discourse topic found"
            );
            topic
        }
        None => {
            error!(
                job_id = job_id,
                discourse_topic_id = %discourse_topic_id,
                "Discourse topic not found"
            );
            return Ok(());
        }
    };

    // Check if topic is already part of a proposal group
    info!(
        job_id = job_id,
        discourse_topic_id = %discourse_topic_id,
        "Checking if topic is already part of a proposal group"
    );

    let topic_already_mapped = check_topic_already_mapped(topic.clone()).await?;

    if topic_already_mapped {
        info!(
            job_id = job_id,
            discourse_topic_id = %discourse_topic_id,
            "Topic is already part of a proposal group"
        );
    } else {
        info!(
            job_id = job_id,
            discourse_topic_id = %discourse_topic_id,
            "Topic is not part of any proposal group, creating a new group"
        );

        let discourse_indexer = dao_discourse::Entity::find_by_id(topic.dao_discourse_id)
            .one(DB.get().unwrap())
            .await
            .context("Failed to find discourse indexer")?;

        if let Some(discourse_indexer) = discourse_indexer {
            info!(
                job_id = job_id,
                discourse_topic_id = %discourse_topic_id,
                dao_discourse_id = %discourse_indexer.id,
                "Found discourse indexer for the topic"
            );

            // Create new proposal group
            let new_group = proposal_group::ActiveModel {
                id: NotSet,
                dao_id: Set(discourse_indexer.dao_id),
                name: Set(topic.title.clone()),
                items: Set(
                    serde_json::to_value(vec![ProposalGroupItem::Topic(TopicItem {
                        name: topic.title.clone(),
                        external_id: topic.external_id.to_string(),
                        dao_discourse_id: topic.dao_discourse_id,
                    })])
                    .context("Failed to serialize proposal group items")?,
                ),
                created_at: NotSet,
            };

            proposal_group::Entity::insert(new_group)
                .exec(DB.get().unwrap())
                .await
                .context("Failed to create proposal group")?;

            info!(
                job_id = job_id,
                discourse_topic_id = %discourse_topic_id,
                "Created new proposal group"
            );
        } else {
            error!(
                job_id = job_id,
                discourse_topic_id = %discourse_topic_id,
                dao_discourse_id = %topic.dao_discourse_id,
                "No discourse indexer found for the topic"
            );
        }
    }

    info!(
        job_id = job_id,
        discourse_topic_id = %discourse_topic_id,
        "Finished processing new discussion job"
    );

    Ok(())
}

async fn check_topic_already_mapped(topic: discourse_topic::Model) -> Result<bool> {
    let proposal_groups = proposal_group::Entity::find()
        .all(DB.get().unwrap())
        .await
        .context("Failed to fetch proposal groups")?;

    for group in proposal_groups {
        if let Ok(items) = serde_json::from_value::<Vec<ProposalGroupItem>>(group.items) {
            for item in items {
                if let ProposalGroupItem::Topic(topic_item) = item {
                    if topic_item.external_id == topic.external_id.to_string()
                        && topic_item.dao_discourse_id == topic.dao_discourse_id
                    {
                        return Ok(true);
                    }
                }
            }
        }
    }
    Ok(false)
}

#[instrument(fields(job_id = job_id, proposal_id = %proposal_id))]
async fn process_snapshot_proposal_job(job_id: i32, proposal_id: Uuid) -> Result<()> {
    info!(
        job_id = job_id,
        proposal_id = %proposal_id,
        "Starting to process snapshot proposal job"
    );

    // Find the snapshot proposal
    let proposal = match proposal::Entity::find_by_id(proposal_id)
        .one(DB.get().unwrap())
        .await
    {
        Ok(Some(proposal)) => {
            info!(
                job_id = job_id,
                proposal_id = %proposal_id,
                "Snapshot proposal found"
            );
            proposal
        }
        Ok(None) => {
            error!(
                job_id = job_id,
                proposal_id = %proposal_id,
                "Snapshot proposal not found"
            );
            return Ok(());
        }
        Err(e) => {
            error!(
                job_id = job_id,
                proposal_id = %proposal_id,
                error = %e,
                "Failed to find snapshot proposal"
            );
            return Err(e).context("Failed to find snapshot proposal")?;
        }
    };

    // Extract discussion_id or slug from discussion_url if it exists
    if let Some(ref discussion_url) = proposal.discussion_url {
        info!(
            job_id = job_id,
            proposal_id = %proposal_id,
            discussion_url = %discussion_url,
            "Found discussion URL in proposal"
        );

        let (topic_id, topic_slug) = extract_discourse_id_or_slug(discussion_url);

        let Some(dao_discourse) = dao_discourse::Entity::find()
            .filter(dao_discourse::Column::DaoId.eq(proposal.dao_id))
            .one(DB.get().unwrap())
            .await
            .context("Failed to find DAO discourse configuration")?
        else {
            error!(
                job_id = job_id,
                proposal_id = %proposal_id,
                dao_id = %proposal.dao_id,
                "No DAO discourse configuration found for proposal's DAO"
            );
            return Ok(());
        };

        info!(
            job_id = job_id,
            proposal_id = %proposal_id,
            dao_discourse_id = %dao_discourse.id,
            "Found DAO discourse configuration"
        );

        // Find the discourse topic by ID or slug
        let discourse_topic = if let Some(topic_id) = topic_id {
            discourse_topic::Entity::find()
                .filter(
                    discourse_topic::Column::ExternalId
                        .eq(topic_id)
                        .and(discourse_topic::Column::DaoDiscourseId.eq(dao_discourse.id)),
                )
                .one(DB.get().unwrap())
                .await
                .context("Failed to find discourse topic by ID")?
        } else if let Some(topic_slug) = topic_slug {
            discourse_topic::Entity::find()
                .filter(
                    discourse_topic::Column::Slug
                        .eq(topic_slug)
                        .and(discourse_topic::Column::DaoDiscourseId.eq(dao_discourse.id)),
                )
                .one(DB.get().unwrap())
                .await
                .context("Failed to find discourse topic by slug")?
        } else {
            None
        };

        if let Some(topic) = discourse_topic {
            info!(
                job_id = job_id,
                proposal_id = %proposal_id,
                discourse_topic_id = %topic.id,
                "Found discourse topic"
            );

            // Find the proposal group containing this topic directly
            let group = find_group_by_topic(topic.clone()).await?;

            if let Some(group) = group {
                info!(
                    job_id = job_id,
                    proposal_id = %proposal_id,
                    group_id = %group.id,
                    "Found proposal group containing the discourse topic"
                );

                if let Ok(mut items) =
                    serde_json::from_value::<Vec<ProposalGroupItem>>(group.items.clone())
                {
                    // Check if proposal is not already in the group
                    let proposal_already_in_group = items.iter().any(|item| match item {
                        ProposalGroupItem::Proposal(prop_item) => {
                            prop_item.external_id == proposal.id.to_string()
                        }
                        _ => false,
                    });

                    if !proposal_already_in_group {
                        info!(
                            job_id = job_id,
                            proposal_id = %proposal_id,
                            "Proposal is not in the group, adding it"
                        );

                        items.push(ProposalGroupItem::Proposal(ProposalItem {
                            name: proposal.name.clone(),
                            governor_id: proposal.governor_id,
                            external_id: proposal.external_id.to_string(),
                        }));

                        // Update the group
                        let mut group: proposal_group::ActiveModel = group.into();
                        group.items = Set(serde_json::to_value(items)
                            .context("Failed to serialize proposal group items")?);
                        proposal_group::Entity::update(group)
                            .exec(DB.get().unwrap())
                            .await
                            .context("Failed to update proposal group")?;

                        info!(
                            job_id = job_id,
                            proposal_id = %proposal_id,
                            discourse_topic_id = %topic.id,
                            "Added snapshot proposal to existing group"
                        );
                    } else {
                        info!(
                            job_id = job_id,
                            proposal_id = %proposal_id,
                            "Proposal is already in the group"
                        );
                    }
                } else {
                    error!(
                        job_id = job_id,
                        proposal_id = %proposal_id,
                        group_id = %group.id,
                        "Failed to deserialize proposal group items"
                    );
                }
            } else {
                warn!(
                    job_id = job_id,
                    proposal_id = %proposal_id,
                    "No proposal group found for the discourse topic"
                );
            }
        } else {
            warn!(
                job_id = job_id,
                proposal_id = %proposal_id,
                "No discourse topic found for the extracted topic ID or slug"
            );
        }
    } else {
        warn!(
            job_id = job_id,
            proposal_id = %proposal_id,
            "No discussion_url provided in the proposal"
        );
    }

    info!(
        job_id = job_id,
        proposal_id = %proposal_id,
        "Finished processing snapshot proposal job"
    );

    Ok(())
}

async fn find_group_by_topic(
    topic: discourse_topic::Model,
) -> Result<Option<proposal_group::Model>> {
    let proposal_groups = proposal_group::Entity::find()
        .all(DB.get().unwrap())
        .await
        .context("Failed to fetch proposal groups")?;

    for group in proposal_groups {
        if let Ok(items) = serde_json::from_value::<Vec<ProposalGroupItem>>(group.items.clone()) {
            for item in items {
                if let ProposalGroupItem::Topic(topic_item) = item {
                    if topic_item.external_id == topic.external_id.to_string()
                        && topic_item.dao_discourse_id == topic.dao_discourse_id
                    {
                        return Ok(Some(group));
                    }
                }
            }
        }
    }
    Ok(None)
}

fn extract_discourse_id_or_slug(url: &str) -> (Option<i32>, Option<String>) {
    // Remove query parameters and fragments
    let url_without_query = url.split('?').next().unwrap_or("");
    let url_clean = url_without_query.split('#').next().unwrap_or("");
    let parts: Vec<&str> = url_clean
        .split('/')
        .filter(|&part| !part.is_empty())
        .collect();

    // Check if the URL contains the "t" segment, which is typical for Discourse
    // topic URLs
    if let Some(index) = parts.iter().position(|&part| part == "t") {
        // Discourse URLs typically have the format: /t/slug/id or sometimes just /t/id
        // First, check if there's a segment after 't'
        if let Some(first_part) = parts.get(index + 1) {
            // Check if it's a numeric ID (old format: /t/12345)
            if let Ok(id) = first_part.parse::<i32>() {
                return (Some(id), None);
            }

            // Otherwise, it's a slug. Check if there's an ID after the slug
            let slug = Some(first_part.to_string());
            let id = parts
                .get(index + 2)
                .and_then(|part| part.parse::<i32>().ok());

            (id, slug)
        } else {
            (None, None)
        }
    } else {
        // If the URL doesn't contain the "t" segment, return None for both ID and slug
        (None, None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Tests for ID-only format: /t/12345
    #[test]
    fn test_id_only_basic() {
        let url = "https://example.com/t/12345";
        assert_eq!(extract_discourse_id_or_slug(url), (Some(12345), None));
    }

    #[test]
    fn test_id_only_with_query_params() {
        let url = "https://example.com/t/12345?param=value&another=test";
        assert_eq!(extract_discourse_id_or_slug(url), (Some(12345), None));
    }

    #[test]
    fn test_id_only_with_post_number() {
        let url = "https://example.com/t/12345/67";
        assert_eq!(extract_discourse_id_or_slug(url), (Some(12345), None));
    }

    #[test]
    fn test_id_only_with_trailing_slash() {
        let url = "https://example.com/t/12345/";
        assert_eq!(extract_discourse_id_or_slug(url), (Some(12345), None));
    }

    // Tests for slug-only format: /t/topic-slug
    #[test]
    fn test_slug_only_basic() {
        let url = "https://example.com/t/my-topic-slug";
        assert_eq!(
            extract_discourse_id_or_slug(url),
            (None, Some("my-topic-slug".to_string()))
        );
    }

    #[test]
    fn test_slug_only_with_dashes() {
        let url = "https://example.com/t/this-is-a-long-topic-slug";
        assert_eq!(
            extract_discourse_id_or_slug(url),
            (None, Some("this-is-a-long-topic-slug".to_string()))
        );
    }

    #[test]
    fn test_slug_only_alphanumeric_mix() {
        let url = "https://example.com/t/proposal123abc";
        assert_eq!(
            extract_discourse_id_or_slug(url),
            (None, Some("proposal123abc".to_string()))
        );
    }

    // Tests for slug + ID format: /t/slug/12345
    #[test]
    fn test_slug_and_id_basic() {
        let url = "https://example.com/t/my-topic/12345";
        assert_eq!(
            extract_discourse_id_or_slug(url),
            (Some(12345), Some("my-topic".to_string()))
        );
    }

    #[test]
    fn test_slug_and_id_with_query_params() {
        let url = "https://example.com/t/topic-slug/12345?u=username&ref=search";
        assert_eq!(
            extract_discourse_id_or_slug(url),
            (Some(12345), Some("topic-slug".to_string()))
        );
    }

    #[test]
    fn test_slug_and_id_with_post_number() {
        let url = "https://example.com/t/my-topic-slug/12345/7";
        assert_eq!(
            extract_discourse_id_or_slug(url),
            (Some(12345), Some("my-topic-slug".to_string()))
        );
    }

    #[test]
    fn test_real_arbitrum_forum_url() {
        let url = "https://forum.arbitrum.foundation/t/reallocate-redeemed-usdm-funds-to-step-2-budget/29335?u=entropy";
        assert_eq!(
            extract_discourse_id_or_slug(url),
            (
                Some(29335),
                Some("reallocate-redeemed-usdm-funds-to-step-2-budget".to_string())
            )
        );
    }

    #[test]
    fn test_very_long_arbitrum_slug() {
        let url = "https://forum.arbitrum.foundation/t/wind-down-the-mss-transfer-payment-responsibilities-to-the-arbitrum-foundation/29279";
        assert_eq!(
            extract_discourse_id_or_slug(url),
            (
                Some(29279),
                Some("wind-down-the-mss-transfer-payment-responsibilities-to-the-arbitrum-foundation".to_string())
            )
        );
    }

    #[test]
    fn test_extremely_long_slug_with_id() {
        let url = "https://forum.arbitrum.foundation/t/non-constitutional-proposal-for-piloting-enhancements-and-strengthening-the-sustainability-of-arbitrumhub-in-the-year-ahead/12345";
        assert_eq!(
            extract_discourse_id_or_slug(url),
            (
                Some(12345),
                Some("non-constitutional-proposal-for-piloting-enhancements-and-strengthening-the-sustainability-of-arbitrumhub-in-the-year-ahead".to_string())
            )
        );
    }

    // Tests for URL variations and edge cases
    #[test]
    fn test_url_with_fragment() {
        let url = "https://forum.example.com/t/topic-slug/12345#post_5";
        assert_eq!(
            extract_discourse_id_or_slug(url),
            (Some(12345), Some("topic-slug".to_string()))
        );
    }

    #[test]
    fn test_url_with_multiple_slashes() {
        let url = "https://forum.example.com//t//topic-slug//12345//";
        assert_eq!(
            extract_discourse_id_or_slug(url),
            (Some(12345), Some("topic-slug".to_string()))
        );
    }

    #[test]
    fn test_protocol_relative_url() {
        let url = "//forum.example.com/t/topic-slug/12345";
        assert_eq!(
            extract_discourse_id_or_slug(url),
            (Some(12345), Some("topic-slug".to_string()))
        );
    }

    #[test]
    fn test_relative_url() {
        let url = "/t/topic-slug/12345";
        assert_eq!(
            extract_discourse_id_or_slug(url),
            (Some(12345), Some("topic-slug".to_string()))
        );
    }

    #[test]
    fn test_url_without_protocol() {
        let url = "forum.example.com/t/topic-slug/12345";
        assert_eq!(
            extract_discourse_id_or_slug(url),
            (Some(12345), Some("topic-slug".to_string()))
        );
    }

    #[test]
    fn test_unicode_characters_in_slug() {
        let url = "https://forum.example.com/t/тема-на-русском/12345";
        assert_eq!(
            extract_discourse_id_or_slug(url),
            (Some(12345), Some("тема-на-русском".to_string()))
        );
    }

    // Tests for invalid/malformed URLs
    #[test]
    fn test_empty_url() {
        let url = "";
        assert_eq!(extract_discourse_id_or_slug(url), (None, None));
    }

    #[test]
    fn test_url_without_t_segment() {
        let url = "https://example.com/some/other/path";
        assert_eq!(extract_discourse_id_or_slug(url), (None, None));
    }

    #[test]
    fn test_url_with_empty_t_segment() {
        let url = "https://example.com/t/";
        assert_eq!(extract_discourse_id_or_slug(url), (None, None));
    }

    #[test]
    fn test_url_with_only_domain() {
        let url = "https://example.com";
        assert_eq!(extract_discourse_id_or_slug(url), (None, None));
    }

    #[test]
    fn test_url_with_t_but_no_content() {
        let url = "https://example.com/t";
        assert_eq!(extract_discourse_id_or_slug(url), (None, None));
    }

    // Edge case: slug that looks like it could be an ID but isn't numeric
    #[test]
    fn test_slug_only_with_trailing_slash() {
        let url = "https://forum.arbitrum.foundation/t/non-constitutional-proposal-for-piloting-enhancements-and-strengthening-the-sustainability-of-arbitrumhub-in-the-year-ahead/";
        assert_eq!(
            extract_discourse_id_or_slug(url),
            (
                None,
                Some("non-constitutional-proposal-for-piloting-enhancements-and-strengthening-the-sustainability-of-arbitrumhub-in-the-year-ahead".to_string())
            )
        );
    }
}
