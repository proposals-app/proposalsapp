use crate::{DB, EMBEDDINGS};
use anyhow::{Context, Result};
use proposalsapp_db::models::{
    dao, dao_discourse, discourse_post, discourse_topic, proposal, proposal_group,
};
use sea_orm::{
    ActiveValue::NotSet, ColumnTrait, EntityTrait, QueryFilter, QueryOrder, Set, prelude::Uuid,
};
use std::collections::{HashMap, HashSet};
use tracing::{info, instrument, warn};
use utils::types::{ProposalGroupItem, ProposalItem, TopicItem};

lazy_static::lazy_static! {
    /// Mapping of DAO slugs to the Discourse category IDs that should be included
    /// in proposal grouping. Topics in other categories will be ignored.
    static ref DAO_DISCOURSE_CATEGORY_FILTERS: HashMap<&'static str, Vec<i32>> = {
        let mut m = HashMap::new();

        m.insert("arbitrum", vec![7, 8, 9]);
        m.insert("uniswap", vec![5, 8, 9, 10]);

        m
    };
}

/// Represents an item that can be grouped (either a proposal or a topic)
#[derive(Clone)]
enum GroupableItem {
    Proposal {
        _id: Uuid,
        external_id: String,
        governor_id: Uuid,
        name: String,
        body: String,
        discussion_url: Option<String>,
    },
    Topic {
        _id: Uuid,
        external_id: String,
        dao_discourse_id: Uuid,
        title: String,
        first_post_content: String,
    },
}

impl GroupableItem {
    fn id(&self) -> String {
        match self {
            GroupableItem::Proposal { external_id, .. } => format!("proposal_{}", external_id),
            GroupableItem::Topic { external_id, .. } => format!("topic_{}", external_id),
        }
    }

    fn title(&self) -> &str {
        match self {
            GroupableItem::Proposal { name, .. } => name,
            GroupableItem::Topic { title, .. } => title,
        }
    }

    fn body(&self) -> &str {
        match self {
            GroupableItem::Proposal { body, .. } => body,
            GroupableItem::Topic {
                first_post_content, ..
            } => first_post_content,
        }
    }

    fn to_group_item(&self) -> ProposalGroupItem {
        match self {
            GroupableItem::Proposal {
                external_id,
                governor_id,
                name,
                ..
            } => ProposalGroupItem::Proposal(ProposalItem {
                name: name.clone(),
                governor_id: *governor_id,
                external_id: external_id.clone(),
            }),
            GroupableItem::Topic {
                external_id,
                dao_discourse_id,
                title,
                ..
            } => ProposalGroupItem::Topic(TopicItem {
                name: title.clone(),
                external_id: external_id.clone(),
                dao_discourse_id: *dao_discourse_id,
            }),
        }
    }
}

#[instrument]
pub async fn run_group_task() -> Result<()> {
    info!("Starting grouping task");

    // Get all DAOs
    let daos = dao::Entity::find()
        .all(DB.get().unwrap())
        .await
        .context("Failed to fetch DAOs")?;

    for dao in daos {
        process_dao_grouping(&dao).await?;
    }

    Ok(())
}

#[instrument(skip(dao))]
async fn process_dao_grouping(dao: &dao::Model) -> Result<()> {
    info!(dao_id = %dao.id, dao_slug = %dao.slug, "Processing grouping for DAO");

    // Get DAO discourse configuration
    let dao_discourse = dao_discourse::Entity::find()
        .filter(dao_discourse::Column::DaoId.eq(dao.id))
        .filter(dao_discourse::Column::Enabled.eq(true))
        .one(DB.get().unwrap())
        .await
        .context("Failed to fetch DAO discourse configuration")?;

    // Load all existing groups for this DAO
    let existing_groups = proposal_group::Entity::find()
        .filter(proposal_group::Column::DaoId.eq(dao.id))
        .all(DB.get().unwrap())
        .await
        .context("Failed to fetch proposal groups")?;

    // Build a set of already grouped items
    let mut grouped_items = HashSet::new();
    for group in &existing_groups {
        match serde_json::from_value::<Vec<ProposalGroupItem>>(group.items.clone()) {
            Ok(items) => {
                for item in items {
                    match item {
                        ProposalGroupItem::Proposal(p) => {
                            grouped_items.insert(format!("proposal_{}", p.external_id));
                        }
                        ProposalGroupItem::Topic(t) => {
                            grouped_items.insert(format!("topic_{}", t.external_id));
                        }
                    }
                }
            }
            Err(e) => {
                warn!(group_id = %group.id, error = %e, "Failed to deserialize group items");
            }
        }
    }

    // Load all proposals for this DAO
    let proposals = proposal::Entity::find()
        .filter(proposal::Column::DaoId.eq(dao.id))
        .order_by_asc(proposal::Column::CreatedAt)
        .all(DB.get().unwrap())
        .await
        .context("Failed to fetch proposals")?;

    // Load all topics if discourse is configured
    let topics = if let Some(ref dao_disc) = dao_discourse {
        // Get category filter for this DAO
        let allowed_categories = DAO_DISCOURSE_CATEGORY_FILTERS
            .get(dao.slug.as_str())
            .cloned()
            .unwrap_or_default();

        if allowed_categories.is_empty() {
            vec![]
        } else {
            let mut query = discourse_topic::Entity::find()
                .filter(discourse_topic::Column::DaoDiscourseId.eq(dao_disc.id));

            // Add category filter
            let category_conditions = allowed_categories
                .into_iter()
                .map(|cat_id| discourse_topic::Column::CategoryId.eq(cat_id))
                .collect::<Vec<_>>();

            if !category_conditions.is_empty() {
                use sea_orm::Condition;
                let mut condition = Condition::any();
                for cond in category_conditions {
                    condition = condition.add(cond);
                }
                query = query.filter(condition);
            }

            query
                .order_by_asc(discourse_topic::Column::CreatedAt)
                .all(DB.get().unwrap())
                .await
                .context("Failed to fetch discourse topics")?
        }
    } else {
        vec![]
    };

    // Convert to GroupableItems and filter out already grouped items
    let mut ungrouped_items = Vec::new();

    for proposal in proposals {
        let id = format!("proposal_{}", proposal.external_id);
        if !grouped_items.contains(&id) {
            ungrouped_items.push(GroupableItem::Proposal {
                _id: proposal.id,
                external_id: proposal.external_id.clone(),
                governor_id: proposal.governor_id,
                name: proposal.name.clone(),
                body: proposal.body.clone(),
                discussion_url: proposal.discussion_url.clone(),
            });
        }
    }

    for topic in topics {
        let id = format!("topic_{}", topic.external_id);
        if !grouped_items.contains(&id) {
            // Get first post content - skip topic if we can't fetch it
            match discourse_post::Entity::find()
                .filter(discourse_post::Column::TopicId.eq(topic.external_id))
                .filter(discourse_post::Column::PostNumber.eq(1))
                .one(DB.get().unwrap())
                .await
            {
                Ok(Some(post)) => {
                    if let Some(content) = post.cooked {
                        ungrouped_items.push(GroupableItem::Topic {
                            _id: topic.id,
                            external_id: topic.external_id.to_string(),
                            dao_discourse_id: topic.dao_discourse_id,
                            title: topic.title.clone(),
                            first_post_content: content,
                        });
                    }
                }
                Ok(None) => {
                    warn!(
                        topic_id = %topic.id,
                        topic_external_id = %topic.external_id,
                        "No first post found for topic, skipping"
                    );
                }
                Err(e) => {
                    warn!(
                        topic_id = %topic.id,
                        topic_external_id = %topic.external_id,
                        error = %e,
                        "Failed to fetch first post for topic, skipping"
                    );
                }
            }
        }
    }

    info!(
        ungrouped_count = ungrouped_items.len(),
        existing_groups = existing_groups.len(),
        "Starting to process ungrouped items"
    );

    // Process each ungrouped item
    let mut newly_grouped = HashSet::new();

    // First pass: Handle URL-based matching for proposals (certain matches)
    for item in ungrouped_items.iter() {
        if let GroupableItem::Proposal {
            external_id,
            discussion_url: Some(url),
            ..
        } = item
        {
            if newly_grouped.contains(&item.id()) {
                continue;
            }

            // Try to extract topic ID from the URL
            let (topic_id, _topic_slug) = extract_discourse_id_or_slug(url);
            if let Some(tid) = topic_id {
                let topic_external_id = tid.to_string();

                // Find the topic in ungrouped items
                let topic_item = ungrouped_items.iter().find(|i| {
                    matches!(i, GroupableItem::Topic { external_id: tid, .. } if tid == &topic_external_id)
                });

                if let Some(topic) = topic_item {
                    if !newly_grouped.contains(&topic.id()) {
                        // Create new group with both proposal and topic
                        create_new_group_with_items(vec![item, topic], dao).await?;
                        newly_grouped.insert(item.id());
                        newly_grouped.insert(topic.id());
                        info!(
                            proposal_id = %external_id,
                            topic_id = %topic_external_id,
                            "Created group via URL matching"
                        );
                    }
                } else {
                    // Check if the topic is already in an existing group
                    for group in &existing_groups {
                        if let Ok(items) =
                            serde_json::from_value::<Vec<ProposalGroupItem>>(group.items.clone())
                        {
                            for group_item in &items {
                                if let ProposalGroupItem::Topic(t) = group_item {
                                    if t.external_id == topic_external_id {
                                        // Add proposal to existing group
                                        add_item_to_group(item, group.id, &existing_groups).await?;
                                        newly_grouped.insert(item.id());
                                        info!(
                                            proposal_id = %external_id,
                                            topic_id = %topic_external_id,
                                            group_id = %group.id,
                                            "Added proposal to existing group via URL matching"
                                        );
                                        break;
                                    }
                                }
                            }
                            if newly_grouped.contains(&item.id()) {
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    // Second pass: AI-based matching for remaining ungrouped items
    for (idx, item) in ungrouped_items.iter().enumerate() {
        // Skip if this item was grouped in this run
        if newly_grouped.contains(&item.id()) {
            continue;
        }

        // Build list of all candidates (existing group items + remaining ungrouped items)
        let mut candidates = Vec::new();

        // Add all items from existing groups
        for group in &existing_groups {
            if let Ok(items) = serde_json::from_value::<Vec<ProposalGroupItem>>(group.items.clone())
            {
                for group_item in items {
                    match group_item {
                        ProposalGroupItem::Proposal(p) => {
                            // Find the full proposal data
                            if let Ok(Some(prop)) = proposal::Entity::find()
                                .filter(proposal::Column::ExternalId.eq(&p.external_id))
                                .one(DB.get().unwrap())
                                .await
                            {
                                candidates.push((
                                    format!(
                                        "group_{}_{}",
                                        group.id,
                                        format!("proposal_{}", p.external_id)
                                    ),
                                    prop.name.clone(),
                                    Some(prop.body.clone()),
                                ));
                            }
                        }
                        ProposalGroupItem::Topic(t) => {
                            // Find the full topic data with first post
                            if let Ok(Some(topic)) = discourse_topic::Entity::find()
                                .filter(discourse_topic::Column::ExternalId.eq(&t.external_id))
                                .one(DB.get().unwrap())
                                .await
                            {
                                match discourse_post::Entity::find()
                                    .filter(discourse_post::Column::TopicId.eq(topic.external_id))
                                    .filter(discourse_post::Column::PostNumber.eq(1))
                                    .one(DB.get().unwrap())
                                    .await
                                {
                                    Ok(Some(post)) => {
                                        candidates.push((
                                            format!(
                                                "group_{}_{}",
                                                group.id,
                                                format!("topic_{}", t.external_id)
                                            ),
                                            topic.title.clone(),
                                            post.cooked.clone(),
                                        ));
                                    }
                                    Ok(None) => {
                                        warn!(
                                            topic_id = %topic.id,
                                            "No first post found for topic in group, using title only"
                                        );
                                        candidates.push((
                                            format!(
                                                "group_{}_{}",
                                                group.id,
                                                format!("topic_{}", t.external_id)
                                            ),
                                            topic.title.clone(),
                                            None,
                                        ));
                                    }
                                    Err(e) => {
                                        warn!(
                                            topic_id = %topic.id,
                                            error = %e,
                                            "Failed to fetch first post for topic in group, using title only"
                                        );
                                        candidates.push((
                                            format!(
                                                "group_{}_{}",
                                                group.id,
                                                format!("topic_{}", t.external_id)
                                            ),
                                            topic.title.clone(),
                                            None,
                                        ));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Add remaining ungrouped items
        for (other_idx, other_item) in ungrouped_items.iter().enumerate() {
            if other_idx != idx && !newly_grouped.contains(&other_item.id()) {
                candidates.push((
                    other_item.id(),
                    other_item.title().to_string(),
                    Some(other_item.body().to_string()),
                ));
            }
        }

        if candidates.is_empty() {
            // No candidates, create a single-item group
            create_single_item_group(item, dao).await?;
            newly_grouped.insert(item.id());
            continue;
        }

        // Find top candidates using embeddings and reranking
        let embeddings = EMBEDDINGS.get().unwrap();
        let ranked_candidates = embeddings
            .find_top_candidates(
                item.title(),
                Some(item.body()),
                candidates,
                1, // We only need the top match
            )
            .await?;

        if let Some(best_match) = ranked_candidates.first() {
            info!(
                item_id = %item.id(),
                best_match_id = %best_match.id,
                angular_similarity = %best_match.angular_similarity,
                rerank_score = %best_match.rerank_score,
                "Found best match for item"
            );

            // Check if the best match meets the minimum similarity threshold
            const SIMILARITY_THRESHOLD: f32 = 0.7;
            
            if best_match.angular_similarity >= SIMILARITY_THRESHOLD {
                // Good match - proceed with grouping
                if best_match.id.starts_with("group_") {
                    // Extract group ID from the candidate ID
                    let parts: Vec<&str> = best_match.id.split('_').collect();
                    if let Ok(group_id) = Uuid::parse_str(parts[1]) {
                        // Add item to existing group
                        add_item_to_group(item, group_id, &existing_groups).await?;
                        newly_grouped.insert(item.id());
                    }
                } else {
                    // Best match is another ungrouped item - create a new group with both
                    let other_item = ungrouped_items
                        .iter()
                        .find(|i| i.id() == best_match.id)
                        .unwrap();

                    create_new_group_with_items(vec![item, other_item], dao).await?;
                    newly_grouped.insert(item.id());
                    newly_grouped.insert(other_item.id());
                }
            } else {
                // Best match doesn't meet threshold - create single-item group
                info!(
                    item_id = %item.id(),
                    best_match_id = %best_match.id,
                    angular_similarity = %best_match.angular_similarity,
                    threshold = %SIMILARITY_THRESHOLD,
                    "Best match below threshold, creating single-item group"
                );
                create_single_item_group(item, dao).await?;
                newly_grouped.insert(item.id());
            }
        } else {
            // No candidates at all, create single-item group
            create_single_item_group(item, dao).await?;
            newly_grouped.insert(item.id());
        }
    }

    info!(
        newly_grouped_count = newly_grouped.len(),
        "Completed grouping for DAO"
    );

    Ok(())
}

async fn add_item_to_group(
    item: &GroupableItem,
    group_id: Uuid,
    existing_groups: &[proposal_group::Model],
) -> Result<()> {
    // Find the group
    let group = existing_groups
        .iter()
        .find(|g| g.id == group_id)
        .context("Group not found")?;

    // Deserialize existing items
    let mut items = serde_json::from_value::<Vec<ProposalGroupItem>>(group.items.clone())
        .context("Failed to deserialize group items")?;

    // Add new item
    items.push(item.to_group_item());

    // Update group
    let mut active_group: proposal_group::ActiveModel = group.clone().into();
    active_group.items = Set(serde_json::to_value(&items)?);

    proposal_group::Entity::update(active_group)
        .exec(DB.get().unwrap())
        .await
        .context("Failed to update group")?;

    info!(
        group_id = %group_id,
        item_id = %item.id(),
        new_size = items.len(),
        "Added item to existing group"
    );

    Ok(())
}

async fn create_new_group_with_items(items: Vec<&GroupableItem>, dao: &dao::Model) -> Result<()> {
    let group_items: Vec<ProposalGroupItem> =
        items.iter().map(|item| item.to_group_item()).collect();

    // Use the first item's title as the group name
    let group_name = items[0].title().to_string();

    let new_group = proposal_group::ActiveModel {
        id: NotSet,
        name: Set(group_name.clone()),
        items: Set(serde_json::to_value(&group_items)?),
        created_at: NotSet,
        dao_id: Set(dao.id),
    };

    let created_group = proposal_group::Entity::insert(new_group)
        .exec(DB.get().unwrap())
        .await
        .context("Failed to create proposal group")?;

    info!(
        group_id = %created_group.last_insert_id,
        group_name = %group_name,
        item_count = items.len(),
        "Created new group with multiple items"
    );

    Ok(())
}

async fn create_single_item_group(item: &GroupableItem, dao: &dao::Model) -> Result<()> {
    create_new_group_with_items(vec![item], dao).await
}

/// Extract topic ID and/or slug from a Discourse URL
pub fn extract_discourse_id_or_slug(url: &str) -> (Option<i32>, Option<String>) {
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

    // Real-world URL extraction tests based on actual Arbitrum forum URLs
    #[test]
    fn test_real_arbitrum_forum_urls() {
        // Test cases from actual Arbitrum DAO discussion URLs
        let test_cases = vec![
            (
                "https://forum.arbitrum.foundation/t/arbitrum-research-and-development-collective-v2-extension/29476",
                (Some(29476), Some("arbitrum-research-and-development-collective-v2-extension".to_string()))
            ),
            (
                "https://forum.arbitrum.foundation/t/proposal-extend-agv-council-term-and-align-future-elections-with-operational-cadence/29425",
                (Some(29425), Some("proposal-extend-agv-council-term-and-align-future-elections-with-operational-cadence".to_string()))
            ),
            (
                "https://forum.arbitrum.foundation/t/constitutional-aip-remove-cost-cap-on-arbitrum-nova/29332",
                (Some(29332), Some("constitutional-aip-remove-cost-cap-on-arbitrum-nova".to_string()))
            ),
            (
                "https://forum.arbitrum.foundation/t/arbitrum-treasury-management-council-consolidating-efforts/29334",
                (Some(29334), Some("arbitrum-treasury-management-council-consolidating-efforts".to_string()))
            ),
        ];

        for (url, expected) in test_cases {
            assert_eq!(
                extract_discourse_id_or_slug(url),
                expected,
                "Failed for URL: {}",
                url
            );
        }
    }

    #[test]
    fn test_special_characters_in_real_slugs() {
        // Test with actual Arbitrum proposals that have special formatting
        let test_cases = vec![
            (
                "https://forum.arbitrum.foundation/t/non-constitutional-proposal-establishing-the-arbitrum-ecosystem-fund/29513",
                (
                    Some(29513),
                    Some(
                        "non-constitutional-proposal-establishing-the-arbitrum-ecosystem-fund"
                            .to_string(),
                    ),
                ),
            ),
            (
                "https://forum.arbitrum.foundation/t/proposal-institutional-arb-buyback-via-bond-issuance/29491",
                (
                    Some(29491),
                    Some("proposal-institutional-arb-buyback-via-bond-issuance".to_string()),
                ),
            ),
            (
                "https://forum.arbitrum.foundation/t/proposal-launch-native-arb-staking-at-8-apy/29399",
                (
                    Some(29399),
                    Some("proposal-launch-native-arb-staking-at-8-apy".to_string()),
                ),
            ),
        ];

        for (url, expected) in test_cases {
            assert_eq!(
                extract_discourse_id_or_slug(url),
                expected,
                "Failed for URL: {}",
                url
            );
        }
    }

    #[test]
    fn test_uniswap_forum_urls() {
        // Test with actual Uniswap forum URLs
        let test_cases = vec![
            (
                "https://gov.uniswap.org/t/making-protocol-fees-operational/21198?u=gfxlabs",
                (Some(21198), Some("making-protocol-fees-operational".to_string()))
            ),
            (
                "https://gov.uniswap.org/t/uniswap-deployments-accountability-committee-next-steps-the-committee-application-thread/22475?u=doo_stablelab",
                (Some(22475), Some("uniswap-deployments-accountability-committee-next-steps-the-committee-application-thread".to_string()))
            ),
            (
                "https://gov.uniswap.org/t/rfc-onboard-unichain-to-v3-and-create-unichains-own-message-passing-bridge/24219",
                (Some(24219), Some("rfc-onboard-unichain-to-v3-and-create-unichains-own-message-passing-bridge".to_string()))
            ),
            (
                "https://gov.uniswap.org/t/rfc-onboard-unichain-to-v3-and-create-unichains-own-message-passing-bridge/24219/5",
                (Some(24219), Some("rfc-onboard-unichain-to-v3-and-create-unichains-own-message-passing-bridge".to_string()))
            ),
        ];

        for (url, expected) in test_cases {
            assert_eq!(
                extract_discourse_id_or_slug(url),
                expected,
                "Failed for URL: {}",
                url
            );
        }
    }

    #[test]
    fn test_edge_case_uniswap_urls() {
        // Test edge cases from the provided list
        let test_cases = vec![
            // Standard format
            (
                "https://gov.uniswap.org/t/arbitrum-ltipp-incentive-matching/24066",
                (
                    Some(24066),
                    Some("arbitrum-ltipp-incentive-matching".to_string()),
                ),
            ),
            // With post number
            (
                "https://gov.uniswap.org/t/deploy-uniswap-v3-on-linea/21261/1",
                (Some(21261), Some("deploy-uniswap-v3-on-linea".to_string())),
            ),
            // With query params
            (
                "https://gov.uniswap.org/t/rfc-deploy-uniswap-v3-on-x-layer/24307?u=gfxlabs",
                (
                    Some(24307),
                    Some("rfc-deploy-uniswap-v3-on-x-layer".to_string()),
                ),
            ),
            // With post number and query params
            (
                "https://gov.uniswap.org/t/rfc-deploy-uniswap-v3-on-x-layer/24307/26?u=gfxlabs",
                (
                    Some(24307),
                    Some("rfc-deploy-uniswap-v3-on-x-layer".to_string()),
                ),
            ),
            // URL ending with just slug (no ID)
            (
                "https://gov.uniswap.org/t/deploy-uniswap-v3-to-boba-network/",
                (None, Some("deploy-uniswap-v3-to-boba-network".to_string())),
            ),
            // URL ending with just slug (no ID, no trailing slash)
            (
                "https://gov.uniswap.org/t/rfc-deploy-uniswap-v3-on-zora",
                (None, Some("rfc-deploy-uniswap-v3-on-zora".to_string())),
            ),
            // URL ending with just slug (no ID)
            (
                "https://gov.uniswap.org/t/temperature-check-should-uniswap-v3-be-deployed-to-bnb-chain",
                (
                    None,
                    Some(
                        "temperature-check-should-uniswap-v3-be-deployed-to-bnb-chain".to_string(),
                    ),
                ),
            ),
        ];

        for (url, expected) in test_cases {
            assert_eq!(
                extract_discourse_id_or_slug(url),
                expected,
                "Failed for URL: {}",
                url
            );
        }
    }

    #[test]
    fn test_non_discourse_urls() {
        // Test non-discourse URLs that should return None
        let test_cases = vec![
            (
                "https://snapshot.org/#/uniswapgovernance.eth/proposal/0xe7274e00eb2a084cdc3b7510a8b40aa303ac2d7944e9706ad090c974c76e71bf",
                (None, None),
            ),
            ("https://github.com/uniswap/v3-core", (None, None)),
            ("https://uniswap.org/", (None, None)),
        ];

        for (url, expected) in test_cases {
            assert_eq!(
                extract_discourse_id_or_slug(url),
                expected,
                "Failed for URL: {}",
                url
            );
        }
    }
}
