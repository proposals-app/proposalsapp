use anyhow::{Context, Result};
use chrono::Utc;
use proposalsapp_db::models::*;
use sea_orm::{
    ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set, prelude::*,
    sea_query,
};
use std::collections::{HashMap, HashSet};
use tracing::{error, info, warn};
use utils::types::{ProposalGroupItem, ProposalItem, TopicItem};
use uuid::Uuid;

/// Result of the grouping operation, including which proposals were matched via URL
#[derive(Debug, Default)]
#[allow(dead_code)]
pub struct GroupingResult {
    /// Set of proposal item IDs that were matched via URL (format: "proposal_{external_id}")
    pub url_matched_proposal_ids: HashSet<String>,
    /// Number of groups created or updated
    pub groups_count: usize,
}

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

/// Results from all DAOs processed by the grouper
#[derive(Debug, Default)]
pub struct AllGroupingResults {
    /// Map of DAO ID to its grouping result
    pub results: HashMap<Uuid, GroupingResult>,
}

// Public function to run from main.rs
pub async fn run_grouper_task() -> Result<AllGroupingResults> {
    let db = crate::DB
        .get()
        .ok_or_else(|| anyhow::anyhow!("Database not initialized"))?;

    // Get all DAOs
    let daos = dao::Entity::find()
        .all(db)
        .await
        .context("Failed to fetch DAOs")?;

    // Filter DAOs to only process those in the category filter map
    let filtered_daos: Vec<_> = daos
        .into_iter()
        .filter(|dao| DAO_DISCOURSE_CATEGORY_FILTERS.contains_key(dao.slug.as_str()))
        .collect();

    info!(
        "Running grouper for {} DAOs (filtered from total DAOs)",
        filtered_daos.len()
    );

    let mut all_results = AllGroupingResults::default();

    if filtered_daos.is_empty() {
        info!("No DAOs to process, skipping grouper initialization");
        return Ok(all_results);
    }

    // Only initialize the grouper if we have DAOs to process
    let grouper = match Grouper::new(db.clone()).await {
        Ok(g) => g,
        Err(e) => {
            error!("Failed to initialize grouper: {}", e);
            return Err(e);
        }
    };

    let total_daos = filtered_daos.len();
    for (idx, dao) in filtered_daos.iter().enumerate() {
        info!(
            "Processing DAO {}/{}: {} ({}) with slug: {}",
            idx + 1,
            total_daos,
            dao.name,
            dao.id,
            dao.slug
        );
        match grouper.run_grouping_for_dao(dao).await {
            Ok(result) => {
                info!(
                    "Successfully completed grouping for DAO {}/{}: {} (matched {} proposals via URL)",
                    idx + 1,
                    total_daos,
                    dao.name,
                    result.url_matched_proposal_ids.len()
                );
                all_results.results.insert(dao.id, result);
            }
            Err(e) => error!(
                "Failed to run grouping for DAO {}/{} ({}): {}",
                idx + 1,
                total_daos,
                dao.name,
                e
            ),
        }
    }

    Ok(all_results)
}

pub struct Grouper {
    db: DatabaseConnection,
}

impl Grouper {
    pub async fn new(db: DatabaseConnection) -> Result<Self> {
        info!("Initializing grouper");
        Ok(Self { db })
    }

    // Load proposals for a DAO
    async fn load_proposals(&self, dao_id: Uuid) -> Result<Vec<proposal::Model>> {
        // First get all governors for this DAO
        let governors = dao_governor::Entity::find()
            .filter(dao_governor::Column::DaoId.eq(dao_id))
            .all(&self.db)
            .await
            .context("Failed to load governors")?;

        let governor_ids: Vec<Uuid> = governors.into_iter().map(|g| g.id).collect();

        if governor_ids.is_empty() {
            return Ok(vec![]);
        }

        proposal::Entity::find()
            .filter(proposal::Column::GovernorId.is_in(governor_ids))
            .order_by_asc(proposal::Column::CreatedAt)
            .all(&self.db)
            .await
            .context("Failed to load proposals")
    }

    // Load DAO discourse config
    async fn load_dao_discourse(&self, dao_id: Uuid) -> Result<Option<dao_discourse::Model>> {
        dao_discourse::Entity::find()
            .filter(dao_discourse::Column::DaoId.eq(dao_id))
            .one(&self.db)
            .await
            .context("Failed to load DAO discourse")
    }

    // Load discourse topics for a DAO with category filtering
    // Takes DAO slug and discourse config to avoid duplicate queries
    async fn load_topics(
        &self,
        dao_slug: &str,
        dao_discourse: &dao_discourse::Model,
    ) -> Result<Vec<discourse_topic::Model>> {
        // Get category filters based on DAO slug
        let category_filter = DAO_DISCOURSE_CATEGORY_FILTERS
            .get(dao_slug)
            .cloned()
            .unwrap_or_else(|| {
                warn!("No category filter configured for DAO: {}", dao_slug);
                vec![]
            });

        let mut query = discourse_topic::Entity::find()
            .filter(discourse_topic::Column::DaoDiscourseId.eq(dao_discourse.id))
            .filter(discourse_topic::Column::Closed.eq(false))
            .filter(discourse_topic::Column::Archived.eq(false))
            .filter(discourse_topic::Column::Visible.eq(true));

        if !category_filter.is_empty() {
            query = query.filter(discourse_topic::Column::CategoryId.is_in(category_filter));
        }

        query
            .order_by_asc(discourse_topic::Column::CreatedAt)
            .all(&self.db)
            .await
            .context("Failed to load discourse topics")
    }

    // Load existing groups for a DAO
    async fn load_groups(&self, dao_id: Uuid) -> Result<Vec<proposal_group::Model>> {
        proposal_group::Entity::find()
            .filter(proposal_group::Column::DaoId.eq(dao_id))
            .all(&self.db)
            .await
            .context("Failed to load existing groups")
    }

    // Persist grouping results - optimized to skip unchanged groups
    // Takes pre-loaded existing_group_ids to avoid duplicate query
    async fn persist_results_optimized(
        &self,
        groups: &HashMap<Uuid, Vec<ProposalGroupItem>>,
        original_groups: &HashMap<Uuid, serde_json::Value>,
        existing_group_ids: &HashSet<Uuid>,
        dao_id: Uuid,
    ) -> Result<()> {
        let mut updated_count = 0;
        let mut created_count = 0;
        let mut skipped_count = 0;

        for (group_id, items) in groups.iter() {
            if items.is_empty() {
                continue;
            }

            let items_json = serde_json::to_value(items)?;

            // Extract name from the first item
            let group_name = match &items[0] {
                ProposalGroupItem::Proposal(p) => p.name.clone(),
                ProposalGroupItem::Topic(t) => t.name.clone(),
            };

            if existing_group_ids.contains(group_id) {
                // Check if items actually changed before updating
                if let Some(original_items) = original_groups.get(group_id)
                    && &items_json == original_items
                {
                    skipped_count += 1;
                    continue; // Skip unchanged groups
                }

                // Update existing group
                proposal_group::Entity::update_many()
                    .filter(proposal_group::Column::Id.eq(*group_id))
                    .col_expr(
                        proposal_group::Column::Items,
                        sea_query::Expr::value(items_json),
                    )
                    .col_expr(
                        proposal_group::Column::Name,
                        sea_query::Expr::value(group_name),
                    )
                    .exec(&self.db)
                    .await?;
                updated_count += 1;
            } else {
                // Create new group
                let new_group = proposal_group::ActiveModel {
                    id: Set(*group_id),
                    name: Set(group_name),
                    items: Set(items_json),
                    created_at: Set(Utc::now().naive_utc()),
                    dao_id: Set(dao_id),
                };

                new_group.insert(&self.db).await?;
                created_count += 1;
            }
        }

        info!(
            dao_id = %dao_id,
            updated = updated_count,
            created = created_count,
            skipped = skipped_count,
            "Persist results completed"
        );

        Ok(())
    }

    // Step 1: Create groups for all ungrouped topics
    async fn create_topic_groups(
        &self,
        topics: &[discourse_topic::Model],
        groups: &mut HashMap<Uuid, Vec<ProposalGroupItem>>,
        grouped_item_ids: &mut HashSet<String>,
        dao_id: Uuid,
    ) -> Result<()> {
        info!(
            "Step 1: Creating groups for {} topics in monitored categories",
            topics.len()
        );

        let mut groups_created = 0;

        for topic in topics {
            let topic_item_id = format!("topic_{}", topic.external_id);

            // Skip if already in a group
            if grouped_item_ids.contains(&topic_item_id) {
                continue;
            }

            // Create ProposalGroupItem directly from topic
            let topic_item = ProposalGroupItem::Topic(TopicItem {
                name: topic.title.clone(),
                external_id: topic.external_id.to_string(),
                dao_discourse_id: topic.dao_discourse_id,
            });

            // Create a new group with just this topic
            let new_group_id = Uuid::new_v4();
            groups.insert(new_group_id, vec![topic_item]);
            grouped_item_ids.insert(topic_item_id.clone());
            groups_created += 1;

            info!(
                dao_id = %dao_id,
                action = "CREATE_TOPIC_GROUP",
                topic_id = %topic_item_id,
                topic_title = %topic.title,
                group_id = %new_group_id,
                "Created new group for topic"
            );
        }

        info!(
            "Step 1 completed: Created {} new groups for topics",
            groups_created
        );
        Ok(())
    }

    // Step 2: Match proposals to existing topic groups via discussion URLs
    async fn match_proposals_to_groups(
        &self,
        proposals: &[proposal::Model],
        topics: &[discourse_topic::Model],
        groups: &mut HashMap<Uuid, Vec<ProposalGroupItem>>,
        grouped_item_ids: &mut HashSet<String>,
        dao_id: Uuid,
    ) -> Result<()> {
        info!(
            "Step 2: Matching {} proposals to topic groups",
            proposals.len()
        );

        // Build a map of topic external_id -> topic for fast lookup
        let topic_by_id: HashMap<i32, &discourse_topic::Model> =
            topics.iter().map(|t| (t.external_id, t)).collect();

        // Build a map of topic slug -> topic for slug-based matching
        let topic_by_slug: HashMap<String, &discourse_topic::Model> =
            topics.iter().map(|t| (t.slug.clone(), t)).collect();

        let mut matched_count = 0;
        let mut proposals_with_urls = 0;
        let mut unmatched_count = 0;

        for proposal in proposals {
            let proposal_item_id = format!("proposal_{}", proposal.external_id);

            // Skip if already grouped
            if grouped_item_ids.contains(&proposal_item_id) {
                continue;
            }

            // Check if proposal has a discussion URL
            if let Some(discussion_url) = &proposal.discussion_url {
                if discussion_url.is_empty() {
                    continue;
                }
                proposals_with_urls += 1;

                // Extract discourse ID or slug from the URL
                let (extracted_id, extracted_slug) = extract_discourse_id_or_slug(discussion_url);

                // Try to find matching topic
                let matched_topic = if let Some(id) = extracted_id {
                    topic_by_id.get(&id).copied()
                } else if let Some(slug) = extracted_slug {
                    topic_by_slug.get(&slug).copied()
                } else {
                    None
                };

                if let Some(topic) = matched_topic {
                    let topic_item_id = format!("topic_{}", topic.external_id);

                    // Create ProposalGroupItem directly from proposal
                    let proposal_item = ProposalGroupItem::Proposal(ProposalItem {
                        name: proposal.name.clone(),
                        external_id: proposal.external_id.clone(),
                        governor_id: proposal.governor_id,
                    });

                    // Find which group contains the topic
                    let existing_group = groups.iter_mut().find(|(_, items)| {
                        items.iter().any(|item| {
                            matches!(item, ProposalGroupItem::Topic(t) if t.external_id == topic.external_id.to_string())
                        })
                    });

                    if let Some((group_id, group_items)) = existing_group {
                        // Add proposal to the topic's group
                        group_items.push(proposal_item);
                        grouped_item_ids.insert(proposal_item_id.clone());
                        matched_count += 1;

                        info!(
                            dao_id = %dao_id,
                            action = "MATCH_PROPOSAL_TO_GROUP",
                            proposal_id = %proposal_item_id,
                            proposal_title = %proposal.name,
                            topic_id = %topic_item_id,
                            topic_title = %topic.title,
                            group_id = %group_id,
                            discussion_url = %discussion_url,
                            "Added proposal to topic's group via discussion URL"
                        );
                    } else {
                        warn!(
                            dao_id = %dao_id,
                            action = "TOPIC_NOT_IN_GROUP",
                            proposal_id = %proposal_item_id,
                            topic_id = %topic_item_id,
                            "Found matching topic but it's not in any group"
                        );
                    }
                } else {
                    unmatched_count += 1;
                    info!(
                        dao_id = %dao_id,
                        action = "NO_TOPIC_MATCH",
                        proposal_id = %proposal_item_id,
                        proposal_title = %proposal.name,
                        discussion_url = %discussion_url,
                        "Proposal has discussion URL but no matching topic found"
                    );
                }
            }
        }

        info!(
            "Step 2 completed: Matched {} proposals to groups, {} unmatched (out of {} with discussion URLs)",
            matched_count, unmatched_count, proposals_with_urls
        );
        Ok(())
    }

    // Main entry point - takes DAO model to avoid duplicate queries
    pub async fn run_grouping_for_dao(&self, dao: &dao::Model) -> Result<GroupingResult> {
        let dao_id = dao.id;
        info!("Starting grouping for DAO {}", dao_id);

        // Load DAO discourse config (single query instead of inside load_topics)
        let dao_discourse = match self.load_dao_discourse(dao_id).await? {
            Some(dd) => dd,
            None => {
                info!("No discourse configured for DAO {}, skipping", dao.slug);
                return Ok(GroupingResult::default());
            }
        };

        // Load all data
        info!("Loading data from database for DAO {}", dao_id);
        let proposals = self.load_proposals(dao_id).await?;
        let topics = self.load_topics(&dao.slug, &dao_discourse).await?;
        let existing_groups = self.load_groups(dao_id).await?;

        info!(
            "Loaded {} proposals, {} topics, {} existing groups",
            proposals.len(),
            topics.len(),
            existing_groups.len()
        );

        // Load existing groups and track which items are already grouped
        // Also track original items for change detection
        let mut groups: HashMap<Uuid, Vec<ProposalGroupItem>> = HashMap::new();
        let mut original_groups: HashMap<Uuid, serde_json::Value> = HashMap::new();
        let mut grouped_item_ids = HashSet::new();
        let existing_group_ids: HashSet<Uuid> = existing_groups.iter().map(|g| g.id).collect();

        for group in existing_groups {
            let items: Vec<ProposalGroupItem> = serde_json::from_value(group.items.clone())
                .context("Failed to deserialize group items")?;

            // Track IDs of items already in groups
            for item in &items {
                match item {
                    ProposalGroupItem::Proposal(p) => {
                        grouped_item_ids.insert(format!("proposal_{}", p.external_id));
                    }
                    ProposalGroupItem::Topic(t) => {
                        grouped_item_ids.insert(format!("topic_{}", t.external_id));
                    }
                }
            }

            // Store original items JSON for change detection
            original_groups.insert(group.id, group.items.clone());
            groups.insert(group.id, items);
        }

        // Track which proposals are matched via URL (for semantic grouper to skip)
        let proposals_before_matching: HashSet<String> = grouped_item_ids
            .iter()
            .filter(|id| id.starts_with("proposal_"))
            .cloned()
            .collect();

        // Step 1: Create groups for all ungrouped topics in monitored categories
        info!("===== STEP 1: Creating topic groups =====");
        self.create_topic_groups(&topics, &mut groups, &mut grouped_item_ids, dao_id)
            .await?;

        // Step 2: Match proposals to existing topic groups via discussion URLs
        info!("===== STEP 2: Matching proposals to topic groups =====");
        self.match_proposals_to_groups(
            &proposals,
            &topics,
            &mut groups,
            &mut grouped_item_ids,
            dao_id,
        )
        .await?;

        // Persist groups once at the end (consolidated from two calls)
        // Only persist groups that have changed
        info!("Persisting {} groups (checking for changes)", groups.len());
        self.persist_results_optimized(&groups, &original_groups, &existing_group_ids, dao_id)
            .await?;

        // Calculate which proposals were matched via URL (new ones added in Step 2)
        let url_matched_proposal_ids: HashSet<String> = grouped_item_ids
            .iter()
            .filter(|id| id.starts_with("proposal_"))
            .cloned()
            .collect();

        // Calculate final statistics
        let total_groups = groups.len();
        let single_item_groups = groups.values().filter(|items| items.len() == 1).count();
        let multi_item_groups = groups.values().filter(|items| items.len() > 1).count();
        let newly_matched = url_matched_proposal_ids.len() - proposals_before_matching.len();

        info!(
            dao_id = %dao_id,
            total_groups = total_groups,
            single_item_groups = single_item_groups,
            multi_item_groups = multi_item_groups,
            url_matched_proposals = url_matched_proposal_ids.len(),
            newly_matched = newly_matched,
            "===== Grouping complete ====="
        );

        Ok(GroupingResult {
            url_matched_proposal_ids,
            groups_count: total_groups,
        })
    }
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
            let slug = Some(ToString::to_string(first_part));
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
                "Failed for URL: {url}"
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
                "Failed for URL: {url}"
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
                "Failed for URL: {url}"
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
                "Failed for URL: {url}"
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
                "Failed for URL: {url}"
            );
        }
    }
}
