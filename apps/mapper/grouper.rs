use crate::{DB, EMBEDDINGS};
use anyhow::{Context, Result};
use proposalsapp_db::models::{
    dao, dao_discourse, discourse_post, discourse_topic, proposal, proposal_group,
};
use sea_orm::{
    ActiveValue::NotSet, ColumnTrait, EntityTrait, QueryFilter, QueryOrder, QuerySelect, Set,
    prelude::Uuid,
};
use std::collections::HashMap;
use tracing::{info, instrument, warn};
use utils::types::{ProposalGroupItem, ProposalItem, TopicItem};

const MAX_GROUPS_IN_MEMORY: u64 = 500; // Keep only 500 most recent groups in memory for matching

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

#[instrument()]
pub async fn run_group_task() -> Result<()> {
    info!("Starting continuous grouping task");

    // Process ungrouped discourse topics
    process_ungrouped_topics().await?;

    // Process ungrouped proposals with three-tier system
    process_ungrouped_proposals_with_tiers().await?;

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

        info!(
            dao_discourse_id = %dao_discourse.id,
            "Processing discourse topics"
        );

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

        // Get all topics (no pagination)
        let mut query = discourse_topic::Entity::find()
            .filter(discourse_topic::Column::DaoDiscourseId.eq(dao_discourse.id))
            .order_by_asc(discourse_topic::Column::Id);

        if !category_ids.is_empty() {
            query = query.filter(discourse_topic::Column::CategoryId.is_in(category_ids.clone()));
        }

        let topics = query
            .all(DB.get().unwrap())
            .await
            .context("Failed to fetch topics")?;

        info!(total_topics = topics.len(), "Processing all topics");

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
async fn process_ungrouped_proposals_with_tiers() -> Result<()> {
    info!("Looking for ungrouped proposals with three-tier system");

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

        info!(
            dao_id = %dao.id,
            "Processing proposals"
        );

        // Get all groups once to build the set of grouped proposals
        let all_groups = proposal_group::Entity::find()
            .filter(proposal_group::Column::DaoId.eq(dao.id))
            .all(DB.get().unwrap())
            .await
            .context("Failed to fetch proposal groups")?;

        // Build set of grouped proposal IDs
        let mut grouped_proposal_ids = std::collections::HashSet::new();
        let mut deserialization_errors = 0;
        for group in &all_groups {
            match serde_json::from_value::<Vec<ProposalGroupItem>>(group.items.clone()) {
                Ok(items) => {
                    for item in items {
                        if let ProposalGroupItem::Proposal(proposal_item) = item {
                            grouped_proposal_ids.insert(proposal_item.external_id.clone());
                        }
                    }
                }
                Err(e) => {
                    warn!(
                        group_id = %group.id,
                        error = %e,
                        "Failed to deserialize group items"
                    );
                    deserialization_errors += 1;
                }
            }
        }

        if deserialization_errors > 0 {
            warn!(
                count = deserialization_errors,
                total_groups = all_groups.len(),
                "Some groups failed to deserialize"
            );
        }

        info!(
            dao_id = %dao.id,
            total_groups = all_groups.len(),
            grouped_proposals_count = grouped_proposal_ids.len(),
            "Built grouped proposal IDs set"
        );

        // Get all proposals (no pagination)
        let mut proposals = proposal::Entity::find()
            .filter(proposal::Column::DaoId.eq(dao.id))
            .filter(proposal::Column::MarkedSpam.eq(false))
            .order_by_asc(proposal::Column::Id)
            .all(DB.get().unwrap())
            .await
            .context("Failed to fetch proposals")?;

        // Sort proposals to prioritize Discourse URLs (with /t/) first, then other URLs, then no URLs
        proposals.sort_by(|a, b| {
            let a_has_discourse = a
                .discussion_url
                .as_ref()
                .map(|url| url.contains("/t/"))
                .unwrap_or(false);
            let b_has_discourse = b
                .discussion_url
                .as_ref()
                .map(|url| url.contains("/t/"))
                .unwrap_or(false);

            // First compare by Discourse URL presence
            match (a_has_discourse, b_has_discourse) {
                (true, false) => std::cmp::Ordering::Less, // a comes first
                (false, true) => std::cmp::Ordering::Greater, // b comes first
                _ => {
                    // Both have or both don't have Discourse URLs, compare by URL length
                    let a_len = a.discussion_url.as_ref().map(|s| s.len()).unwrap_or(0);
                    let b_len = b.discussion_url.as_ref().map(|s| s.len()).unwrap_or(0);
                    b_len.cmp(&a_len) // Descending order (longer URLs first)
                }
            }
        });

        let discourse_url_count = proposals
            .iter()
            .filter(|p| {
                p.discussion_url
                    .as_ref()
                    .map(|url| url.contains("/t/"))
                    .unwrap_or(false)
            })
            .count();

        info!(
            total_proposals = proposals.len(),
            proposals_with_discourse_urls = discourse_url_count,
            proposals_with_other_urls = proposals
                .iter()
                .filter(|p| p.discussion_url.is_some()
                    && !p.discussion_url.as_ref().unwrap().contains("/t/"))
                .count(),
            proposals_without_urls = proposals
                .iter()
                .filter(
                    |p| p.discussion_url.is_none() || p.discussion_url.as_ref().unwrap().is_empty()
                )
                .count(),
            "Processing all proposals"
        );

        // Load only recent groups for semantic matching (not all groups)
        let groups = proposal_group::Entity::find()
            .filter(proposal_group::Column::DaoId.eq(dao.id))
            .order_by_desc(proposal_group::Column::CreatedAt)
            .limit(MAX_GROUPS_IN_MEMORY)
            .all(DB.get().unwrap())
            .await
            .context("Failed to fetch recent proposal groups for matching")?;

        // Process ungrouped proposals
        let mut skipped_count = 0;
        let mut processed_count = 0;
        let mut url_matched_count = 0;
        let mut semantic_matched_count = 0;
        let mut new_groups_count = 0;

        for proposal in proposals {
            if grouped_proposal_ids.contains(&proposal.external_id) {
                skipped_count += 1;
                continue; // Already grouped
            }

            processed_count += 1;

            info!(
                proposal_id = %proposal.id,
                external_id = %proposal.external_id,
                name = %proposal.name,
                "Processing ungrouped proposal"
            );

            // Tier 1: Try URL-based matching first
            let mut matched = false;
            if let Some(ref discussion_url) = proposal.discussion_url {
                if let Some(dao_discourse) = &dao_discourse {
                    matched =
                        try_url_based_matching(&proposal, discussion_url, dao_discourse).await?;
                    if matched {
                        url_matched_count += 1;
                    }
                }
            }

            // Tier 2: Try semantic similarity matching
            if !matched && proposal.name.len() >= 10 {
                matched = try_semantic_matching(&proposal, &groups, &dao).await?;
                if matched {
                    semantic_matched_count += 1;
                }
            }

            // Tier 3: Create new group
            if !matched {
                create_new_group_from_proposal(&proposal, &dao).await?;
                new_groups_count += 1;
            }
        }

        info!(
            dao_id = %dao.id,
            skipped_already_grouped = skipped_count,
            processed_ungrouped = processed_count,
            url_matched = url_matched_count,
            semantic_matched = semantic_matched_count,
            new_groups_created = new_groups_count,
            total_proposals = skipped_count + processed_count,
            "Finished processing proposals for DAO"
        );
    }

    Ok(())
}

async fn try_url_based_matching(
    proposal: &proposal::Model,
    discussion_url: &str,
    dao_discourse: &dao_discourse::Model,
) -> Result<bool> {
    info!(
        proposal_id = %proposal.id,
        discussion_url = %discussion_url,
        "Attempting URL-based matching"
    );

    // Extract topic ID or slug from discussion URL
    let (topic_id, topic_slug) = extract_discourse_id_or_slug(discussion_url);
    
    info!(
        proposal_id = %proposal.id,
        extracted_topic_id = ?topic_id,
        extracted_topic_slug = ?topic_slug,
        "Extracted topic info from URL"
    );

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
    } else if let Some(ref topic_slug) = topic_slug {
        // For slug-only matching, get the most recent topic with this slug
        // (in case there are duplicates, though there shouldn't be)
        discourse_topic::Entity::find()
            .filter(
                discourse_topic::Column::Slug
                    .eq(topic_slug.clone())
                    .and(discourse_topic::Column::DaoDiscourseId.eq(dao_discourse.id)),
            )
            .order_by_desc(discourse_topic::Column::CreatedAt)
            .one(DB.get().unwrap())
            .await
            .context("Failed to find discourse topic by slug")?
    } else {
        warn!(
            proposal_id = %proposal.id,
            discussion_url = %discussion_url,
            "Could not extract topic ID or slug from URL"
        );
        None
    };

    if let Some(topic) = discourse_topic {
        info!(
            proposal_id = %proposal.id,
            topic_id = %topic.id,
            topic_external_id = %topic.external_id,
            topic_slug = %topic.slug,
            "Found discourse topic for URL"
        );
        
        // Find the proposal group containing this topic by searching all groups
        // (not just the recent ones passed in)
        let all_groups = proposal_group::Entity::find()
            .filter(proposal_group::Column::DaoId.eq(proposal.dao_id))
            .all(DB.get().unwrap())
            .await
            .context("Failed to fetch all proposal groups for URL matching")?;

        for group in all_groups {
            if let Ok(items) = serde_json::from_value::<Vec<ProposalGroupItem>>(group.items.clone())
            {
                for item in &items {
                    if let ProposalGroupItem::Topic(topic_item) = item {
                        if topic_item.external_id == topic.external_id.to_string()
                            && topic_item.dao_discourse_id == topic.dao_discourse_id
                        {
                            // Add proposal to this group
                            info!(
                                proposal_id = %proposal.id,
                                group_id = %group.id,
                                "Adding proposal to existing group via URL matching"
                            );

                            let mut updated_items = items.clone();
                            updated_items.push(ProposalGroupItem::Proposal(ProposalItem {
                                name: proposal.name.clone(),
                                governor_id: proposal.governor_id,
                                external_id: proposal.external_id.clone(),
                            }));

                            let mut group_active: proposal_group::ActiveModel =
                                group.clone().into();
                            group_active.items = Set(serde_json::to_value(updated_items)
                                .context("Failed to serialize proposal group items")?);

                            proposal_group::Entity::update(group_active)
                                .exec(DB.get().unwrap())
                                .await
                                .context("Failed to update proposal group")?;

                            info!(
                                proposal_id = %proposal.id,
                                "Successfully added proposal to group via URL matching"
                            );
                            return Ok(true);
                        }
                    }
                }
            }
        }
    } else {
        info!(
            proposal_id = %proposal.id,
            discussion_url = %discussion_url,
            topic_id = ?topic_id,
            topic_slug = ?topic_slug,
            "No discourse topic found for URL"
        );
    }

    Ok(false)
}

async fn try_semantic_matching(
    proposal: &proposal::Model,
    groups: &[proposal_group::Model],
    dao: &dao::Model,
) -> Result<bool> {
    let embeddings = EMBEDDINGS.get().context("Embeddings not initialized")?;

    info!(
        proposal_id = %proposal.id,
        "Attempting semantic similarity matching with enhanced scoring"
    );

    // For each group, get ALL items and test against each one
    let mut best_match: Option<(String, crate::redis_embeddings::SimilarityScore)> = None;

    for group in groups {
        if let Ok(items) = serde_json::from_value::<Vec<ProposalGroupItem>>(group.items.clone()) {
            // Prepare candidates from ALL items in this group
            let mut group_candidates = Vec::new();

            for item in &items {
                match item {
                    ProposalGroupItem::Topic(topic_item) => {
                        // Get the discourse topic content
                        if let Some(dao_discourse) = dao_discourse::Entity::find()
                            .filter(dao_discourse::Column::DaoId.eq(dao.id))
                            .one(DB.get().unwrap())
                            .await?
                        {
                            if let Some(topic) = discourse_topic::Entity::find()
                                .filter(
                                    discourse_topic::Column::ExternalId
                                        .eq(topic_item.external_id.parse::<i32>().unwrap_or(0)),
                                )
                                .filter(
                                    discourse_topic::Column::DaoDiscourseId.eq(dao_discourse.id),
                                )
                                .one(DB.get().unwrap())
                                .await?
                            {
                                // Get the first post for body content
                                let body = if let Some(first_post) = discourse_post::Entity::find()
                                    .filter(discourse_post::Column::TopicId.eq(topic.external_id))
                                    .filter(discourse_post::Column::PostNumber.eq(1))
                                    .filter(
                                        discourse_post::Column::DaoDiscourseId.eq(dao_discourse.id),
                                    )
                                    .one(DB.get().unwrap())
                                    .await?
                                {
                                    first_post.cooked
                                } else {
                                    None
                                };

                                group_candidates.push((
                                    format!("{}_topic_{}", group.id, topic_item.external_id),
                                    topic.title.clone(),
                                    body,
                                ));
                            }
                        }
                    }
                    ProposalGroupItem::Proposal(proposal_item) => {
                        // Get the proposal content
                        if let Some(group_proposal) = proposal::Entity::find()
                            .filter(proposal::Column::ExternalId.eq(&proposal_item.external_id))
                            .filter(proposal::Column::GovernorId.eq(proposal_item.governor_id))
                            .one(DB.get().unwrap())
                            .await?
                        {
                            group_candidates.push((
                                format!("{}_proposal_{}", group.id, proposal_item.external_id),
                                group_proposal.name.clone(),
                                Some(group_proposal.body.clone()),
                            ));
                        }
                    }
                }
            }

            // Test against all candidates in this group
            if !group_candidates.is_empty() {
                if let Some((item_id, score)) = embeddings
                    .find_most_similar_enhanced(
                        &proposal.name,
                        Some(&proposal.body),
                        group_candidates,
                    )
                    .await?
                {
                    // Check if this is the best match so far
                    if best_match.is_none()
                        || best_match.as_ref().unwrap().1.combined_score < score.combined_score
                    {
                        info!(
                            proposal_id = %proposal.id,
                            group_id = %group.id,
                            matched_item_id = %item_id,
                            score = score.combined_score,
                            items_in_group = items.len(),
                            "Found better match in group"
                        );
                        best_match = Some((group.id.to_string(), score));
                    }
                }
            }
        }
    }

    // If we found a good match, add the proposal to that group
    if let Some((group_id, score)) = best_match {
        info!(
            proposal_id = %proposal.id,
            group_id = %group_id,
            combined_score = score.combined_score,
            title_similarity = score.title_similarity,
            body_similarity = ?score.body_similarity,
            "Found similar group via enhanced semantic matching"
        );

        // Find the group and add the proposal
        let group_uuid = Uuid::parse_str(&group_id)?;
        if let Some(group) = groups.iter().find(|g| g.id == group_uuid) {
            if let Ok(mut items) =
                serde_json::from_value::<Vec<ProposalGroupItem>>(group.items.clone())
            {
                items.push(ProposalGroupItem::Proposal(ProposalItem {
                    name: proposal.name.clone(),
                    governor_id: proposal.governor_id,
                    external_id: proposal.external_id.clone(),
                }));

                let mut group_active: proposal_group::ActiveModel = group.clone().into();
                group_active.items = Set(serde_json::to_value(items)
                    .context("Failed to serialize proposal group items")?);

                proposal_group::Entity::update(group_active)
                    .exec(DB.get().unwrap())
                    .await
                    .context("Failed to update proposal group")?;

                info!(
                    proposal_id = %proposal.id,
                    "Successfully added proposal to group via semantic matching"
                );
                return Ok(true);
            }
        }
    }

    Ok(false)
}

async fn create_new_group_from_proposal(
    proposal: &proposal::Model,
    dao: &dao::Model,
) -> Result<()> {
    info!(
        proposal_id = %proposal.id,
        "Creating new group from proposal (no matching group found)"
    );

    let new_group = proposal_group::ActiveModel {
        id: NotSet,
        dao_id: Set(dao.id),
        name: Set(proposal.name.clone()),
        items: Set(
            serde_json::to_value(vec![ProposalGroupItem::Proposal(ProposalItem {
                name: proposal.name.clone(),
                governor_id: proposal.governor_id,
                external_id: proposal.external_id.clone(),
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
        proposal_id = %proposal.id,
        "Created new proposal group from ungrouped proposal"
    );

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
