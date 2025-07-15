use crate::redis_cache;
use anyhow::{Context, Result};
use chrono::{DateTime, TimeZone, Utc};
use llm_client::InstructPromptTrait;
use llm_client::LlmClient;
use llm_client::RequestConfigTrait;
use llm_client::LoggingConfigTrait;
use llm_models::GgufLoaderTrait;
use proposalsapp_db::models::*;
use rand::Rng;
use sea_orm::{
    ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set, prelude::*,
    sea_query,
};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use tiktoken_rs::{CoreBPE, cl100k_base};
use tracing::{debug, error, info, warn};
use utils::types::{ProposalGroupItem, ProposalItem, TopicItem};
use uuid::Uuid;

// Module-level constants
const MATCH_THRESHOLD: u8 = 75;
const DECISION_RANGE: u8 = 10;
const MAX_BODY_TOKENS_PER_ITEM: usize = 3000;
const KEYWORD_EXTRACTION_MAX_TOKENS: usize = 3000;
const KEYWORD_CACHE_TTL_BASE: u64 = 604800; // 7 days in seconds
const KEYWORD_CACHE_TTL_JITTER_MAX: u64 = 302400 * 3; // Max 3x 3.5 days

lazy_static::lazy_static! {
    /// Mapping of DAO slugs to the Discourse category IDs that should be included
    /// in proposal grouping. Topics in other categories will be ignored.
    static ref DAO_DISCOURSE_CATEGORY_FILTERS: HashMap<&'static str, Vec<i32>> = {
        let mut m = HashMap::new();

        m.insert("arbitrum", vec![7, 8, 9]);
        m.insert("uniswap", vec![5, 8, 9, 10]);
        m
    };

    /// Tokenizer for counting tokens using cl100k_base encoding (used by GPT-3.5 and GPT-4)
    static ref TOKENIZER: CoreBPE = cl100k_base().expect("Failed to load cl100k_base tokenizer");
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

impl NormalizedItem {
    /// Get a truncated version of the body text, limited by token count
    pub fn get_truncated_body(&self, max_tokens: usize) -> String {
        Grouper::truncate_text(&self.body, max_tokens)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ItemType {
    Proposal,
    Topic,
}

#[derive(Debug, Clone)]
struct MatchResult {
    score: u8,
    item_id: String,
    is_grouped: bool,
}

pub struct Grouper {
    db: DatabaseConnection,
    llm_client: LlmClient,
    /// Persistent output suppressor to prevent llm_client and its dependencies
    /// from writing directly to stdout/stderr, which would bypass our JSON logging.
    /// This must be kept alive for the lifetime of the Grouper to ensure all
    /// LLM operations remain suppressed.
    _output_suppressor: crate::llm_ops::OutputSuppressor,
}

impl Grouper {
    // Helper function to check if a group can accept a topic item
    fn group_can_accept_topic(group_items: &[NormalizedItem]) -> bool {
        !group_items
            .iter()
            .any(|item| matches!(item.item_type, ItemType::Topic))
    }

    pub async fn new(db: DatabaseConnection) -> Result<Self> {
        // Initialize LLM client with proper error handling
        info!("Initializing LLM client for grouper");

        // Use Hugging Face URL to download the model automatically
        // This is Llama 3.1 8B Instruct with Q4_K_M quantization (~4.9GB)
        let model_url = "https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/blob/main/Meta-Llama-3.1-8B-Instruct-Q8_0.gguf";

        info!("Downloading/using LLM model from: {}", model_url);

        let mut builder = LlmClient::llama_cpp();
        builder.hf_quant_file_url(model_url);

        // Initialize LLM client with output suppression
        // The llm_client and its dependencies have multiple println! statements that
        // would bypass our JSON logging:
        // 1. "Starting llama_cpp Logger" from llm_devices
        // 2. "LlamaCppBackend Initialized with model: ..." from llm_interface
        // 3. "Llm Client Ready" from llm_client
        // We create a persistent suppressor that will live as long as the Grouper instance
        let output_suppressor = crate::llm_ops::OutputSuppressor::new();
        
        let llm_client = builder
            .logging_enabled(false) // Disable llm_devices logging to prevent it from replacing our JSON logger
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

        Ok(Self { 
            db, 
            llm_client,
            _output_suppressor: output_suppressor,
        })
    }

    // Helper function to safely truncate text with middle ellipsis based on token count
    // This implementation uses tiktoken for accurate token counting, ensuring the truncated text
    // fits within LLM context windows while preserving meaningful content from both ends
    fn truncate_text(text: &str, max_tokens: usize) -> String {
        const ELLIPSIS: &str = " [... TRUNCATED ...] ";

        // Tokenize the text
        let tokens = TOKENIZER.encode_ordinary(text);

        let token_count = tokens.len();

        // If text is already within token limit, return as-is
        if token_count <= max_tokens {
            return text.to_string();
        }

        // Count tokens for the ellipsis
        let ellipsis_tokens = TOKENIZER.encode_ordinary(ELLIPSIS).len();

        // If max_tokens is too small, just truncate at the end
        if max_tokens <= ellipsis_tokens + 10 {
            // Truncate tokens and decode back to string
            let truncate_at = max_tokens.saturating_sub(3); // Reserve 3 tokens for "..."
            let truncated_tokens = &tokens[..truncate_at.min(tokens.len())];

            match TOKENIZER.decode(truncated_tokens.to_vec()) {
                Ok(decoded) => format!("{decoded}..."),
                Err(_) => {
                    // Fallback to character-based truncation
                    let char_limit = truncate_at * 4; // Rough estimate: 1 token ≈ 4 chars
                    format!("{}...", &text[..char_limit.min(text.len())])
                }
            }
        } else {
            // Calculate how many tokens to keep from start and end
            let available_tokens = max_tokens.saturating_sub(ellipsis_tokens);
            // Keep 70% at the start, 30% at the end for better context
            let start_tokens = (available_tokens * 7) / 10;
            let end_tokens = available_tokens - start_tokens;

            // Get start tokens
            let start_part = &tokens[..start_tokens.min(tokens.len())];

            // Get end tokens
            let end_start_pos = tokens.len().saturating_sub(end_tokens);
            let end_part = &tokens[end_start_pos..];

            // Decode the parts
            let (start_text, end_text) = match (
                TOKENIZER.decode(start_part.to_vec()),
                TOKENIZER.decode(end_part.to_vec()),
            ) {
                (Ok(start), Ok(end)) => (start, end),
                _ => {
                    // Fallback to simple truncation if decoding fails
                    let truncate_at = max_tokens.saturating_sub(3);
                    let truncated_tokens = &tokens[..truncate_at.min(tokens.len())];
                    match TOKENIZER.decode(truncated_tokens.to_vec()) {
                        Ok(decoded) => return format!("{decoded}..."),
                        Err(_) => return text.to_string(),
                    }
                }
            };

            // Try to find good break points (whitespace) near the boundaries
            let start_text = if let Some(last_space) = start_text.rfind(|c: char| c.is_whitespace())
            {
                &start_text[..last_space]
            } else {
                &start_text
            };

            let end_text = if let Some(first_space) = end_text.find(|c: char| c.is_whitespace()) {
                &end_text[first_space + 1..]
            } else {
                &end_text
            };

            format!(
                "{}{ELLIPSIS}{}",
                start_text.trim_end(),
                end_text.trim_start()
            )
        }
    }

    // Keyword extraction using LLM with Redis caching
    // Returns a vector of keywords, or ["insufficient-content"] if the content is too sparse
    // or if the LLM extraction process fails
    async fn extract_keywords(&self, item: &NormalizedItem) -> Result<Vec<String>> {
        // Create a cache key based on item ID and a hash of title+body
        let cache_key = format!("mapper:keywords:{}-{}", item.id, item.dao_id);

        // Try to get from cache first
        if let Ok(Some(cached_keywords)) = redis_cache::get_cached_keywords(&cache_key).await {
            return Ok(cached_keywords);
        }

        info!(
            dao_id = %item.dao_id,
            item_id = %item.id,
            item_title = %item.title,
            item_type = ?item.item_type,
            "Cache miss - extracting keywords with LLM"
        );

        // Use conversational approach with a single LLM session
        match self.extract_keywords_with_conversation(item).await {
            Ok(keywords) => {
                // Cache and return
                let ttl = KEYWORD_CACHE_TTL_BASE
                    + rand::rng().random_range(302400..KEYWORD_CACHE_TTL_JITTER_MAX);
                if let Err(e) = redis_cache::cache_keywords(&cache_key, &keywords, ttl).await {
                    warn!(
                        dao_id = %item.dao_id,
                        item_id = %item.id,
                        error = %e,
                        "Failed to cache keywords in Redis"
                    );
                }
                Ok(keywords)
            }
            Err(e) => {
                warn!(
                    dao_id = %item.dao_id,
                    item_id = %item.id,
                    item_title = %item.title,
                    item_type = ?item.item_type,
                    error = %e,
                    "Failed to extract keywords - returning insufficient-content fallback"
                );
                // Return the same fallback as when content is insufficient
                Ok(vec!["insufficient-content".to_string()])
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
                - If there is not enough meaningful information to extract keywords, return ONLY: insufficient-content

                Required Coverage Areas:
                1. IDENTIFIERS: proposal ID, voting round, specific dates
                2. PROPOSAL TYPE: funding-request, parameter-change, strategic-initiative, etc.
                3. TECHNICAL ELEMENTS: specific protocols, smart contracts, technical standards
                4. FINANCIAL DETAILS: amounts, percentages, token symbols, budget items
                5. ENTITIES: proposal author, affected protocols, partner organizations
                6. ACTIONS: specific verbs describing what will happen (e.g., "deploy", "allocate", "integrate")
                7. SCOPE: affected chains, ecosystems, or communities

                Exclusion Rules (CRITICAL for DAO contexts):
                - EXCLUDE generic governance terms that appear in most proposals:
                  * Simple terms: governance, proposal, vote, voting, dao, discussion, community, protocol
                  * Procedural terms: temperature-check, snapshot, on-chain, quorum, forum, thread
                  * Generic actions: update, change, improve, implement (unless with specific context)
                - ONLY include these if combined with specifics (e.g., "governance-token-migration", "snapshot-vote-123")
                - Skip abstract concepts without concrete details
                - Avoid terms that would appear in 50%+ of all DAO proposals

                OUTPUT FORMAT REQUIREMENTS:
                - Return ONLY a comma-separated list of keywords
                - Each keyword must be lowercase letters, numbers, and hyphens only
                - Multi-word concepts should use hyphens (e.g., cross-chain-bridge)
                - No spaces, no special characters except hyphens
                - No prefixes, explanations, numbered lists, or formatting
                - Just return the keywords separated by commas
                - Aim for 10-20 keywords
                - End your response after listing the keywords
                - Special case: If content is insufficient, return ONLY the single keyword: insufficient-content

                Example (good): compound-grant-23, defi-education-initiative, 50k-usdc-funding, alice-smith, q1-2024, developer-onboarding, polygon-deployment, compound-finance, fee-switch-activation, bridge-audit-consensys

                Example (bad): governance, proposal, voting, community, discussion, update, dao, protocol, implementation, forum-post"#);

        // Limit the body to prevent exceeding token limits
        // For keyword extraction with 8192 token context window:
        // - System prompt + instructions: ~200 tokens
        // - Response space for keywords: ~300 tokens
        // - Buffer: ~200 tokens
        // This leaves ~7500 tokens for content, but we'll use 3000 to be conservative
        let truncated_body = Self::truncate_text(&item.body, KEYWORD_EXTRACTION_MAX_TOKENS);

        basic_completion
            .prompt()
            .add_user_message()
            .unwrap()
            .set_content(format!(
                "Please analyze the following governance item and extract keywords. The content is provided in XML format:\n\n<TITLE>{}</TITLE>\n<BODY>{}</BODY>\n\nRemember to return ONLY a comma-separated list of keywords, nothing else.",
                item.title, truncated_body
            ));

        // Try conversational approach with up to 3 rounds
        let max_rounds = 3;

        for round in 0..max_rounds {
            // Execute with suppressed output
            let response = {
                let _suppressor = crate::llm_ops::OutputSuppressor::new();
                basic_completion
                    .run()
                    .await
                    .context("Failed to run LLM completion")?
            };

            // Try to parse the response
            let keywords = self.parse_keyword_response(&response.content);

            // Check if we got valid keywords
            if keywords.len() == 1 && keywords[0] == "insufficient-content" {
                // Special case: insufficient content is valid
                info!(
                    dao_id = %item.dao_id,
                    item_id = %item.id,
                    item_title = %item.title,
                    item_type = ?item.item_type,
                    "Insufficient content for keyword extraction"
                );
                return Ok(keywords);
            } else if keywords.len() >= 5 && keywords.len() <= 25 {
                // Normal case: good number of keywords
                info!(
                    dao_id = %item.dao_id,
                    item_id = %item.id,
                    item_title = %item.title,
                    item_type = ?item.item_type,
                    keywords_count = keywords.len(),
                    keywords = %keywords.join(", "),
                    extraction_round = round + 1,
                    "Successfully extracted keywords"
                );
                return Ok(keywords);
            }

            // If this was the last round, give up
            if round == max_rounds - 1 {
                warn!(
                    dao_id = %item.dao_id,
                    item_id = %item.id,
                    item_title = %item.title,
                    item_type = ?item.item_type,
                    max_rounds = max_rounds,
                    keywords_found = keywords.len(),
                    keywords = %keywords.join(", "),
                    "Failed to get valid keywords after maximum rounds"
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
                "I need you to provide keywords. Please respond with ONLY comma-separated keywords, nothing else. For example: keyword1,keyword2,keyword3. If there is truly insufficient content to extract meaningful keywords, respond with only: insufficient-content".to_string()
            } else if keywords.len() < 5 {
                format!(
                    "You only provided {} keywords. I need at least 10 keywords. Please provide more keywords as a comma-separated list. If there is truly insufficient content to extract meaningful keywords, respond with only: insufficient-content",
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

        // Find the actual keyword content (strip "assistant" prefix if present)
        let keyword_content = if let Some(idx) = cleaned.find("assistant") {
            cleaned[idx + "assistant".len()..].trim()
        } else {
            cleaned
        };

        // Extract the main content line (skip any preamble)
        let keyword_line = if keyword_content.contains('\n') {
            // Find the line that looks like keywords
            keyword_content
                .lines()
                .map(|line| line.trim())
                .find(|line| {
                    // Skip lines that are just explanatory text
                    !line.to_lowercase().contains("here")
                        && !line.to_lowercase().contains("keywords")
                        && !line.to_lowercase().contains("following")
                        && !line.is_empty()
                        && (line.contains(',') || *line == "insufficient-content")
                })
                .unwrap_or(keyword_content.trim())
        } else if let Some(idx) = keyword_content.rfind(':') {
            // Handle case where keywords come after a colon
            keyword_content[idx + 1..].trim()
        } else {
            keyword_content.trim()
        };

        // Check for insufficient content case
        if keyword_line == "insufficient-content" {
            return vec!["insufficient-content".to_string()];
        }

        // Parse comma-separated keywords
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
        // With 8192 token context window for similarity comparison:
        // - System prompt + template: ~500 tokens
        // - Two titles + metadata: ~200 tokens
        // - Model response: ~1000 tokens
        // - Buffer: ~500 tokens
        // This leaves ~6000 tokens for content (3000 per item)

        // For similarity comparison, allocate 3000 tokens per item
        // This gives us 6000 tokens total for both items, leaving ~2000 for prompt/response
        let body_a = item_a.get_truncated_body(MAX_BODY_TOKENS_PER_ITEM);
        let body_b = item_b.get_truncated_body(MAX_BODY_TOKENS_PER_ITEM);

        // Create prompt with all relevant information
        let prompt = format!(
            r#"Item A:
Title: {}
Body: {}
Keywords: {}
Created: {}

Item B:
Title: {}
Body: {}
Keywords: {}
Created: {}

Consider if they are:
- The same proposal at different stages
- Strongly related proposals that should be tracked together
- A proposal and its implementation/review
- Separate topics despite any similarities"#,
            item_a.title,
            body_a,
            keywords_a.join(", "),
            item_a.created_at.format("%Y-%m-%d"),
            item_b.title,
            body_b,
            keywords_b.join(", "),
            item_b.created_at.format("%Y-%m-%d")
        );

        // Use basic_primitive workflow for faster scoring (no reasoning overhead)
        let mut primitive_request = self.llm_client.basic_primitive().integer();

        // Configure the integer bounds
        primitive_request.primitive.lower_bound(0).upper_bound(100);

        // Configure request parameters
        primitive_request
            .temperature(0.3) // Lower temperature for consistent scoring
            .max_tokens(50); // Only need a number, so very few tokens

        // Set the instructions with full context
        primitive_request
            .instructions()
            .set_content(format!(
                r#"You are a DAO governance analyst specializing in proposal relationship mapping. Analyze whether these two governance items should be grouped together and provide a precise similarity score between 0 and 100.

IMPORTANT BASELINE CONTEXT: All items being compared are already DAO governance topics, so they share ~20-30 points of inherent similarity from common governance vocabulary, procedures, and ecosystem context. Your scoring must differentiate BEYOND this baseline similarity.

Scoring Guidelines (Adjusted for DAO Context):

0-15: Maximum Unrelatedness Within Same DAO
- Different protocol areas entirely (treasury vs technical vs community)
- No shared specifics beyond generic governance terms
- Months/quarters apart with no connection
- Examples: "Deploy on Arbitrum" vs "Q3 Treasury Report", "Bug Bounty Program" vs "Marketing Budget"

16-35: Minimal Substantive Connection
- Same broad category but completely different initiatives
- No shared stakeholders, amounts, or technical details
- Generic category overlap only
- Examples: Two unrelated grant requests, "Deploy on Chain A" vs "Deploy on Chain B" (different tech stacks)

36-55: Moderate Thematic Relationship
- Same problem space, different solutions
- Shared category with some specific overlap
- Competing or alternative proposals
- Examples: Multiple security audit proposals (different vendors), Various treasury strategies (different approaches)

56-{}: Significant Operational Connection
- Clear dependencies or complementary goals
- Same author/team across related initiatives
- Shared specific parameters but not same proposal
- Examples: "Temperature Check: Fee Reduction" vs "Topic: Fee Model Analysis", Grant request + progress report

{}-{}: Strong Governance Continuity (APPROACHING GROUPING THRESHOLD)
- Same initiative progressing through stages
- Clear progression markers (RFC→Temp Check→Proposal)
- Days to weeks apart with continuity
- Examples: "[RFC] Deploy V3" → "[Proposal] Deploy V3", Snapshot vote → On-chain execution

{}-95: Near-Identical Items (ABOVE GROUPING THRESHOLD)
- Same proposal across platforms
- Minor revisions or amendments
- Identical key parameters (amounts, addresses, specifications)
- Examples: Forum post ↔ On-chain proposal, Draft → Final versions

96-100: Duplicates or Perfect Matches
- Identical content with trivial differences
- Same proposal ID across systems
- Repostings or system duplicates

CRITICAL: The grouping threshold is {}. Scores of {} and above mean the items WILL be grouped together.
Scores below {} mean they will remain separate.

CRITICAL DIFFERENTIATION FACTORS:
1. Specific parameters (amounts, addresses, dates) vs generic terms
2. Explicit references/URLs between items
3. Author/proposer continuity
4. Temporal progression indicators
5. Unique technical specifications

PENALIZE for baseline similarities:
- Generic governance vocabulary (proposal, vote, treasury, protocol)
- Standard procedural language (temperature check, quorum)
- Common DAO references without specific context

Remember: Focus on what makes these items MORE related than any two random DAO proposals would be.

{}

Based on the above items, provide a precise similarity score between 0 and 100. Do not round up the score, make it a precise integer, use the entire range from 0 to 100."#,
                MATCH_THRESHOLD - 5,
                MATCH_THRESHOLD - 5,
                MATCH_THRESHOLD,
                MATCH_THRESHOLD + 6,
                MATCH_THRESHOLD,
                MATCH_THRESHOLD,
                MATCH_THRESHOLD,
                prompt
            ));

        // Get the score using basic_primitive (non-optional)
        let score = {
            let _suppressor = crate::llm_ops::OutputSuppressor::new();
            match primitive_request.return_primitive().await {
                Ok(score) => score,
                Err(e) => {
                    error!(
                        dao_id = %item_a.dao_id,
                        item_a_id = %item_a.id,
                        item_a_title = %item_a.title,
                        item_a_type = ?item_a.item_type,
                        item_b_id = %item_b.id,
                        item_b_title = %item_b.title,
                        item_b_type = ?item_b.item_type,
                        error = %e,
                        prompt_length = prompt.len(),
                        "LLM basic_primitive failed to generate similarity score - returning default score of 0"
                    );
                    // Return a low score (0) to indicate no match when LLM fails
                    // This allows the grouping process to continue instead of failing
                    0
                }
            }
        };

        // Convert from u32 to u8, ensuring it's within bounds
        let score = score.min(100) as u8;

        // Log detailed scoring information for analysis
        info!(
            dao_id = %item_a.dao_id,
            item_a_id = %item_a.id,
            item_a_title = %item_a.title,
            item_a_type = ?item_a.item_type,
            item_a_keywords = %keywords_a.join(", "),
            item_b_id = %item_b.id,
            item_b_title = %item_b.title,
            item_b_type = ?item_b.item_type,
            item_b_keywords = %keywords_b.join(", "),
            score = score,
            above_threshold = score >= MATCH_THRESHOLD,
            "LLM similarity score calculated"
        );

        Ok(score)
    }

    // Confirm a match decision using decision workflow with multiple votes
    async fn confirm_match_decision(
        &self,
        item_a: &NormalizedItem,
        item_b: &NormalizedItem,
        initial_score: u8,
    ) -> Result<u8> {
        // Only use decision workflow if score is near threshold

        // If score is clearly above or below threshold, just return it
        if !(MATCH_THRESHOLD - DECISION_RANGE..=MATCH_THRESHOLD + DECISION_RANGE)
            .contains(&initial_score)
        {
            info!(
                dao_id = %item_a.dao_id,
                phase = "CONFIRMATION_SKIPPED",
                item_a_id = %item_a.id,
                item_b_id = %item_b.id,
                initial_score = initial_score,
                threshold = MATCH_THRESHOLD,
                decision_range = DECISION_RANGE,
                reason = "score_outside_decision_range",
                "[AI_GROUPING] Skipping confirmation - score clearly outside threshold range"
            );
            return Ok(initial_score);
        }

        info!(
            dao_id = %item_a.dao_id,
            phase = "CONFIRMATION_START",
            item_a_id = %item_a.id,
            item_a_title = %item_a.title,
            item_b_id = %item_b.id,
            item_b_title = %item_b.title,
            initial_score = initial_score,
            threshold = MATCH_THRESHOLD,
            decision_range = DECISION_RANGE,
            "[AI_GROUPING] Score near threshold - running decision confirmation with 3 votes"
        );

        // Create the comparison prompt once
        let prompt = format!(
            r#"Item A:
Title: {}
Body: {}
Keywords: {}
Created: {}

Item B:
Title: {}
Body: {}
Keywords: {}
Created: {}

Initial assessment score: {}

The initial assessment determined these items have a similarity score of {}. This is near the grouping threshold of {}.
Please carefully analyze whether these items should be grouped together."#,
            item_a.title,
            item_a.get_truncated_body(MAX_BODY_TOKENS_PER_ITEM),
            item_a.keywords.join(", "),
            item_a.created_at.format("%Y-%m-%d"),
            item_b.title,
            item_b.get_truncated_body(MAX_BODY_TOKENS_PER_ITEM),
            item_b.keywords.join(", "),
            item_b.created_at.format("%Y-%m-%d"),
            initial_score,
            initial_score,
            MATCH_THRESHOLD
        );

        // Use basic_primitive workflow for faster consensus (no reasoning overhead)
        // We'll run it 3 times manually to get consensus
        let mut scores = Vec::new();

        for i in 0..3 {
            let mut primitive_request = self.llm_client.basic_primitive().integer();

            // Configure the integer bounds
            primitive_request.primitive.lower_bound(0).upper_bound(100);

            // Configure request parameters with temperature gradient for diversity
            primitive_request
                .temperature(0.3 + (i as f32 * 0.2)) // 0.3, 0.5, 0.7
                .max_tokens(50); // Only need a number

            // Set the instructions with full context
            primitive_request
                .instructions()
                .set_content(format!(
                r#"You are a DAO governance analyst providing a final determination on whether these items should be grouped. Consider the initial score and provide your own assessment.

{}

BASELINE CONTEXT: Remember that all items share ~20-30 points of inherent DAO governance similarity. Differentiate BEYOND this baseline.

Scoring Guidelines (Adjusted for DAO Context):
- 0-15: Maximum unrelatedness within same DAO (different domains entirely)
- 16-35: Minimal substantive connection (category overlap only)
- 36-55: Moderate thematic relationship (same problem, different solutions)
- 56-{}: Significant operational connection (dependencies, same team)
- {}-{}: Strong governance continuity (same initiative progressing)
- {}-95: Near-identical items (same proposal, different platforms)
- 96-100: Duplicates or perfect matches

CRITICAL: The grouping threshold is {}. Scores of {} and above mean the items WILL be grouped together.
Scores below {} mean they will remain separate.

Focus on: specific parameters, explicit references, author continuity, temporal progression, unique technical details.
Ignore: generic governance terms, standard procedures, common DAO vocabulary.

Based on careful analysis, provide a final precise similarity score between 0 and 100. Do not round up the score, make it a precise integer, use the entire range from 0 to 100."#, prompt, MATCH_THRESHOLD - 5, MATCH_THRESHOLD - 5, MATCH_THRESHOLD, MATCH_THRESHOLD + 6, MATCH_THRESHOLD, MATCH_THRESHOLD, MATCH_THRESHOLD
            ));

            // Get the score
            let score = {
                let _suppressor = crate::llm_ops::OutputSuppressor::new();
                match primitive_request.return_primitive().await {
                    Ok(score) => score,
                    Err(e) => {
                        error!(
                            dao_id = %item_a.dao_id,
                            item_a_id = %item_a.id,
                            item_b_id = %item_b.id,
                            vote_number = i + 1,
                            error = %e,
                            "Basic primitive vote {} failed",
                            i + 1
                        );
                        continue; // Skip failed votes
                    }
                }
            };

            let vote_score = score.min(100) as u8;
            scores.push(vote_score);

            info!(
                dao_id = %item_a.dao_id,
                item_a_id = %item_a.id,
                item_b_id = %item_b.id,
                vote_number = i + 1,
                vote_score = vote_score,
                temperature = 0.3 + (i as f32 * 0.2),
                "Basic primitive vote completed"
            );
        }

        // Calculate consensus score (median of valid scores)
        if scores.is_empty() {
            error!(
                dao_id = %item_a.dao_id,
                item_a_id = %item_a.id,
                item_b_id = %item_b.id,
                "All basic_primitive votes failed"
            );
            return Err(anyhow::anyhow!("All basic_primitive votes failed"));
        }

        scores.sort();
        let consensus_score = if scores.len() % 2 == 0 {
            (scores[scores.len() / 2 - 1] + scores[scores.len() / 2]) / 2
        } else {
            scores[scores.len() / 2]
        };

        // Log detailed decision information
        info!(
            dao_id = %item_a.dao_id,
            phase = "CONFIRMATION_COMPLETE",
            item_a_id = %item_a.id,
            item_a_title = %item_a.title,
            item_b_id = %item_b.id,
            item_b_title = %item_b.title,
            initial_score = initial_score,
            consensus_score = consensus_score,
            individual_scores = ?scores,
            valid_votes = scores.len(),
            score_change = (consensus_score as i16 - initial_score as i16),
            decision = if consensus_score >= MATCH_THRESHOLD { "CONFIRMED_MATCH" } else { "CONFIRMED_NO_MATCH" },
            threshold = MATCH_THRESHOLD,
            "[AI_GROUPING] Basic primitive consensus reached"
        );

        Ok(consensus_score)
    }

    // Main grouping algorithm with scoring
    async fn ai_grouping_pass(
        &self,
        mut ungrouped_items: Vec<NormalizedItem>,
        mut groups: HashMap<Uuid, Vec<NormalizedItem>>, // group_id -> items
        dao_id: Uuid,
    ) -> Result<HashMap<Uuid, Vec<NormalizedItem>>> {
        let total_ungrouped = ungrouped_items.len();
        let mut processed_count = 0;

        // Log initial state
        info!(
            dao_id = %dao_id,
            phase = "AI_GROUPING_START",
            total_ungrouped_items = total_ungrouped,
            existing_groups_count = groups.len(),
            existing_grouped_items = groups.values().map(|items| items.len()).sum::<usize>(),
            "[AI_GROUPING] Starting AI grouping pass"
        );

        while let Some(current_item) = ungrouped_items.pop() {
            processed_count += 1;
            let current_item_id = current_item.id.clone();
            let current_item_title = current_item.title.clone();
            let current_item_type = current_item.item_type.clone();

            info!(
                dao_id = %dao_id,
                phase = "START_PROCESSING_ITEM",
                item_id = %current_item_id,
                item_title = %current_item_title,
                item_type = ?current_item_type,
                item_keywords_count = current_item.keywords.len(),
                item_keywords = %current_item.keywords.join(", "),
                created_at = %current_item.created_at.format("%Y-%m-%d"),
                progress_current = processed_count,
                progress_total = total_ungrouped,
                progress_percent = format!("{:.1}%", (processed_count as f64 / total_ungrouped as f64) * 100.0),
                groups_count = groups.len(),
                remaining_ungrouped = ungrouped_items.len(),
                "[AI_GROUPING] Starting to process ungrouped item"
            );

            let mut best_match: Option<MatchResult> = None;
            let mut best_group_id: Option<Uuid> = None;
            let mut best_ungrouped_idx: Option<usize> = None;

            // Score against all grouped items - iterate directly over groups to get fresh data
            let total_groups = groups.len();
            let mut groups_checked = 0;

            for (group_id, items) in groups.iter() {
                groups_checked += 1;

                debug!(
                    dao_id = %dao_id,
                    phase = "CHECK_GROUP",
                    current_item_id = %current_item_id,
                    group_id = %group_id,
                    group_items_count = items.len(),
                    groups_checked = groups_checked,
                    total_groups = total_groups,
                    "[AI_GROUPING] Checking against existing group"
                );

                // Skip this group if current item is a topic and group already has one
                if matches!(current_item.item_type, ItemType::Topic)
                    && !Self::group_can_accept_topic(items)
                {
                    info!(
                        dao_id = %dao_id,
                        phase = "SKIP_GROUP_TOPIC_LIMIT",
                        current_item_id = %current_item_id,
                        group_id = %group_id,
                        reason = "group_already_has_topic",
                        "[AI_GROUPING] Skipping group - already contains a topic"
                    );
                    continue;
                }

                for grouped_item in items {
                    let score = self.match_score(&current_item, grouped_item).await?;

                    info!(
                        dao_id = %dao_id,
                        phase = "SCORE_GROUPED_ITEM",
                        current_item_id = %current_item_id,
                        current_item_title = %current_item.title,
                        compared_item_id = %grouped_item.id,
                        compared_item_title = %grouped_item.title,
                        compared_item_type = ?grouped_item.item_type,
                        group_id = %group_id,
                        score = score,
                        above_threshold = score >= MATCH_THRESHOLD,
                        threshold = MATCH_THRESHOLD,
                        is_new_best = score >= MATCH_THRESHOLD && (best_match.is_none() || score > best_match.as_ref().unwrap().score),
                        "[AI_GROUPING] Scored against grouped item"
                    );

                    if score >= MATCH_THRESHOLD
                        && (best_match.is_none() || score > best_match.as_ref().unwrap().score)
                    {
                        best_match = Some(MatchResult {
                            score,
                            item_id: grouped_item.id.clone(),
                            is_grouped: true,
                        });
                        best_group_id = Some(*group_id);
                    }
                }
            }

            // Score ungrouped items
            {
                let remaining_ungrouped = ungrouped_items.len();
                if remaining_ungrouped > 0 {
                    info!(
                        dao_id = %dao_id,
                        phase = "START_UNGROUPED_COMPARISON",
                        current_item_id = %current_item_id,
                        remaining_ungrouped = remaining_ungrouped,
                        "[AI_GROUPING] Starting comparison with ungrouped items"
                    );
                }

                for (idx, other_item) in ungrouped_items.iter().enumerate() {
                    // Skip if both items are topics - never match topics together
                    if matches!(current_item.item_type, ItemType::Topic)
                        && matches!(other_item.item_type, ItemType::Topic)
                    {
                        info!(
                            dao_id = %dao_id,
                            phase = "SKIP_TOPIC_PAIR",
                            current_item_id = %current_item_id,
                            current_item_title = %current_item.title,
                            other_item_id = %other_item.id,
                            other_item_title = %other_item.title,
                            reason = "both_items_are_topics",
                            "[AI_GROUPING] Skipping match - both items are topics"
                        );
                        continue;
                    }

                    let score = self.match_score(&current_item, other_item).await?;

                    info!(
                        dao_id = %dao_id,
                        phase = "SCORE_UNGROUPED_ITEM",
                        current_item_id = %current_item_id,
                        current_item_title = %current_item.title,
                        compared_item_id = %other_item.id,
                        compared_item_title = %other_item.title,
                        compared_item_type = ?other_item.item_type,
                        score = score,
                        above_threshold = score >= MATCH_THRESHOLD,
                        threshold = MATCH_THRESHOLD,
                        is_new_best = score >= MATCH_THRESHOLD && (best_match.is_none() || score > best_match.as_ref().unwrap().score),
                        ungrouped_index = idx,
                        "[AI_GROUPING] Scored against ungrouped item"
                    );

                    if score >= MATCH_THRESHOLD
                        && (best_match.is_none() || score > best_match.as_ref().unwrap().score)
                    {
                        best_match = Some(MatchResult {
                            score,
                            item_id: other_item.id.clone(),
                            is_grouped: false,
                        });
                        best_ungrouped_idx = Some(idx);
                    }
                }
            }

            // Log best match summary before confirmation
            if let Some(ref match_result) = best_match {
                info!(
                    dao_id = %dao_id,
                    phase = "BEST_MATCH_FOUND",
                    current_item_id = %current_item_id,
                    best_match_item_id = %match_result.item_id,
                    best_match_score = match_result.score,
                    best_match_is_grouped = match_result.is_grouped,
                    best_match_group_id = ?best_group_id,
                    total_items_compared = total_groups + ungrouped_items.len(),
                    "[AI_GROUPING] Best match identified, proceeding to confirmation"
                );
            } else {
                info!(
                    dao_id = %dao_id,
                    phase = "NO_MATCH_FOUND",
                    current_item_id = %current_item_id,
                    threshold = MATCH_THRESHOLD,
                    total_items_compared = total_groups + ungrouped_items.len(),
                    "[AI_GROUPING] No matches above threshold found"
                );
            }

            // Run decision confirmation on the best match if found
            let confirmed_match = match best_match {
                Some(match_result) => {
                    // Find the matched item to run confirmation
                    let matched_item = if match_result.is_grouped {
                        // Find in groups
                        groups
                            .values()
                            .flatten()
                            .find(|item| item.id == match_result.item_id)
                    } else {
                        // Find in ungrouped items
                        ungrouped_items.get(best_ungrouped_idx.unwrap())
                    };

                    if let Some(matched_item) = matched_item {
                        // Run decision workflow to confirm the match
                        let final_score = self
                            .confirm_match_decision(&current_item, matched_item, match_result.score)
                            .await?;

                        // Check if the confirmed score still meets the threshold
                        if final_score >= MATCH_THRESHOLD {
                            Some(MatchResult {
                                score: final_score,
                                item_id: match_result.item_id.clone(),
                                is_grouped: match_result.is_grouped,
                            })
                        } else {
                            info!(
                                dao_id = %dao_id,
                                phase = "CONFIRMATION_REJECTED",
                                current_item_id = %current_item_id,
                                current_item_title = %current_item.title,
                                matched_item_id = %match_result.item_id,
                                initial_score = match_result.score,
                                final_score = final_score,
                                score_difference = (match_result.score as i16 - final_score as i16),
                                threshold = MATCH_THRESHOLD,
                                "[AI_GROUPING] Decision workflow rejected match - score below threshold"
                            );
                            None
                        }
                    } else {
                        // Should not happen, but handle gracefully
                        warn!(
                            "Could not find matched item {} for confirmation",
                            match_result.item_id
                        );
                        Some(match_result)
                    }
                }
                None => None,
            };

            // Process the confirmed match
            match confirmed_match {
                Some(match_result) => {
                    if match_result.is_grouped {
                        // Add to existing group
                        let group_id = best_group_id.unwrap();
                        let group_size = groups.get(&group_id).map(|g| g.len()).unwrap_or(0);

                        info!(
                            dao_id = %dao_id,
                            phase = "FINAL_ACTION",
                            action = "ADD_TO_GROUP",
                            current_item_id = %current_item_id,
                            current_item_title = %current_item.title,
                            current_item_type = ?current_item_type,
                            matched_item_id = %match_result.item_id,
                            final_score = match_result.score,
                            group_id = %group_id,
                            group_size_before = group_size,
                            group_size_after = group_size + 1,
                            "[AI_GROUPING] Adding item to existing group"
                        );

                        groups.get_mut(&group_id).unwrap().push(current_item);
                    } else {
                        // Create new group with both items
                        let matched_item = ungrouped_items.remove(best_ungrouped_idx.unwrap());
                        let new_group_id = Uuid::new_v4();

                        info!(
                            dao_id = %dao_id,
                            phase = "FINAL_ACTION",
                            action = "CREATE_GROUP",
                            item_a_id = %current_item_id,
                            item_a_title = %current_item.title,
                            item_a_type = ?current_item_type,
                            item_b_id = %match_result.item_id,
                            item_b_title = %matched_item.title,
                            item_b_type = ?matched_item.item_type,
                            final_score = match_result.score,
                            new_group_id = %new_group_id,
                            "[AI_GROUPING] Creating new group from two ungrouped items"
                        );

                        groups.insert(new_group_id, vec![current_item, matched_item]);
                    }
                }
                None => {
                    // No matches above threshold, create single-item group
                    let new_group_id = Uuid::new_v4();

                    info!(
                        dao_id = %dao_id,
                        phase = "FINAL_ACTION",
                        action = "CREATE_SINGLE_ITEM_GROUP",
                        current_item_id = %current_item_id,
                        current_item_title = %current_item.title,
                        current_item_type = ?current_item_type,
                        threshold = MATCH_THRESHOLD,
                        new_group_id = %new_group_id,
                        total_items_compared = total_groups + ungrouped_items.len() + 1,
                        "[AI_GROUPING] No matches found - creating single-item group"
                    );

                    groups.insert(new_group_id, vec![current_item]);
                }
            }

            // Persist groups after processing each item
            if let Err(e) = self.persist_results(&groups, dao_id).await {
                error!(
                    "Failed to persist groups after processing item {}: {}",
                    current_item_id, e
                );
                // Continue processing despite persistence error
            }
        }

        // Calculate final statistics
        let total_groups_final = groups.len();
        let single_item_groups = groups.values().filter(|items| items.len() == 1).count();
        let multi_item_groups = groups.values().filter(|items| items.len() > 1).count();
        let largest_group = groups.values().map(|items| items.len()).max().unwrap_or(0);
        let total_items_grouped = groups.values().map(|items| items.len()).sum::<usize>();

        info!(
            dao_id = %dao_id,
            phase = "AI_GROUPING_COMPLETE",
            processed_items = total_ungrouped,
            total_groups = total_groups_final,
            single_item_groups = single_item_groups,
            multi_item_groups = multi_item_groups,
            largest_group_size = largest_group,
            total_items_grouped = total_items_grouped,
            "[AI_GROUPING] AI grouping phase completed"
        );

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
        let id = format!("proposal_{external_id}");

        let raw_data = ProposalGroupItem::Proposal(ProposalItem {
            name: proposal.name.clone(),
            external_id: external_id.clone(),
            governor_id: proposal.governor_id,
        });

        Ok(NormalizedItem {
            id,
            dao_id: proposal.dao_id.to_string(),
            title: proposal.name,
            body: proposal.body,
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
            title: topic.title,
            body,
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

        // Extract keywords for all items after procedural grouping
        let total_items = all_items.len();
        info!("Extracting keywords for {} items", total_items);
        for (idx, item) in all_items.iter_mut().enumerate() {
            if idx % 10 == 0 {
                info!(
                    "Extracting keywords: {}/{} items processed",
                    idx, total_items
                );
            }
            item.keywords = self.extract_keywords(item).await?;
        }
        info!("Keyword extraction complete for all {} items", total_items);

        // Get ungrouped items (after procedural grouping)
        let ungrouped_items: Vec<_> = all_items
            .into_iter()
            .filter(|item| !grouped_item_ids.contains(&item.id))
            .collect();

        info!(
            "After procedural grouping: {} ungrouped items remaining for AI grouping",
            ungrouped_items.len()
        );

        // Step 3-5: Run the AI-based grouping algorithm on remaining ungrouped items
        let final_groups = self
            .ai_grouping_pass(ungrouped_items, groups, dao_id)
            .await?;

        // No need to persist again here since we persist after each item in ai_grouping_pass

        // Calculate final statistics
        let total_groups = final_groups.len();
        let single_item_groups = final_groups
            .values()
            .filter(|items| items.len() == 1)
            .count();
        let multi_item_groups = final_groups
            .values()
            .filter(|items| items.len() > 1)
            .count();
        let largest_group_size = final_groups
            .values()
            .map(|items| items.len())
            .max()
            .unwrap_or(0);
        let avg_group_size = if total_groups > 0 {
            final_groups
                .values()
                .map(|items| items.len())
                .sum::<usize>() as f64
                / total_groups as f64
        } else {
            0.0
        };

        let procedural_matches_count = final_groups
            .values()
            .filter(|items| {
                items.len() > 1
                    && items
                        .iter()
                        .any(|item| matches!(&item.raw_data, ProposalGroupItem::Proposal(_)))
                    && items
                        .iter()
                        .any(|item| matches!(&item.raw_data, ProposalGroupItem::Topic(_)))
            })
            .count();

        info!(
            dao_id = %dao_id,
            total_items = total_items,
            total_groups = total_groups,
            single_item_groups = single_item_groups,
            multi_item_groups = multi_item_groups,
            largest_group_size = largest_group_size,
            avg_group_size = format!("{:.2}", avg_group_size),
            procedural_matches = procedural_matches_count,
            ai_matches = multi_item_groups - procedural_matches_count,
            proposals_processed = proposals.len(),
            topics_processed = topics.len(),
            "Grouping complete - detailed statistics"
        );
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
        assert!(truncated.contains("[... TRUNCATED ...]"));
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
