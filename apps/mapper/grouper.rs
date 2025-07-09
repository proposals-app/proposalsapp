use crate::redis_cache;
use anyhow::{Context, Result};
use chrono::{DateTime, TimeZone, Utc};
use llm_client::{GgufPresetTrait, InstructPromptTrait, LlmClient};
use proposalsapp_db::models::*;
use sea_orm::{
    ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set, prelude::*,
    sea_query,
};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use tracing::{error, info, warn};
use utils::types::{ProposalGroupItem, ProposalItem, TopicItem};
use uuid::Uuid;

lazy_static::lazy_static! {
    /// Mapping of DAO slugs to the Discourse category IDs that should be included
    /// in proposal grouping. Topics in other categories will be ignored.
    static ref DAO_DISCOURSE_CATEGORY_FILTERS: HashMap<&'static str, Vec<i32>> = {
        let mut m = HashMap::new();
        // m.insert("arbitrum", vec![7, 8, 9]);
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

    for dao in filtered_daos {
        info!(
            "Processing DAO: {} ({}) with slug: {}",
            dao.name, dao.id, dao.slug
        );
        match grouper.run_grouping_for_dao(dao.id).await {
            Ok(_) => info!("Successfully completed grouping for DAO: {}", dao.name),
            Err(e) => error!("Failed to run grouping for DAO {}: {}", dao.name, e),
        }
    }

    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalizedItem {
    pub id: String, // Composite: "proposal_{external_id}" or "topic_{external_id}"
    pub title: String,
    pub body: String,
    pub created_at: DateTime<Utc>,
    pub item_type: ItemType,         // Proposal or Discussion
    pub keywords: Vec<String>,       // LLM-extracted keywords
    pub summary: Option<String>,     // LLM-generated if body exceeds context
    pub raw_data: ProposalGroupItem, // Original ProposalItem or TopicItem
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ItemType {
    Proposal,
    Discussion,
}

pub struct Grouper {
    db: DatabaseConnection,
    llm_client: LlmClient,
}

impl Grouper {
    pub async fn new(db: DatabaseConnection) -> Result<Self> {
        // Initialize LLM client with proper error handling
        info!("Initializing LLM client for grouper");

        let llm_client = LlmClient::llama_cpp()
            .llama3_2_3b_instruct()
            .init()
            .await
            .context("Failed to initialize LLM client - make sure llama.cpp server can start")?;

        info!("LLM client initialized successfully");
        Ok(Self { db, llm_client })
    }

    // Helper function to safely truncate text with middle ellipsis
    fn truncate_text(text: &str, max_chars: usize) -> String {
        const ELLIPSIS: &str = " [... TRUNCATED ...] ";
        const ELLIPSIS_LEN: usize = 21; // " [... TRUNCATED ...] " is 21 chars

        // Count actual characters, not bytes
        let char_count = text.chars().count();

        if char_count <= max_chars {
            return text.to_string();
        }

        // If max_chars is too small, just truncate at the end
        if max_chars <= ELLIPSIS_LEN + 20 {
            let mut cutoff = max_chars.saturating_sub(4).min(text.len());
            while cutoff > 0 && !text.is_char_boundary(cutoff) {
                cutoff -= 1;
            }
            return format!("{}...", &text[..cutoff]);
        }

        // Calculate how many chars to keep from start and end
        let available_chars = max_chars - ELLIPSIS_LEN;
        // Keep 70% at the start, 30% at the end for better context
        let start_chars = (available_chars * 7) / 10;
        let end_chars = available_chars - start_chars;

        // Find the byte positions for the character positions
        let mut char_indices: Vec<(usize, char)> = text.char_indices().collect();

        // Get start portion - try to break at a word boundary
        let mut start_end_idx = if start_chars < char_indices.len() {
            char_indices[start_chars].0
        } else {
            text.len()
        };

        // Look for a good break point (space or newline) near the cutoff
        if let Some((idx, _)) = char_indices
            .iter()
            .take(start_chars)
            .rev()
            .take(50) // Look back up to 50 chars
            .find(|(_, ch)| ch.is_whitespace())
        {
            start_end_idx = *idx;
        }

        // Get end portion - try to break at a word boundary
        let end_start_char_pos = char_count.saturating_sub(end_chars);
        let mut end_start_idx = if end_start_char_pos < char_indices.len() {
            char_indices[end_start_char_pos].0
        } else {
            0
        };

        // Look for a good break point after the cutoff
        if let Some((idx, _)) = char_indices
            .iter()
            .skip(end_start_char_pos)
            .take(50) // Look forward up to 50 chars
            .find(|(_, ch)| ch.is_whitespace())
        {
            end_start_idx = idx + 1; // Skip the whitespace
        }

        let start_text = &text[..start_end_idx].trim_end();
        let end_text = &text[end_start_idx..].trim_start();

        format!("{}{}{}", start_text, ELLIPSIS, end_text)
    }

    // Keyword extraction using LLM with Redis caching
    async fn extract_keywords(&self, item: &NormalizedItem) -> Result<Vec<String>> {
        // Create a cache key based on item ID and a hash of title+body
        let cache_key = format!("mapper:keywords:{}", item.id);

        // Try to get from cache first
        if let Ok(Some(cached_keywords)) = redis_cache::get_cached_keywords(&cache_key).await {
            info!("Cache hit for keywords: {}", item.id);
            return Ok(cached_keywords);
        }

        info!("Cache miss for keywords: {}, extracting with LLM", item.id);

        let mut basic_completion = self.llm_client.basic_completion();
        basic_completion
            .prompt()
            .add_system_message()
            .unwrap()
            .set_content("You are a DAO governance analyst. You specialty is tagging proposals with specific but descriptive keywords. Extract 10-15 key concepts from this governance item. Focus on: main topics of the proposal, differentiating factors, specific proposal names, technical components, action items, important entities, proposal author. Avoid too generic terms.

IMPORTANT: Return ONLY a comma-separated list of keywords. Do not include any prefixes, explanations, or formatting. Always use lowercase. Do not start with 'Keywords:' or any other text. Just the keywords separated by commas.

Example response: governance, proposal, voting, treasury, delegation");

        // Limit the body to prevent exceeding token limits
        // Reserve ~1k chars for system prompt and formatting, leaving ~14k for content
        let truncated_body = Self::truncate_text(&item.body, 12000);

        basic_completion
            .prompt()
            .add_user_message()
            .unwrap()
            .set_content(&format!("Title: {}\nBody: {}", item.title, truncated_body));

        let response = basic_completion
            .run()
            .await
            .context("Failed to extract keywords")?;

        let keywords_string = response.content;

        // Simple parsing: split by commas and clean up
        let keywords: Vec<String> = keywords_string
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty() && s.len() > 2)
            .collect();

        info!("Keywords for {}: {:?}", item.id, keywords);

        // Cache the result for 7 days (604800 seconds)
        if let Err(e) = redis_cache::cache_keywords(&cache_key, &keywords, 604800).await {
            warn!("Failed to cache keywords: {}", e);
        }

        Ok(keywords)
    }

    // Scoring function that returns a match score from 0 to 100
    async fn match_score(&self, item_a: &NormalizedItem, item_b: &NormalizedItem) -> Result<u8> {
        // Extract keywords for both items
        let keywords_a = self.extract_keywords(item_a).await?;
        let keywords_b = self.extract_keywords(item_b).await?;

        // Calculate available space for bodies
        // Total limit: 15k chars
        // Reserve space for: titles (2x200), keywords (2x500), dates (2x20), template (~400)
        // Total reserved: ~2500 chars, leaving ~12500 for bodies
        let max_body_chars_per_item = 6000; // Split evenly between two items

        let body_a = Self::truncate_text(&item_a.body, max_body_chars_per_item);
        let body_b = Self::truncate_text(&item_b.body, max_body_chars_per_item);

        // Create prompt with all relevant information
        let prompt = format!(
            r#"Item A:
Title: {}
Body: {}
Keywords: {:?}
Created: {}

Item B:
Title: {}
Body: {}
Keywords: {:?}
Created: {}

Consider if they are:
- The same proposal at different stages
- Strongly related proposals that should be tracked together
- A proposal and its implementation/review
- Separate topics despite any similarities"#,
            item_a.title,
            body_a,
            keywords_a,
            item_a.created_at.format("%Y-%m-%d"),
            item_b.title,
            body_b,
            keywords_b,
            item_b.created_at.format("%Y-%m-%d")
        );

        // Safety check to ensure we don't exceed limits
        if prompt.len() > 15000 {
            warn!(
                "Prompt length {} exceeds 15k limit, further truncation needed",
                prompt.len()
            );
        }

        // Get LLM score
        let mut score_request = self.llm_client.reason().integer();
        score_request.primitive.lower_bound(0).upper_bound(100);

        let score = score_request
            .set_instructions("You are a DAO governance analyst. You specialty is mapping together forum discussions to offchain or onchain proposals on the same topic. Rate from 0 to 100 how likely these two governance items should be grouped together. 0 means completely unrelated, 100 means definitely the same topic.")
            .set_supporting_material(&prompt)
            .return_primitive()
            .await
            .context("Failed to get match score")?;

        Ok(score as u8)
    }

    // Main grouping algorithm with scoring
    async fn simple_grouping_pass(
        &self,
        mut ungrouped_items: Vec<NormalizedItem>,
        mut groups: HashMap<Uuid, Vec<NormalizedItem>>, // group_id -> items
    ) -> Result<HashMap<Uuid, Vec<NormalizedItem>>> {
        const MATCH_THRESHOLD: u8 = 80;

        while let Some(current_item) = ungrouped_items.pop() {
            let current_item_id = current_item.id.clone();
            let current_item_title = current_item.title.clone();
            info!(
                "Processing item: {} ({})",
                current_item_title, current_item_id
            );

            let mut best_match: Option<(u8, String, bool)> = None; // (score, item_id, is_grouped)
            let mut best_group_id: Option<Uuid> = None;
            let mut best_ungrouped_idx: Option<usize> = None;

            // Get all grouped items and score them
            let grouped_items: Vec<(NormalizedItem, Uuid)> = groups
                .iter()
                .flat_map(|(group_id, items)| items.iter().map(|item| (item.clone(), *group_id)))
                .collect();

            for (grouped_item, group_id) in grouped_items {
                let score = self.match_score(&current_item, &grouped_item).await?;
                info!(
                    "Score {} for item {} vs grouped item {} in group {}",
                    score, current_item_id, grouped_item.id, group_id
                );

                if score >= MATCH_THRESHOLD {
                    if best_match.is_none() || score > best_match.as_ref().unwrap().0 {
                        best_match = Some((score, grouped_item.id.clone(), true));
                        best_group_id = Some(group_id);
                    }
                }
            }

            // Score ungrouped items
            for (idx, other_item) in ungrouped_items.iter().enumerate() {
                let score = self.match_score(&current_item, other_item).await?;
                info!(
                    "Score {} for item {} vs ungrouped item {}",
                    score, current_item_id, other_item.id
                );

                if score >= MATCH_THRESHOLD {
                    if best_match.is_none() || score > best_match.as_ref().unwrap().0 {
                        best_match = Some((score, other_item.id.clone(), false));
                        best_ungrouped_idx = Some(idx);
                    }
                }
            }

            // Process the best match if found
            match best_match {
                Some((score, matched_id, is_grouped)) => {
                    if is_grouped {
                        // Add to existing group
                        info!(
                            "Best match: Item {} matches with grouped item {} (score: {}) in group {}",
                            current_item_id,
                            matched_id,
                            score,
                            best_group_id.unwrap()
                        );
                        groups
                            .get_mut(&best_group_id.unwrap())
                            .unwrap()
                            .push(current_item);
                    } else {
                        // Create new group with both items
                        info!(
                            "Best match: Item {} matches with ungrouped item {} (score: {})",
                            current_item_id, matched_id, score
                        );
                        let matched_item = ungrouped_items.remove(best_ungrouped_idx.unwrap());
                        let new_group_id = Uuid::new_v4();
                        groups.insert(new_group_id, vec![current_item, matched_item]);
                    }
                }
                None => {
                    // No matches above threshold, create single-item group
                    info!(
                        "No matches above threshold {} for {}, creating single-item group",
                        MATCH_THRESHOLD, current_item_id
                    );
                    let new_group_id = Uuid::new_v4();
                    groups.insert(new_group_id, vec![current_item]);
                }
            }
        }

        Ok(groups)
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
        let id = format!("proposal_{}", external_id);

        let raw_data = ProposalGroupItem::Proposal(ProposalItem {
            name: proposal.name.clone(),
            external_id: external_id.clone(),
            governor_id: proposal.governor_id,
        });

        Ok(NormalizedItem {
            id,
            title: proposal.name.clone(),
            body: proposal.body.clone(),
            created_at: Utc.from_utc_datetime(&proposal.created_at),
            item_type: ItemType::Proposal,
            keywords: vec![], // Will be filled by extract_keywords
            summary: None,
            raw_data,
        })
    }

    // Normalize a discourse topic into our common format
    async fn normalize_topic(&self, topic: discourse_topic::Model) -> Result<NormalizedItem> {
        let external_id = topic.external_id.to_string();
        let id = format!("topic_{}", external_id);

        // Get the first post content
        let first_post = discourse_post::Entity::find()
            .filter(discourse_post::Column::TopicId.eq(topic.external_id))
            .filter(discourse_post::Column::PostNumber.eq(1))
            .one(&self.db)
            .await
            .context("Failed to load first post")?;

        let body = first_post
            .and_then(|p| p.cooked)
            .unwrap_or_else(|| String::from("No content available"));

        let raw_data = ProposalGroupItem::Topic(TopicItem {
            name: topic.title.clone(),
            external_id: external_id.clone(),
            dao_discourse_id: topic.dao_discourse_id,
        });

        Ok(NormalizedItem {
            id,
            title: topic.title.clone(),
            body,
            created_at: Utc.from_utc_datetime(&topic.created_at),
            item_type: ItemType::Discussion,
            keywords: vec![], // Will be filled by extract_keywords
            summary: None,
            raw_data,
        })
    }

    // Persist simplified grouping results
    async fn persist_simple_results(
        &self,
        groups: HashMap<Uuid, Vec<NormalizedItem>>,
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

        for (group_id, items) in groups {
            if items.is_empty() {
                continue;
            }

            // Convert to ProposalGroupItem format
            let proposal_items: Vec<ProposalGroupItem> =
                items.iter().map(|item| item.raw_data.clone()).collect();

            let items_json = serde_json::to_value(&proposal_items)?;
            let group_name = format!("Group: {}", items[0].title);

            if existing_group_ids.contains(&group_id) {
                // Update existing group
                proposal_group::Entity::update_many()
                    .filter(proposal_group::Column::Id.eq(group_id))
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
                    id: Set(group_id),
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

    // Main entry point
    pub async fn run_grouping_for_dao(&self, dao_id: Uuid) -> Result<()> {
        info!("Starting grouping for DAO {}", dao_id);

        // Load all data
        let proposals = self.load_proposals(dao_id).await?;
        let topics = self.load_topics(dao_id).await?;
        let existing_groups = self.load_groups(dao_id).await?;

        info!(
            "Loaded {} proposals, {} topics, {} existing groups",
            proposals.len(),
            topics.len(),
            existing_groups.len()
        );

        // Normalize items
        let mut all_items = Vec::new();

        for proposal in proposals {
            let mut normalized = self.normalize_proposal(proposal).await?;
            // Extract keywords for each item
            normalized.keywords = self.extract_keywords(&normalized).await?;
            all_items.push(normalized);
        }

        for topic in topics {
            match self.normalize_topic(topic).await {
                Ok(mut normalized) => {
                    normalized.keywords = self.extract_keywords(&normalized).await?;
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

        // Get ungrouped items
        let ungrouped_items: Vec<_> = all_items
            .into_iter()
            .filter(|item| !grouped_item_ids.contains(&item.id))
            .collect();

        info!(
            "Starting grouping with {} ungrouped items and {} existing groups",
            ungrouped_items.len(),
            groups.len()
        );

        // Step 2-5: Run the simplified grouping algorithm
        let final_groups = self.simple_grouping_pass(ungrouped_items, groups).await?;

        // Persist results
        self.persist_simple_results(final_groups, dao_id).await?;

        info!("Grouping complete for DAO {}", dao_id);
        Ok(())
    }
}
