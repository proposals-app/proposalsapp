use anyhow::{Context, Result};
use chrono::{DateTime, TimeZone, Utc};
use proposalsapp_db::models::*;
use sea_orm::{
    ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set, prelude::*,
    sea_query,
};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
// use tiktoken_rs::{CoreBPE, cl100k_base};
use tracing::{error, info, warn};
use utils::types::{ProposalGroupItem, ProposalItem, TopicItem};
use uuid::Uuid;

const BODY_PREVIEW_MAX_TOKENS: usize = 3000;

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

// Public function to run from main.rs
pub async fn run_grouper_task() -> Result<()> {
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

    if filtered_daos.is_empty() {
        info!("No DAOs to process, skipping grouper initialization");
        return Ok(());
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
    for (idx, dao) in filtered_daos.into_iter().enumerate() {
        info!(
            "Processing DAO {}/{}: {} ({}) with slug: {}",
            idx + 1,
            total_daos,
            dao.name,
            dao.id,
            dao.slug
        );
        match grouper.run_grouping_for_dao(dao.id).await {
            Ok(_) => info!(
                "Successfully completed grouping for DAO {}/{}: {}",
                idx + 1,
                total_daos,
                dao.name
            ),
            Err(e) => error!(
                "Failed to run grouping for DAO {}/{} ({}): {}",
                idx + 1,
                total_daos,
                dao.name,
                e
            ),
        }
    }

    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalizedItem {
    pub dao_id: String,
    pub id: String, // Composite: "proposal_{external_id}" or "topic_{external_id}"
    pub title: String,
    pub body: String,
    pub created_at: DateTime<Utc>,
    pub item_type: ItemType,
    pub keywords: Vec<String>,
    pub raw_data: ProposalGroupItem, // Original ProposalItem or TopicItem
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ItemType {
    Proposal,
    Topic,
}

pub struct Grouper {
    db: DatabaseConnection,
    // llm_client: LlmClient,
}

impl Grouper {
    pub async fn new(db: DatabaseConnection) -> Result<Self> {
        // // Initialize LLM client with proper error handling
        // info!("Initializing LLM client for grouper");

        // // Use Hugging Face URL to download the model automatically
        // // This is Llama 3.1 8B Instruct with Q4_K_M quantization (~4.9GB)
        // let model_url = "https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/blob/main/Meta-Llama-3.1-8B-Instruct-Q8_0.gguf";

        // info!("Downloading/using LLM model from: {}", model_url);

        // let mut builder = LlmClient::llama_cpp();
        // builder.hf_quant_file_url(model_url);

        // let llm_client = builder
        //     .logging_enabled(false) // Disable llm_devices logging to prevent it from replacing our JSON logger
        //     .init()
        //     .await
        //     .context("Failed to initialize LLM client - make sure llama.cpp server can start and model can be downloaded")?;

        // // Log device configuration
        // if let Ok(llama_backend) = llm_client.backend.llama_cpp() {
        //     let gpu_count = llama_backend.server.device_config.gpu_count();
        //     info!(
        //         "LLM client initialized successfully with {} GPU(s)",
        //         gpu_count
        //     );
        // } else {
        //     info!("LLM client initialized successfully");
        // }

        info!("Initializing grouper (LLM functionality disabled)");
        Ok(Self { db })
    }

    // Helper function to safely truncate text with character-based counting
    // Simplified version without LLM token counting dependencies
    fn truncate_text(text: &str, max_tokens: usize) -> String {
        if text.is_empty() {
            return String::new();
        }

        // Rough estimate: 1 token ≈ 4 chars, so convert token limit to char limit.
        let char_limit = max_tokens.saturating_mul(4);

        let mut byte_index = text.len();
        let mut char_count = 0;

        for (idx, _) in text.char_indices() {
            if char_count >= char_limit {
                byte_index = idx;
                break;
            }
            char_count += 1;
        }

        if byte_index == text.len() {
            return text.to_string();
        }

        // Simple truncation with ellipsis using character-safe boundary.
        format!("{}...", &text[..byte_index])
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

    // Load discourse topics for a DAO with category filtering
    async fn load_topics(&self, dao_id: Uuid) -> Result<Vec<discourse_topic::Model>> {
        // Get DAO info first
        let dao = dao::Entity::find_by_id(dao_id)
            .one(&self.db)
            .await
            .context("Failed to load DAO")?
            .ok_or_else(|| anyhow::anyhow!("DAO not found"))?;

        // Get DAO discourse info
        let dao_discourse = dao_discourse::Entity::find()
            .filter(dao_discourse::Column::DaoId.eq(dao_id))
            .one(&self.db)
            .await
            .context("Failed to load DAO discourse")?
            .ok_or_else(|| anyhow::anyhow!("No discourse configured for DAO"))?;

        // Get category filters based on DAO slug
        let category_filter = DAO_DISCOURSE_CATEGORY_FILTERS
            .get(dao.slug.as_str())
            .cloned()
            .unwrap_or_else(|| {
                warn!("No category filter configured for DAO: {}", dao.slug);
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

    // Normalize a proposal into our common format
    async fn normalize_proposal(&self, proposal: proposal::Model) -> Result<NormalizedItem> {
        let external_id = proposal.external_id.clone();
        let id = format!("proposal_{external_id}");

        let raw_data = ProposalGroupItem::Proposal(ProposalItem {
            name: proposal.name.clone(),
            external_id: external_id.clone(),
            governor_id: proposal.governor_id,
        });

        let body = proposal.body.clone();

        Ok(NormalizedItem {
            id,
            dao_id: proposal.dao_id.to_string(),
            title: proposal.name,
            body,
            created_at: Utc.from_utc_datetime(&proposal.created_at),
            item_type: ItemType::Proposal,
            keywords: vec![], // Will be filled by extract_keywords
            raw_data,
        })
    }

    // Normalize a discourse topic into our common format
    async fn normalize_topic(
        &self,
        topic: discourse_topic::Model,
        dao_id: Uuid,
    ) -> Result<NormalizedItem> {
        let external_id = topic.external_id.to_string();
        let id = format!("topic_{external_id}");

        // Get the first post content
        let first_post = discourse_post::Entity::find()
            .filter(discourse_post::Column::TopicId.eq(topic.external_id))
            .filter(discourse_post::Column::PostNumber.eq(1))
            .one(&self.db)
            .await
            .context("Failed to load first post")?;

        let full_body = first_post
            .and_then(|p| p.cooked)
            .unwrap_or_else(|| String::from("No content available"));

        let body_preview = Self::truncate_text(&full_body, BODY_PREVIEW_MAX_TOKENS);

        let raw_data = ProposalGroupItem::Topic(TopicItem {
            name: topic.title.clone(),
            external_id: external_id.clone(),
            dao_discourse_id: topic.dao_discourse_id,
        });

        Ok(NormalizedItem {
            id,
            dao_id: dao_id.to_string(),
            title: topic.title,
            body: body_preview,
            created_at: Utc.from_utc_datetime(&topic.created_at),
            item_type: ItemType::Topic,
            keywords: vec![], // Will be filled by extract_keywords
            raw_data,
        })
    }

    // Persist grouping results
    async fn persist_results(
        &self,
        groups: &HashMap<Uuid, Vec<NormalizedItem>>,
        dao_id: Uuid,
    ) -> Result<()> {
        // Get existing group IDs
        let existing_group_ids: HashSet<Uuid> = proposal_group::Entity::find()
            .filter(proposal_group::Column::DaoId.eq(dao_id))
            .all(&self.db)
            .await?
            .into_iter()
            .map(|g| g.id)
            .collect();

        for (group_id, items) in groups.iter() {
            if items.is_empty() {
                continue;
            }

            // Convert to ProposalGroupItem format
            let proposal_items: Vec<ProposalGroupItem> =
                items.iter().map(|item| item.raw_data.clone()).collect();

            let items_json = serde_json::to_value(&proposal_items)?;
            let group_name = items[0].title.to_string();

            if existing_group_ids.contains(group_id) {
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
            }
        }

        Ok(())
    }

    // Procedural grouping step: match proposals with discourse topics based on discussion URLs
    async fn procedural_grouping_pass(
        &self,
        proposals: &[proposal::Model],
        topics: &[discourse_topic::Model],
        all_items: &[NormalizedItem],
        groups: &mut HashMap<Uuid, Vec<NormalizedItem>>,
        grouped_item_ids: &mut HashSet<String>,
        dao_id: Uuid,
    ) -> Result<()> {
        info!(
            "Starting procedural grouping pass for {} proposals and {} topics",
            proposals.len(),
            topics.len()
        );

        // Build a map of topic external_id -> topic for fast lookup
        let topic_by_id: HashMap<i32, &discourse_topic::Model> =
            topics.iter().map(|t| (t.external_id, t)).collect();

        // Build a map of topic slug -> topic for slug-based matching
        let topic_by_slug: HashMap<String, &discourse_topic::Model> =
            topics.iter().map(|t| (t.slug.clone(), t)).collect();

        let mut matched_count = 0;
        let mut proposals_with_urls = 0;

        for proposal in proposals {
            // Skip if already grouped
            let proposal_item_id = format!("proposal_{}", proposal.external_id);
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

                    // Find the normalized items
                    let proposal_item = all_items.iter().find(|item| {
                        matches!(&item.raw_data, ProposalGroupItem::Proposal(p) if p.external_id == proposal.external_id)
                    });

                    let topic_item = all_items.iter().find(|item| {
                        matches!(&item.raw_data, ProposalGroupItem::Topic(t) if t.external_id == topic.external_id.to_string())
                    });

                    if let Some(prop_item) = proposal_item {
                        // Check if topic is already in a group
                        if grouped_item_ids.contains(&topic_item_id) {
                            // Find which group contains the topic
                            let existing_group = groups.iter_mut().find(|(_, items)| {
                                items.iter().any(|item| {
                                    matches!(&item.raw_data, ProposalGroupItem::Topic(t) if t.external_id == topic.external_id.to_string())
                                })
                            });

                            if let Some((_group_id, group_items)) = existing_group {
                                // Add proposal to existing group
                                group_items.push(prop_item.clone());
                                grouped_item_ids.insert(proposal_item_id.clone());

                                matched_count += 1;
                                info!(
                                    dao_id = %dao_id,
                                    action = "PROCEDURAL_ADD_TO_GROUP",
                                    proposal_id = %proposal_item_id,
                                    proposal_title = %proposal.name,
                                    topic_id = %topic_item_id,
                                    topic_title = %topic.title,
                                    discussion_url = %discussion_url,
                                    "Added proposal to existing group via discussion URL"
                                );
                            }
                        } else if let Some(topic_item) = topic_item {
                            // Create a new group with both items
                            let new_group_id = Uuid::new_v4();
                            groups
                                .insert(new_group_id, vec![prop_item.clone(), topic_item.clone()]);

                            // Mark both as grouped
                            grouped_item_ids.insert(proposal_item_id.clone());
                            grouped_item_ids.insert(topic_item_id.clone());

                            matched_count += 1;
                            info!(
                                dao_id = %dao_id,
                                action = "PROCEDURAL_CREATE_GROUP",
                                proposal_id = %proposal_item_id,
                                proposal_title = %proposal.name,
                                topic_id = %topic_item_id,
                                topic_title = %topic.title,
                                discussion_url = %discussion_url,
                                new_group_id = %new_group_id,
                                "Created new group from proposal and topic via discussion URL"
                            );
                        }
                    }
                }
            }
        }

        info!(
            "Procedural grouping completed: {} matches found from {} proposals with discussion URLs",
            matched_count, proposals_with_urls
        );
        Ok(())
    }

    // Main entry point
    pub async fn run_grouping_for_dao(&self, dao_id: Uuid) -> Result<()> {
        info!("Starting grouping for DAO {}", dao_id);

        // Load all data
        info!("Loading data from database for DAO {}", dao_id);
        let proposals = self.load_proposals(dao_id).await?;
        let topics = self.load_topics(dao_id).await?;
        let existing_groups = self.load_groups(dao_id).await?;

        let total_items = proposals.len() + topics.len();
        info!(
            "Loaded {} proposals, {} topics ({} total items), {} existing groups",
            proposals.len(),
            topics.len(),
            total_items,
            existing_groups.len()
        );

        // Normalize items (without keywords for now)
        let mut all_items = Vec::new();
        info!("Normalizing {} items...", total_items);

        for (idx, proposal) in proposals.iter().enumerate() {
            info!("Normalized {}/{} proposals", idx, proposals.len());
            let normalized = self.normalize_proposal(proposal.clone()).await?;
            all_items.push(normalized);
        }

        for (idx, topic) in topics.iter().enumerate() {
            info!("Normalized {}/{} topics", idx, topics.len());
            match self.normalize_topic(topic.clone(), dao_id).await {
                Ok(normalized) => {
                    all_items.push(normalized);
                }
                Err(e) => {
                    warn!("Failed to normalize topic: {}", e);
                    continue;
                }
            }
        }

        // Sort by created_at
        all_items.sort_by_key(|item| item.created_at);

        // Step 1: Get all ungrouped items and extract all grouped items from existing groups
        let mut groups: HashMap<Uuid, Vec<NormalizedItem>> = HashMap::new();
        let mut grouped_item_ids = HashSet::new();

        // Load existing groups
        for group in existing_groups {
            let items: Vec<ProposalGroupItem> = serde_json::from_value(group.items.clone())
                .context("Failed to deserialize group items")?;

            let mut group_items = Vec::new();

            for item in &items {
                // Track IDs to filter ungrouped items later
                match item {
                    ProposalGroupItem::Proposal(p) => {
                        grouped_item_ids.insert(format!("proposal_{}", p.external_id));
                    }
                    ProposalGroupItem::Topic(t) => {
                        grouped_item_ids.insert(format!("topic_{}", t.external_id));
                    }
                }

                // Find the normalized version of this item
                match item {
                    ProposalGroupItem::Proposal(p) => {
                        if let Some(full_item) = all_items.iter().find(|ai| {
                            matches!(&ai.raw_data, ProposalGroupItem::Proposal(pi) if pi.external_id == p.external_id)
                        }) {
                            group_items.push(full_item.clone());
                        }
                    }
                    ProposalGroupItem::Topic(t) => {
                        if let Some(full_item) = all_items.iter().find(|ai| {
                            matches!(&ai.raw_data, ProposalGroupItem::Topic(ti) if ti.external_id == t.external_id)
                        }) {
                            group_items.push(full_item.clone());
                        }
                    }
                }
            }

            groups.insert(group.id, group_items);
        }

        // Step 2: Run procedural grouping FIRST (before AI grouping)
        self.procedural_grouping_pass(
            &proposals,
            &topics,
            &all_items,
            &mut groups,
            &mut grouped_item_ids,
            dao_id,
        )
        .await?;

        // Persist groups after procedural grouping
        info!(
            "Persisting {} groups after procedural grouping",
            groups.len()
        );
        self.persist_results(&groups, dao_id).await?;

        // // Extract keywords for all items after procedural grouping
        // let total_items = all_items.len();
        // info!("Extracting keywords for {} items", total_items);
        // for (idx, item) in all_items.iter_mut().enumerate() {
        //     if idx.is_multiple_of(10) {
        //         info!(
        //             "Extracting keywords: {}/{} items processed",
        //             idx, total_items
        //         );
        //     }
        //     item.keywords = self.extract_keywords(item).await?;
        // }
        // info!("Keyword extraction complete for all {} items", total_items);

        // Get ungrouped items (after procedural grouping)
        let ungrouped_items: Vec<_> = all_items
            .into_iter()
            .filter(|item| !grouped_item_ids.contains(&item.id))
            .collect();

        info!(
            "After procedural grouping: {} ungrouped items remaining for AI grouping",
            ungrouped_items.len()
        );

        // // Step 3-5: Run the AI-based grouping algorithm on remaining ungrouped items
        // let final_groups = self
        //     .ai_grouping_pass(ungrouped_items, groups, dao_id)
        //     .await?;

        // No need to persist again here since we persist after each item in ai_grouping_pass

        // // Calculate final statistics
        // let total_groups = final_groups.len();
        // let single_item_groups = final_groups
        //     .values()
        //     .filter(|items| items.len() == 1)
        //     .count();
        // let multi_item_groups = final_groups
        //     .values()
        //     .filter(|items| items.len() > 1)
        //     .count();
        // let largest_group_size = final_groups
        //     .values()
        //     .map(|items| items.len())
        //     .max()
        //     .unwrap_or(0);
        // let avg_group_size = if total_groups > 0 {
        //     final_groups
        //         .values()
        //         .map(|items| items.len())
        //         .sum::<usize>() as f64
        //         / total_groups as f64
        // } else {
        //     0.0
        // };

        // let procedural_matches_count = final_groups
        //     .values()
        //     .filter(|items| {
        //         items.len() > 1
        //             && items
        //                 .iter()
        //                 .any(|item| matches!(&item.raw_data, ProposalGroupItem::Proposal(_)))
        //             && items
        //                 .iter()
        //                 .any(|item| matches!(&item.raw_data, ProposalGroupItem::Topic(_)))
        //     })
        //     .count();

        // info!(
        //     dao_id = %dao_id,
        //     total_items = total_items,
        //     total_groups = total_groups,
        //     single_item_groups = single_item_groups,
        //     multi_item_groups = multi_item_groups,
        //     largest_group_size = largest_group_size,
        //     avg_group_size = format!("{:.2}", avg_group_size),
        //     procedural_matches = procedural_matches_count,
        //     ai_matches = multi_item_groups - procedural_matches_count,
        //     proposals_processed = proposals.len(),
        //     topics_processed = topics.len(),
        //     "Grouping complete - detailed statistics"
        // );
        Ok(())
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

    #[test]
    fn test_truncate_text_with_unicode() {
        // Test with non-breaking space (the character that caused the panic)
        let text_with_nbsp = "Hello\u{a0}world this is a test with non-breaking space";
        // Using ~3 tokens (roughly 10 chars at ~3.3 chars/token)
        let truncated = Grouper::truncate_text(text_with_nbsp, 3);
        assert!(truncated.ends_with("..."));
        assert!(truncated.len() <= text_with_nbsp.len());

        // Test with emoji
        let text_with_emoji = "Hello 🧑‍🔬 scientist emoji test";
        // Using ~3 tokens (roughly 10 chars)
        let truncated = Grouper::truncate_text(text_with_emoji, 3);
        assert!(truncated.ends_with("..."));

        // Test with mixed Unicode characters
        let mixed_unicode = "English русский 中文 العربية mixed text";
        // Using ~6 tokens (roughly 20 chars)
        let truncated = Grouper::truncate_text(mixed_unicode, 6);
        assert!(truncated.ends_with("..."));

        // Test with exact boundary - the problematic case from the error
        let problematic_text = "# Deploy Uniswap v3 on Gnosis Chain\nContext\n-------\n\nAfter passing the\u{a0}[Temperature Check vote](https://snapshot.org/#/uniswap/proposal/0xb328c7583c0f1ea85f8a273dd36977c95e47c3713744caf7143e68b65efcc8a5)\u{a0}with 7M UNI voting in favor of deploying Uniswap v";
        // This should not panic
        // Using ~50 tokens (roughly 200 chars at ~4 chars/token)
        let truncated = Grouper::truncate_text(problematic_text, 50);
        assert!(!truncated.is_empty());

        // Test middle truncation with unicode
        let long_unicode = format!(
            "Start текст с unicode символами {}end часть с unicode",
            "middle part ".repeat(50)
        );
        // Using ~25 tokens (roughly 100 chars at ~4 chars/token)
        let truncated = Grouper::truncate_text(&long_unicode, 25);
        assert!(truncated.ends_with("..."));
        assert!(truncated.len() < long_unicode.len());
    }

    #[test]
    fn test_truncate_text_curly_quote_boundary() {
        // Craft a string where the truncation limit would fall in the middle of a multi-byte char
        let text = format!("{}”{}", "a".repeat(15), " trailing content");
        // 4 tokens -> ~16 char budget; ensures the quote sits at the boundary
        let truncated = Grouper::truncate_text(&text, 4);
        assert!(truncated.ends_with("..."));
        assert!(truncated.len() < text.len());
    }

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
