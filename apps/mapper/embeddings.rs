use anyhow::{Context, Result};
use fastembed::{EmbeddingModel, InitOptions, TextEmbedding};
use regex::Regex;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

#[derive(Clone)]
pub struct EmbeddingCache {
    /// Map from text to its embedding vector
    cache: Arc<RwLock<HashMap<String, Vec<f32>>>>,
    /// The embedding model
    model: Arc<TextEmbedding>,
    /// Cosine similarity threshold for matching (title-only)
    similarity_threshold: f32,
    /// Lower threshold for title+body matching
    body_similarity_threshold: f32,
}

#[derive(Debug, Clone)]
pub struct SimilarityScore {
    pub title_similarity: f32,
    pub full_similarity: Option<f32>,
    pub keyword_boost: f32,
    pub combined_score: f32,
    pub passes_threshold: bool,
}

impl EmbeddingCache {
    pub async fn new(similarity_threshold: f32) -> Result<Self> {
        info!("Initializing embedding model...");

        // Initialize the model with BGELargeEN - best model for semantic similarity
        let model = TextEmbedding::try_new(
            InitOptions::new(EmbeddingModel::BGELargeENV15).with_show_download_progress(true),
        )
        .context("Failed to initialize embedding model")?;

        info!("Embedding model initialized successfully");

        // Set body threshold lower than title threshold
        // Hardcoded optimal thresholds based on extensive testing
        let body_similarity_threshold = 0.65f32;

        Ok(Self {
            cache: Arc::new(RwLock::new(HashMap::new())),
            model: Arc::new(model),
            similarity_threshold,
            body_similarity_threshold,
        })
    }

    /// Generate embeddings for multiple texts at once
    pub async fn embed_batch(&self, texts: Vec<String>) -> Result<Vec<Vec<f32>>> {
        if texts.is_empty() {
            return Ok(vec![]);
        }

        let mut cache = self.cache.write().await;
        let mut to_embed = Vec::new();
        let mut results = vec![None; texts.len()];

        // Check cache first
        for (i, text) in texts.iter().enumerate() {
            if let Some(embedding) = cache.get(text) {
                results[i] = Some(embedding.clone());
            } else {
                to_embed.push((i, text.clone()));
            }
        }

        // Generate embeddings for uncached texts
        if !to_embed.is_empty() {
            let texts_to_embed: Vec<_> = to_embed.iter().map(|(_, text)| text.as_str()).collect();
            debug!("Generating embeddings for {} texts", texts_to_embed.len());

            let embeddings = self
                .model
                .embed(texts_to_embed, None)
                .context("Failed to generate embeddings")?;

            // Store in cache and results
            for ((idx, text), embedding) in to_embed.into_iter().zip(embeddings.into_iter()) {
                cache.insert(text, embedding.clone());
                results[idx] = Some(embedding);
            }
        }

        Ok(results.into_iter().map(|r| r.unwrap()).collect())
    }

    /// Generate embedding for a single text
    pub async fn embed(&self, text: &str) -> Result<Vec<f32>> {
        let embeddings = self.embed_batch(vec![text.to_string()]).await?;
        Ok(embeddings.into_iter().next().unwrap())
    }

    /// Calculate cosine similarity between two vectors
    pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
        if a.len() != b.len() {
            warn!("Vector dimensions don't match: {} vs {}", a.len(), b.len());
            return 0.0;
        }

        let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
        let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

        if norm_a == 0.0 || norm_b == 0.0 {
            return 0.0;
        }

        dot_product / (norm_a * norm_b)
    }

    /// Combine title and body for better semantic representation
    pub fn combine_text_for_embedding(
        title: &str,
        body: Option<&str>,
    ) -> String {
        match body {
            Some(body_text) => {
                format!("{}\n\n{}", title, body_text)
            }
            None => title.to_string(),
        }
    }

    /// Find the most similar text from a list of candidates
    pub async fn find_most_similar(
        &self,
        query: &str,
        candidates: Vec<(String, String)>, // (id, text)
    ) -> Result<Option<(String, f32)>> {
        if candidates.is_empty() {
            return Ok(None);
        }

        // Generate embeddings for query and all candidates
        let mut texts = vec![query.to_string()];
        texts.extend(candidates.iter().map(|(_, text)| text.clone()));

        let embeddings = self.embed_batch(texts).await?;
        let query_embedding = &embeddings[0];

        // Find most similar
        let mut best_match = None;
        let mut best_similarity = 0.0;

        for (i, (id, _)) in candidates.iter().enumerate() {
            let similarity = Self::cosine_similarity(query_embedding, &embeddings[i + 1]);

            if similarity > best_similarity && similarity >= self.similarity_threshold {
                best_similarity = similarity;
                best_match = Some((id.clone(), similarity));
            }
        }

        if let Some((id, score)) = &best_match {
            info!("Found similar match: {} with score {:.3}", id, score);
        }

        Ok(best_match)
    }

    /// Clear the cache
    pub async fn clear_cache(&self) {
        let mut cache = self.cache.write().await;
        let size = cache.len();
        cache.clear();
        info!("Cleared embedding cache ({} entries)", size);
    }

    /// Get cache statistics
    pub async fn cache_stats(&self) -> (usize, usize) {
        let cache = self.cache.read().await;
        let entries = cache.len();
        let memory_estimate = entries * 1024 * 4; // BGELargeEN has 1024 dimensions * 4 bytes per float
        (entries, memory_estimate)
    }

    /// Get the body similarity threshold
    pub fn get_body_similarity_threshold(&self) -> f32 {
        self.body_similarity_threshold
    }

    /// Extract keywords from text for matching boost
    pub fn extract_keywords(text: &str) -> HashSet<String> {
        let mut keywords = HashSet::new();
        let normalized = text.to_lowercase();

        // Important governance keywords based on database analysis
        let key_terms = [
            // Core governance
            "arbitrum", "dao", "governance", "proposal", "constitutional", 
            "election", "council", "committee", "vote", "voting",
            
            // Programs and initiatives
            "stip", "ltipp", "ardc", "dip", "mss", "adpc", "tmc", "gcp",
            "step", "aip", "rfc", "temperature",
            
            // Funding and treasury
            "treasury", "budget", "grant", "fund", "funding", "incentive",
            "allocation", "endowment", "subsidy", "payment",
            
            // Technical terms
            "bold", "timeboost", "stylus", "orbit", "nova", "one",
            "sequencer", "validator", "arbos", "upgrade", "security",
            
            // Roles and entities
            "delegate", "procurement", "audit", "opco", "foundation",
            "collective", "ventures", "catalyst", "domain", "allocator",
            
            // Specific activities
            "research", "development", "ecosystem", "community", "growth",
            "gaming", "bridge", "addendum", "extension", "challenge",
            
            // Common protocol names (for STIP/LTIPP matching)
            "protocol", "finance", "exchange", "network", "labs",
            "recommended", "round", "final", "draft", "updated",
        ];

        for term in &key_terms {
            if normalized.contains(term) {
                keywords.insert(term.to_string());
            }
        }

        // Extract acronyms and special terms
        let acronym_regex = Regex::new(r"\b[A-Z]{2,}\b").unwrap();
        for cap in acronym_regex.captures_iter(text) {
            keywords.insert(cap[0].to_lowercase());
        }

        keywords
    }

    /// Normalize proposal text by removing common prefixes and variations
    pub fn normalize_proposal_text(text: &str) -> String {
        let mut normalized = text.to_string();

        // Remove common prefixes
        let prefixes = [
            r"^\[UPDATED\]\s*",
            r"^\[Updated\]\s*",
            r"^\[DRAFT\]\s*",
            r"^\[RFC-\d+\]\s*",
            r"^Proposal:\s*",
            r"^Proposal\s+\[Non-Constitutional\]:\s*",
            r"^Temperature check:\s*",
        ];

        for prefix in &prefixes {
            let re = Regex::new(prefix).unwrap();
            normalized = re.replace(&normalized, "").to_string();
        }

        normalized.trim().to_string()
    }

    /// Calculate keyword similarity boost
    pub fn calculate_keyword_boost(
        keywords1: &HashSet<String>,
        keywords2: &HashSet<String>,
    ) -> f32 {
        if keywords1.is_empty() || keywords2.is_empty() {
            return 0.0;
        }

        let intersection = keywords1.intersection(keywords2).count() as f32;
        let union = keywords1.union(keywords2).count() as f32;

        // Enhanced boost calculation
        // High-value keywords get more weight (based on actual group analysis)
        let high_value_keywords = [
            // Program identifiers (very high value)
            "stip", "ltipp", "ardc", "dip", "mss", "adpc", "tmc", "gcp",
            // Core governance terms
            "constitutional", "treasury", "council", "committee",
            // Key initiatives
            "incentive", "delegate", "procurement", "audit",
            // Technical identifiers
            "bold", "timeboost", "stylus", "orbit",
        ];
        let mut high_value_matches = 0;
        for keyword in &high_value_keywords {
            if keywords1.contains(*keyword) && keywords2.contains(*keyword) {
                high_value_matches += 1;
            }
        }

        // Base Jaccard similarity plus bonus for high-value matches
        let base_boost = (intersection / union) * 0.1;
        let high_value_boost = (high_value_matches as f32) * 0.015;

        (base_boost + high_value_boost).min(0.15) // Cap at 0.15
    }

    /// Enhanced similarity calculation with multiple factors
    pub async fn calculate_enhanced_similarity(
        &self,
        title1: &str,
        body1: Option<&str>,
        title2: &str,
        body2: Option<&str>,
    ) -> Result<SimilarityScore> {
        // Normalize titles
        let norm_title1 = Self::normalize_proposal_text(title1);
        let norm_title2 = Self::normalize_proposal_text(title2);

        // Fast path: if normalized titles are identical, give high score
        if norm_title1 == norm_title2 && !norm_title1.is_empty() {
            // Extract keywords for exact match bonus
            let keywords1 = Self::extract_keywords(&format!("{} {}", title1, body1.unwrap_or("")));
            let keywords2 = Self::extract_keywords(&format!("{} {}", title2, body2.unwrap_or("")));
            let keyword_boost = Self::calculate_keyword_boost(&keywords1, &keywords2);
            
            return Ok(SimilarityScore {
                title_similarity: 1.0,
                full_similarity: None,
                keyword_boost,
                combined_score: (1.0 + keyword_boost).min(1.0),
                passes_threshold: true,
            });
        }

        // Calculate title similarity
        let title_embeddings = self
            .embed_batch(vec![norm_title1.clone(), norm_title2.clone()])
            .await?;
        let title_similarity = Self::cosine_similarity(&title_embeddings[0], &title_embeddings[1]);

        // Calculate full similarity if bodies are provided
        let full_similarity = if let (Some(b1), Some(b2)) = (body1, body2) {
            let full_text1 = Self::combine_text_for_embedding(&title1, Some(b1));
            let full_text2 = Self::combine_text_for_embedding(&title2, Some(b2));

            let full_embeddings = self.embed_batch(vec![full_text1, full_text2]).await?;
            Some(Self::cosine_similarity(
                &full_embeddings[0],
                &full_embeddings[1],
            ))
        } else {
            None
        };

        // Extract keywords and calculate boost
        let keywords1 = Self::extract_keywords(&format!("{} {}", title1, body1.unwrap_or("")));
        let keywords2 = Self::extract_keywords(&format!("{} {}", title2, body2.unwrap_or("")));
        let keyword_boost = Self::calculate_keyword_boost(&keywords1, &keywords2);

        // Calculate combined score with adaptive weighting
        let combined_score = if let Some(full_sim) = full_similarity {
            // Special case: very high title similarity should be weighted more heavily
            if title_similarity >= 0.85 {
                // High title match: 70% title, 20% full content, 10% keywords
                (title_similarity * 0.7 + full_sim * 0.2 + keyword_boost).min(1.0)
            } else if title_similarity >= 0.75 {
                // Good title match: 60% title, 30% full content, 10% keywords
                (title_similarity * 0.6 + full_sim * 0.3 + keyword_boost).min(1.0)
            } else {
                // Normal case: balanced weighting
                let similarity_gap = (title_similarity - full_sim).abs();
                
                if similarity_gap > 0.3 && title_similarity > full_sim {
                    // Large gap with title being better - likely meta content in body
                    // Weight: 60% title, 30% full content, 10% keywords
                    (title_similarity * 0.6 + full_sim * 0.3 + keyword_boost).min(1.0)
                } else {
                    // Normal weighting: 50% title, 40% full content, 10% keywords
                    (title_similarity * 0.5 + full_sim * 0.4 + keyword_boost).min(1.0)
                }
            }
        } else {
            // Title only with keyword boost
            (title_similarity + keyword_boost).min(1.0)
        };

        // Determine if it passes threshold
        let passes_threshold = if full_similarity.is_some() {
            // For full content, use the lower threshold
            combined_score >= self.body_similarity_threshold
        } else {
            // For title only, use the standard threshold
            combined_score >= self.similarity_threshold
        };

        Ok(SimilarityScore {
            title_similarity,
            full_similarity,
            keyword_boost,
            combined_score,
            passes_threshold,
        })
    }

    /// Find most similar text using enhanced scoring
    pub async fn find_most_similar_enhanced(
        &self,
        query_title: &str,
        query_body: Option<&str>,
        candidates: Vec<(String, String, Option<String>)>, // (id, title, body)
    ) -> Result<Option<(String, SimilarityScore)>> {
        if candidates.is_empty() {
            return Ok(None);
        }

        let mut best_match = None;
        let mut best_score = SimilarityScore {
            title_similarity: 0.0,
            full_similarity: None,
            keyword_boost: 0.0,
            combined_score: 0.0,
            passes_threshold: false,
        };

        for (id, title, body) in candidates {
            let score = self
                .calculate_enhanced_similarity(query_title, query_body, &title, body.as_deref())
                .await?;

            if score.passes_threshold && score.combined_score > best_score.combined_score {
                best_score = score.clone();
                best_match = Some((id, score));
            }
        }

        if let Some((id, score)) = &best_match {
            info!(
                "Found enhanced match: {} with combined score {:.3} (title: {:.3}, full: {:?}, keywords: {:.3})",
                id,
                score.combined_score,
                score.title_similarity,
                score.full_similarity,
                score.keyword_boost
            );
        }

        Ok(best_match)
    }
}
