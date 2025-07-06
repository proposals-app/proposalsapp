use crate::DB;
use anyhow::{Context, Result};
use proposalsapp_db::models::{dao, dao_discourse, discourse_topic, proposal, proposal_group};
use sea_orm::{
    ActiveValue::NotSet, ColumnTrait, EntityTrait, PaginatorTrait, QueryFilter, Set, prelude::Uuid,
};
use std::collections::HashMap;
use tracing::{info, instrument, warn};
use utils::types::{ProposalGroupItem, ProposalItem, TopicItem};

lazy_static::lazy_static! {
    /// Mapping of DAO slugs to the Discourse category IDs that should be included
    /// in proposal grouping. Topics in other categories will be ignored.
    static ref DAO_DISCOURSE_CATEGORY_FILTERS: HashMap<&'static str, Vec<i32>> = {
        let mut m = HashMap::new();

        m.insert("arbitrum", vec![7, 8, 9]);
        m.insert("uniswap", vec![5, 9, 10]);

        m
    };
}

#[instrument()]
pub async fn run_group_task() -> Result<()> {
    info!("Starting continuous grouping task");

    // Process ungrouped discourse topics
    process_ungrouped_topics().await?;

    // Process ungrouped proposals
    process_ungrouped_proposals().await?;

    Ok(())
}

#[instrument()]
async fn process_ungrouped_topics() -> Result<()> {
    info!("Looking for ungrouped discourse topics");

    // Get all DAOs with discourse enabled, including related DAO info
    let dao_discourses = dao_discourse::Entity::find()
        .filter(dao_discourse::Column::Enabled.eq(true))
        .find_with_related(dao::Entity)
        .all(DB.get().unwrap())
        .await
        .context("Failed to fetch enabled DAO discourse configurations with DAO info")?;

    for (dao_discourse, dao_vec) in dao_discourses {
        // Get the DAO slug
        let dao_slug = dao_vec.first().map(|d| d.slug.as_str()).unwrap_or_else(|| {
            warn!(dao_discourse_id = %dao_discourse.id, "Missing DAO info for discourse config");
            ""
        });

        // Get category IDs to filter (if configured)
        let category_ids = get_configured_category_ids(&dao_discourse.id, dao_slug).await?;

        // Get all topics for this DAO
        let mut query = discourse_topic::Entity::find()
            .filter(discourse_topic::Column::DaoDiscourseId.eq(dao_discourse.id));

        // Apply category filter if configured
        if !category_ids.is_empty() {
            info!(
                dao_discourse_id = %dao_discourse.id,
                category_ids = ?category_ids,
                "Filtering topics to specific categories for grouping"
            );
            query = query.filter(discourse_topic::Column::CategoryId.is_in(category_ids.clone()));
        }

        let topics = query
            .all(DB.get().unwrap())
            .await
            .context("Failed to fetch discourse topics")?;

        if !category_ids.is_empty() {
            // Also count topics that would be excluded
            let total_topics = discourse_topic::Entity::find()
                .filter(discourse_topic::Column::DaoDiscourseId.eq(dao_discourse.id))
                .count(DB.get().unwrap())
                .await
                .context("Failed to count total topics")?;

            info!(
                included_topics = topics.len(),
                total_topics = total_topics,
                excluded_topics = total_topics as usize - topics.len(),
                "Topic filtering results"
            );
        }

        // Get all proposal groups to check which topics are already grouped
        let groups = proposal_group::Entity::find()
            .filter(proposal_group::Column::DaoId.eq(dao_discourse.dao_id))
            .all(DB.get().unwrap())
            .await
            .context("Failed to fetch proposal groups")?;

        // Build set of grouped topic external IDs
        let mut grouped_topic_ids = std::collections::HashSet::new();
        for group in groups {
            if let Ok(items) = serde_json::from_value::<Vec<ProposalGroupItem>>(group.items) {
                for item in items {
                    if let ProposalGroupItem::Topic(topic_item) = item {
                        if topic_item.dao_discourse_id == dao_discourse.id {
                            grouped_topic_ids.insert(topic_item.external_id);
                        }
                    }
                }
            }
        }

        // Process ungrouped topics
        for topic in topics {
            if !grouped_topic_ids.contains(&topic.external_id.to_string()) {
                info!(
                    discourse_topic_id = %topic.id,
                    external_id = topic.external_id,
                    title = %topic.title,
                    "Found ungrouped topic, creating new group"
                );

                // Create new proposal group
                let new_group = proposal_group::ActiveModel {
                    id: NotSet,
                    dao_id: Set(dao_discourse.dao_id),
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
                    discourse_topic_id = %topic.id,
                    "Created new proposal group for ungrouped topic"
                );
            }
        }
    }

    Ok(())
}

#[instrument()]
async fn process_ungrouped_proposals() -> Result<()> {
    info!("Looking for ungrouped proposals with discussion URLs");

    // Get all DAOs
    let daos = dao::Entity::find()
        .all(DB.get().unwrap())
        .await
        .context("Failed to fetch DAOs")?;

    for dao in daos {
        // Get DAO discourse configuration
        let dao_discourse = dao_discourse::Entity::find()
            .filter(dao_discourse::Column::DaoId.eq(dao.id))
            .one(DB.get().unwrap())
            .await
            .context("Failed to fetch DAO discourse configuration")?;

        if dao_discourse.is_none() {
            continue; // Skip DAOs without discourse configuration
        }

        let dao_discourse = dao_discourse.unwrap();

        // Get all proposals with discussion URLs for this DAO
        let proposals = proposal::Entity::find()
            .filter(proposal::Column::DaoId.eq(dao.id))
            .filter(proposal::Column::DiscussionUrl.is_not_null())
            .filter(proposal::Column::MarkedSpam.eq(false))
            .all(DB.get().unwrap())
            .await
            .context("Failed to fetch proposals")?;

        // Get all proposal groups to check which proposals are already grouped
        let groups = proposal_group::Entity::find()
            .filter(proposal_group::Column::DaoId.eq(dao.id))
            .all(DB.get().unwrap())
            .await
            .context("Failed to fetch proposal groups")?;

        // Build set of grouped proposal IDs
        let mut grouped_proposal_ids = std::collections::HashSet::new();
        for group in &groups {
            if let Ok(items) = serde_json::from_value::<Vec<ProposalGroupItem>>(group.items.clone())
            {
                for item in items {
                    if let ProposalGroupItem::Proposal(proposal_item) = item {
                        grouped_proposal_ids.insert(proposal_item.external_id);
                    }
                }
            }
        }

        // Process ungrouped proposals
        for proposal in proposals {
            if grouped_proposal_ids.contains(&proposal.external_id) {
                continue; // Already grouped
            }

            if let Some(ref discussion_url) = proposal.discussion_url {
                info!(
                    proposal_id = %proposal.id,
                    external_id = %proposal.external_id,
                    discussion_url = %discussion_url,
                    "Found ungrouped proposal with discussion URL"
                );

                // Extract topic ID or slug from discussion URL
                let (topic_id, topic_slug) = extract_discourse_id_or_slug(discussion_url);

                // Find the discourse topic
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
                    // Find the proposal group containing this topic
                    let mut target_group = None;
                    for group in &groups {
                        if let Ok(items) =
                            serde_json::from_value::<Vec<ProposalGroupItem>>(group.items.clone())
                        {
                            for item in items {
                                if let ProposalGroupItem::Topic(topic_item) = item {
                                    if topic_item.external_id == topic.external_id.to_string()
                                        && topic_item.dao_discourse_id == topic.dao_discourse_id
                                    {
                                        target_group = Some(group.clone());
                                        break;
                                    }
                                }
                            }
                        }
                        if target_group.is_some() {
                            break;
                        }
                    }

                    if let Some(group) = target_group {
                        // Add proposal to existing group
                        if let Ok(mut items) =
                            serde_json::from_value::<Vec<ProposalGroupItem>>(group.items.clone())
                        {
                            info!(
                                proposal_id = %proposal.id,
                                group_id = %group.id,
                                "Adding proposal to existing group"
                            );

                            items.push(ProposalGroupItem::Proposal(ProposalItem {
                                name: proposal.name.clone(),
                                governor_id: proposal.governor_id,
                                external_id: proposal.external_id.clone(),
                            }));

                            let mut group: proposal_group::ActiveModel = group.into();
                            group.items = Set(serde_json::to_value(items)
                                .context("Failed to serialize proposal group items")?);
                            proposal_group::Entity::update(group)
                                .exec(DB.get().unwrap())
                                .await
                                .context("Failed to update proposal group")?;

                            info!(
                                proposal_id = %proposal.id,
                                "Successfully added proposal to group"
                            );
                        }
                    } else {
                        warn!(
                            proposal_id = %proposal.id,
                            discourse_topic_id = %topic.id,
                            "Found matching topic but it's not in any group"
                        );
                    }
                } else {
                    warn!(
                        proposal_id = %proposal.id,
                        discussion_url = %discussion_url,
                        "Could not find discourse topic for discussion URL"
                    );
                }
            }
        }
    }

    Ok(())
}

#[instrument(skip_all, fields(dao_discourse_id = %dao_discourse_id, dao_slug = dao_slug))]
async fn get_configured_category_ids(dao_discourse_id: &Uuid, dao_slug: &str) -> Result<Vec<i32>> {
    // Get category IDs from the static mapping
    Ok(DAO_DISCOURSE_CATEGORY_FILTERS
        .get(dao_slug)
        .cloned()
        .unwrap_or_default())
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
