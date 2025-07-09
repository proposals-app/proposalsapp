use crate::redis_cache;
use anyhow::{Context, Result};
use chrono::{DateTime, TimeZone, Utc};
#[cfg(target_os = "macos")]
use llm_client::MetalConfig;
use llm_client::RequestConfigTrait;
use llm_client::{InstructPromptTrait, LlmClient, LlmLocalTrait};
use llm_models::GgufLoaderTrait;
use proposalsapp_db::models::*;
use rand::Rng;
use sea_orm::{
    ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set, prelude::*,
    sea_query,
};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use tracing::{error, info, warn};
use utils::types::{ProposalGroupItem, ProposalItem, TopicItem};
use uuid::Uuid;

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

        // Use Hugging Face URL to download the model automatically
        // This is Llama 3.1 8B Instruct with Q4_K_M quantization (~4.9GB)
        let model_url = "https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/blob/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf";

        info!("Downloading/using LLM model from: {}", model_url);

        let mut builder = LlmClient::llama_cpp();
        builder.hf_quant_file_url(model_url);

        // Platform-specific configuration
        #[cfg(target_os = "macos")]
        {
            info!("Detected macOS, configuring for Metal GPU acceleration");
            // On macOS, use Metal GPU with 8GB RAM allocation
            // Metal automatically uses GPU index 0 on macOS
            let metal_config = llm_client::MetalConfig::new_from_ram_gb(8.0);
            builder = builder.metal_config(metal_config);
        }

        #[cfg(not(target_os = "macos"))]
        {
            info!("Detected non-macOS platform (likely Linux), configuring for CPU-only execution");
            // On Linux and other platforms, use CPU-only with 8GB RAM limit
            // The container has 12GB RAM, but we need to leave room for other processes
            builder = builder.cpu_only().use_ram_gb(8.0);
        }

        let llm_client = builder
            .init()
            .await
            .context("Failed to initialize LLM client - make sure llama.cpp server can start and model can be downloaded")?;

        // Log device configuration
        if let Ok(llama_backend) = llm_client.backend.llama_cpp() {
            let gpu_count = llama_backend.server.device_config.gpu_count();
            info!(
                "LLM client initialized successfully with {} GPU(s)",
                gpu_count
            );
        } else {
            info!("LLM client initialized successfully");
        }

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
        let char_indices: Vec<(usize, char)> = text.char_indices().collect();

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
        let cache_key = format!("mapper:keywords:{}-{}", item.id, item.dao_id);

        // Try to get from cache first
        if let Ok(Some(cached_keywords)) = redis_cache::get_cached_keywords(&cache_key).await {
            info!("Cache hit for keywords: {}", item.id);
            return Ok(cached_keywords);
        }

        info!("Cache miss for keywords: {}, extracting with LLM", item.id);

        // Use conversational approach with a single LLM session
        match self.extract_keywords_with_conversation(item).await {
            Ok(keywords) => {
                // Success! Cache and return
                info!("Keywords for {}: {:?}", item.id, keywords);
                let ttl = 604800 + rand::rng().random_range(302400..302400 * 3);
                if let Err(e) = redis_cache::cache_keywords(&cache_key, &keywords, ttl).await {
                    warn!("Failed to cache keywords: {}", e);
                }
                Ok(keywords)
            }
            Err(e) => {
                warn!("Failed to extract keywords for {}: {}", item.id, e);
                // Return fallback
                Ok(vec!["invalid-keyword-extraction".to_string()])
            }
        }
    }

    // Extract keywords using a conversational approach with the LLM
    async fn extract_keywords_with_conversation(
        &self,
        item: &NormalizedItem,
    ) -> Result<Vec<String>> {
        let mut basic_completion = self.llm_client.basic_completion();

        // Set reasonable token limits to prevent runaway generation
        basic_completion
            .max_tokens(200) // Keywords shouldn't need more than 200 tokens
            .temperature(0.7) // Lower temperature for more focused output
            .frequency_penalty(0.5); // Penalize repetition

        // Initial system prompt
        basic_completion
            .prompt()
            .add_system_message()
            .unwrap()
            .set_content(r#"
                You are a DAO governance analyst specializing in precise proposal tagging. Analyze this governance item and extract 10-20 specific, descriptive keywords that uniquely identify and categorize this proposal.

                Extraction Guidelines:
                - Prioritize specificity over generality (e.g., "uniswap-v3-fee-adjustment" not "protocol-update")
                - Do not, under any circumstance, make up ids (like "dao-proposal-123") which do not explicitly exist in the text
                - Include exact names, numbers, and identifiers when present
                - Capture the proposal's unique characteristics that distinguish it from others
                - Use hyphens to connect multi-word concepts (e.g., "cross-chain-bridge")

                Required Coverage Areas:
                1. IDENTIFIERS: proposal ID, voting round, specific dates
                2. PROPOSAL TYPE: funding-request, parameter-change, strategic-initiative, etc.
                3. TECHNICAL ELEMENTS: specific protocols, smart contracts, technical standards
                4. FINANCIAL DETAILS: amounts, percentages, token symbols, budget items
                5. ENTITIES: proposal author, affected protocols, partner organizations
                6. ACTIONS: specific verbs describing what will happen (e.g., "deploy", "allocate", "integrate")
                7. SCOPE: affected chains, ecosystems, or communities

                Exclusion Rules:
                - Omit generic terms unless combined with specifics (not "governance" but "governance-token-migration")
                - Skip filler words like "proposal", "discussion", "DAO" unless part of a specific name
                - Avoid abstract concepts without context

                OUTPUT FORMAT REQUIREMENTS:
                - Return ONLY a comma-separated list of keywords
                - Each keyword must be lowercase letters, numbers, and hyphens only
                - Multi-word concepts should use hyphens (e.g., cross-chain-bridge)
                - No spaces, no special characters except hyphens
                - No prefixes, explanations, numbered lists, or formatting
                - Just return the keywords separated by commas
                - Aim for 10-20 keywords
                - End your response after listing the keywords

                Example (good): compound-grant-23, defi-education-initiative, 50k-usdc-funding, alice-smith, q1-2024, developer-onboarding, polygon-deployment, compound-finance

                Example (bad): governance, proposal, voting, community, discussion, update"#);

        // Limit the body to prevent exceeding token limits
        // Reserve ~1k chars for system prompt and formatting, leaving ~14k for content
        let truncated_body = Self::truncate_text(&item.body, 12000);

        basic_completion
            .prompt()
            .add_user_message()
            .unwrap()
            .set_content(&format!("Title: {}\nBody: {}", item.title, truncated_body));

        // Try conversational approach with up to 3 rounds
        let max_rounds = 3;

        for round in 0..max_rounds {
            let response = basic_completion
                .run()
                .await
                .context("Failed to run LLM completion")?;

            // Try to parse the response
            let keywords = self.parse_keyword_response(&response.content);

            // Check if we got valid keywords
            if keywords.len() >= 5 && keywords.len() <= 25 {
                return Ok(keywords);
            }

            // If this was the last round, give up
            if round == max_rounds - 1 {
                warn!(
                    "Failed to get valid keywords after {} rounds, got {} keywords",
                    max_rounds,
                    keywords.len()
                );
                return Err(anyhow::anyhow!(
                    "Could not extract valid keywords after {} attempts",
                    max_rounds
                ));
            }

            // Add the assistant's response to the conversation
            basic_completion
                .prompt()
                .add_assistant_message()
                .unwrap()
                .set_content(&response.content);

            // Add a corrective user message based on what went wrong
            let correction = if keywords.is_empty() {
                "I need you to provide keywords. Please respond with ONLY comma-separated keywords, nothing else. For example: keyword1,keyword2,keyword3".to_string()
            } else if keywords.len() < 5 {
                format!(
                    "You only provided {} keywords. I need at least 10 keywords. Please provide more keywords as a comma-separated list.",
                    keywords.len()
                )
            } else {
                format!(
                    "You provided {} keywords which is too many. Please provide 10-20 keywords only, as a comma-separated list.",
                    keywords.len()
                )
            };

            basic_completion
                .prompt()
                .add_user_message()
                .unwrap()
                .set_content(&correction);

            info!(
                "Round {} failed with {} keywords, trying again with correction",
                round + 1,
                keywords.len()
            );
        }

        Err(anyhow::anyhow!(
            "Failed to extract keywords after {} rounds",
            max_rounds
        ))
    }

    // Parse keyword response from LLM output
    fn parse_keyword_response(&self, response: &str) -> Vec<String> {
        let cleaned = response.trim();

        // Find the actual keyword content
        let keyword_content = if let Some(idx) = cleaned.find("assistant") {
            &cleaned[idx + "assistant".len()..].trim()
        } else {
            cleaned
        };

        // Look for the line that contains keywords
        let keyword_line = if keyword_content.contains('\n') {
            keyword_content
                .lines()
                .find(|line| {
                    let trimmed = line.trim();
                    trimmed.contains(',')
                        && !trimmed.to_lowercase().contains("here")
                        && !trimmed.to_lowercase().contains("keywords")
                        && !trimmed.to_lowercase().contains("following")
                })
                .unwrap_or(keyword_content)
        } else if let Some(idx) = keyword_content.rfind(':') {
            keyword_content[idx + 1..].trim()
        } else {
            keyword_content
        };

        // Parse and validate keywords
        keyword_line
            .split(',')
            .map(|s| s.trim().trim_matches('"').trim_matches('\'').to_lowercase())
            .filter(|s| {
                !s.is_empty()
                    && s.len() >= 2
                    && s.len() <= 50
                    && s.chars()
                        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
                    && !s.contains(' ')
            })
            .take(25)
            .collect()
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
            r#"
                Item A:
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

        // Get LLM score
        let mut score_request = self.llm_client.reason().integer();
        score_request.primitive.lower_bound(0).upper_bound(100);

        let score = score_request
            .set_instructions(r#"
                You are a DAO governance analyst specializing in proposal relationship mapping. Evaluate whether these two governance items should be grouped together.

                Scoring Guidelines:
                - 90-100: Same proposal/initiative at different stages or formats
                - 70-89: Directly related items that form a coherent governance thread
                - 50-69: Related topics with significant shared context
                - 30-49: Loosely related with some common elements
                - 10-29: Minimal connection, different topics sharing minor details
                - 0-9: Completely unrelated items

                Strong Grouping Indicators (HIGH scores):
                1. SEQUENTIAL PROGRESSION: Temperature check → Formal proposal → Implementation update
                2. SAME INITIATIVE: Identical funding request, protocol change, or strategic decision across venues
                3. EXPLICIT REFERENCES: One item directly mentions or links to the other
                4. IDENTICAL KEY DETAILS: Same amounts, addresses, specific parameter values, or implementation specs
                5. AUTHOR CONTINUITY: Same proposer advancing through governance stages

                Moderate Grouping Indicators (MEDIUM scores):
                1. SHARED OBJECTIVES: Different approaches to the same problem
                2. DEPENDENCY RELATIONSHIP: One proposal depends on or complements the other
                3. TOPICAL CLUSTERING: Multiple proposals in the same domain (e.g., all security audits)
                4. TEMPORAL PROXIMITY: Related items posted within days/weeks of each other

                Weak/No Grouping Indicators (LOW scores):
                1. COMPETING PROPOSALS: Mutually exclusive alternatives
                2. DIFFERENT DOMAINS: Unrelated protocol areas or initiatives
                3. GENERIC SIMILARITIES: Only sharing common governance terms
                4. COINCIDENTAL OVERLAP: Similar words but different contexts

                Analysis Framework:
                - Compare titles for direct matches or progression patterns
                - Check if keywords overlap in meaningful ways (not just generic terms)
                - Identify specific entities, amounts, or technical details that match
                - Consider temporal relationship and logical flow
                - Look for explicit mentions or references between items

                Return a single integer from 0 to 100 based on the strength of relationship."#)
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

                if score >= MATCH_THRESHOLD && best_match.is_none()
                    || score > best_match.as_ref().unwrap().0
                {
                    best_match = Some((score, grouped_item.id.clone(), true));
                    best_group_id = Some(group_id);
                }
            }

            // Score ungrouped items
            for (idx, other_item) in ungrouped_items.iter().enumerate() {
                let score = self.match_score(&current_item, other_item).await?;
                info!(
                    "Score {} for item {} vs ungrouped item {}",
                    score, current_item_id, other_item.id
                );

                if score >= MATCH_THRESHOLD && best_match.is_none()
                    || score > best_match.as_ref().unwrap().0
                {
                    best_match = Some((score, other_item.id.clone(), false));
                    best_ungrouped_idx = Some(idx);
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
            dao_id: proposal.dao_id.to_string(),
            title: proposal.name.clone(),
            body: proposal.body.clone(),
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
            dao_id: dao_id.to_string(),
            title: topic.title.clone(),
            body,
            created_at: Utc.from_utc_datetime(&topic.created_at),
            item_type: ItemType::Discussion,
            keywords: vec![], // Will be filled by extract_keywords
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
            match self.normalize_topic(topic, dao_id.clone()).await {
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
