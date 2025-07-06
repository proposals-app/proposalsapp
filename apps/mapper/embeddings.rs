use anyhow::{Context, Result};
use fastembed::{
    EmbeddingModel, InitOptions, RerankInitOptions, RerankerModel, TextEmbedding, TextRerank,
};
use regex::Regex;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

#[derive(Clone)]
pub struct EmbeddingCache {
    /// Map from text to its embedding vector
    cache: Arc<RwLock<HashMap<String, Vec<f32>>>>,
    /// The embedding model
    model: Arc<TextEmbedding>,
    /// The reranking model for cross-encoder scoring
    reranker: Arc<TextRerank>,
    /// Angular similarity threshold for matching (title-only)
    similarity_threshold: f32,
    /// Lower threshold for title+body matching
    body_similarity_threshold: f32,
}

#[derive(Debug, Clone)]
pub struct SimilarityScore {
    pub title_similarity: f32,
    pub body_similarity: Option<f32>,
    pub combined_score: f32,
    pub passes_threshold: bool,
    pub rerank_score: Option<f32>, // Cross-encoder score if available
}

impl EmbeddingCache {
    pub async fn new(similarity_threshold: f32) -> Result<Self> {
        info!("Initializing embedding model...");

        // Initialize the embedding model - BGELargeENV15 for best accuracy
        let model = TextEmbedding::try_new(
            InitOptions::new(EmbeddingModel::BGELargeENV15).with_show_download_progress(true),
        )
        .context("Failed to initialize embedding model")?;

        // Initialize the reranking model - BGERerankerV2M3 for best multilingual accuracy
        let reranker = TextRerank::try_new(
            RerankInitOptions::new(RerankerModel::BGERerankerV2M3)
                .with_show_download_progress(true),
        )
        .context("Failed to initialize reranking model")?;

        info!("Embedding and reranking models initialized successfully");

        // Set body threshold lower than title threshold
        let body_similarity_threshold = 0.65f32;

        Ok(Self {
            cache: Arc::new(RwLock::new(HashMap::new())),
            model: Arc::new(model),
            reranker: Arc::new(reranker),
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

    /// Calculate angular similarity (more mathematically sound than cosine)
    pub fn angular_similarity(a: &[f32], b: &[f32]) -> f32 {
        let cosine_sim = Self::cosine_similarity(a, b);
        // Convert cosine similarity to angular similarity
        // angular_distance = arccos(cosine_sim) / π
        // angular_similarity = 1 - angular_distance
        1.0 - (cosine_sim.clamp(-1.0, 1.0).acos() / std::f32::consts::PI)
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

    /// Find the most similar text from a list of candidates (backward compatibility)
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

        // Find most similar using angular similarity
        let mut best_match = None;
        let mut best_similarity = 0.0;

        for (i, (id, _)) in candidates.iter().enumerate() {
            let similarity = Self::angular_similarity(query_embedding, &embeddings[i + 1]);

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

    /// Enhanced similarity calculation with separate title and body scoring
    pub async fn find_most_similar_enhanced(
        &self,
        query_title: &str,
        query_body: Option<&str>,
        candidates: Vec<(String, String, Option<String>)>, // (id, title, body)
    ) -> Result<Option<(String, SimilarityScore)>> {
        if candidates.is_empty() {
            return Ok(None);
        }

        // Normalize query title
        let norm_query_title = Self::normalize_proposal_text(query_title);

        // Stage 1: Calculate embeddings for all titles and bodies
        let mut title_texts = vec![norm_query_title.clone()];
        let mut body_texts = Vec::new();
        let mut has_bodies = Vec::new();

        for (_, title, body) in &candidates {
            title_texts.push(Self::normalize_proposal_text(title));
            if let Some(body_text) = body {
                body_texts.push(body_text.clone());
                has_bodies.push(true);
            } else {
                has_bodies.push(false);
            }
        }

        // Add query body if present
        if let Some(qb) = query_body {
            body_texts.insert(0, qb.to_string());
        }

        // Batch embed all titles
        let title_embeddings = self.embed_batch(title_texts).await?;
        let query_title_embedding = &title_embeddings[0];

        // Batch embed all bodies (if any)
        let body_embeddings = if !body_texts.is_empty() {
            Some(self.embed_batch(body_texts).await?)
        } else {
            None
        };

        let query_body_embedding = if query_body.is_some() && body_embeddings.is_some() {
            body_embeddings.as_ref().map(|be| &be[0])
        } else {
            None
        };

        // Calculate similarities for all candidates
        let mut scored_candidates = Vec::new();
        let mut body_idx = if query_body.is_some() { 1 } else { 0 };

        for (i, (id, title, body)) in candidates.iter().enumerate() {
            // Title similarity
            let title_sim = Self::angular_similarity(query_title_embedding, &title_embeddings[i + 1]);

            // Body similarity (if both have bodies)
            let body_sim = if body.is_some() && query_body_embedding.is_some() && has_bodies[i] {
                let sim = Self::angular_similarity(
                    query_body_embedding.unwrap(),
                    &body_embeddings.as_ref().unwrap()[body_idx],
                );
                body_idx += 1;
                Some(sim)
            } else {
                None
            };

            // Calculate combined score
            let combined_score = if let Some(bs) = body_sim {
                // If we have both, weight them equally
                0.5 * title_sim + 0.5 * bs
            } else {
                // Title only
                title_sim
            };

            scored_candidates.push((
                i,
                id.clone(),
                title_sim,
                body_sim,
                combined_score,
                title.clone(),
                body.clone(),
            ));
        }

        // Sort by combined score and take top candidates for reranking
        scored_candidates.sort_by(|a, b| b.4.partial_cmp(&a.4).unwrap());
        let top_k = 20.min(candidates.len());
        let rerank_candidates = scored_candidates.iter().take(top_k).collect::<Vec<_>>();

        if rerank_candidates.is_empty() {
            return Ok(None);
        }

        // Stage 2: Rerank top candidates with cross-encoder
        let mut documents = Vec::new();
        for (_, _, _, _, _, title, body) in &rerank_candidates {
            let doc = if let Some(b) = body {
                format!("{}\n\n{}", title, b)
            } else {
                title.to_string()
            };
            documents.push(doc);
        }

        let query_full = if let Some(qb) = query_body {
            format!("{}\n\n{}", query_title, qb)
        } else {
            query_title.to_string()
        };

        let document_refs: Vec<&String> = documents.iter().collect();

        // Rerank and get scores
        let rerank_results = self
            .reranker
            .rerank(&query_full, document_refs, false, Some(1))
            .context("Failed to rerank candidates")?;

        if let Some(best_result) = rerank_results.first() {
            let best_idx = best_result.index;
            let (_, id, title_sim, body_sim, _, _, _) = &rerank_candidates[best_idx];

            let threshold = if body_sim.is_some() {
                self.body_similarity_threshold
            } else {
                self.similarity_threshold
            };

            let score = SimilarityScore {
                title_similarity: *title_sim,
                body_similarity: *body_sim,
                combined_score: best_result.score as f32,
                passes_threshold: best_result.score as f32 >= threshold,
                rerank_score: Some(best_result.score as f32),
            };

            info!(
                "Found best match via reranking: {} (title: {:.3}, body: {:?}, rerank: {:.3})",
                id, title_sim, body_sim, best_result.score
            );

            Ok(Some((id.clone(), score)))
        } else {
            Ok(None)
        }
    }

    /// Calculate enhanced similarity between two items
    pub async fn calculate_enhanced_similarity(
        &self,
        item1_title: &str,
        item1_body: Option<&str>,
        item2_title: &str,
        item2_body: Option<&str>,
    ) -> Result<SimilarityScore> {
        // Normalize titles
        let norm_title1 = Self::normalize_proposal_text(item1_title);
        let norm_title2 = Self::normalize_proposal_text(item2_title);

        // Check for exact match
        if norm_title1 == norm_title2 {
            return Ok(SimilarityScore {
                title_similarity: 1.0,
                body_similarity: Some(1.0),
                combined_score: 1.0,
                passes_threshold: true,
                rerank_score: Some(1.0),
            });
        }

        // Calculate title similarity
        let title1_embedding = self.embed(&norm_title1).await?;
        let title2_embedding = self.embed(&norm_title2).await?;
        let title_similarity = Self::angular_similarity(&title1_embedding, &title2_embedding);

        // Calculate body similarity if both bodies are provided
        let body_similarity = if let (Some(body1), Some(body2)) = (item1_body, item2_body) {
            let body1_embedding = self.embed(body1).await?;
            let body2_embedding = self.embed(body2).await?;
            Some(Self::angular_similarity(&body1_embedding, &body2_embedding))
        } else {
            None
        };

        // Calculate combined score
        let combined_score = if let Some(body_sim) = body_similarity {
            // If we have both, weight them equally
            0.5 * title_similarity + 0.5 * body_sim
        } else {
            // Title only
            title_similarity
        };

        // Use cross-encoder for final verification if score is close to threshold
        let rerank_score = if combined_score >= 0.5 && combined_score <= 0.8 {
            let full1 = if let Some(body) = item1_body {
                format!("{}\n\n{}", item1_title, body)
            } else {
                item1_title.to_string()
            };

            let full2 = if let Some(body) = item2_body {
                format!("{}\n\n{}", item2_title, body)
            } else {
                item2_title.to_string()
            };

            match self.reranker.rerank(&full1, vec![&full2], false, None) {
                Ok(results) => results.first().map(|r| r.score as f32),
                Err(e) => {
                    warn!("Reranking failed: {}", e);
                    None
                }
            }
        } else {
            None
        };

        // Use rerank score if available and significantly different
        let final_score = if let Some(rs) = rerank_score {
            if (rs - combined_score).abs() > 0.1 {
                rs
            } else {
                combined_score
            }
        } else {
            combined_score
        };

        let threshold = if body_similarity.is_some() {
            self.body_similarity_threshold
        } else {
            self.similarity_threshold
        };

        Ok(SimilarityScore {
            title_similarity,
            body_similarity,
            combined_score: final_score,
            passes_threshold: final_score >= threshold,
            rerank_score,
        })
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
        let memory_estimate = entries * 1024 * 4; // BGELargeENV15 has 1024 dimensions * 4 bytes per float
        (entries, memory_estimate)
    }

    /// Get the body similarity threshold
    pub fn get_body_similarity_threshold(&self) -> f32 {
        self.body_similarity_threshold
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
            r"^AIP:\s*",
            r"^AIP-\d+:\s*",
            r"^\[AIP-\d+\]\s*",
            r"^Non-Constitutional:\s*",
            r"^Constitutional:\s*",
            r"^Temperature Check:\s*",
            r"^\[Temperature Check\]\s*",
            r"^FINAL:\s*",
            r"^\[FINAL\]\s*",
            r"^ARDC:\s*",
            r"^RFC:\s*",
            r"^Proposal to\s+",
            r"^Motion to\s+",
        ];

        for prefix in &prefixes {
            let re = Regex::new(prefix).unwrap();
            normalized = re.replace(&normalized, "").to_string();
        }

        normalized.trim().to_string()
    }

    /// Pre-compute embeddings for a batch of items (for optimization)
    pub async fn precompute_embeddings(
        &self,
        items: Vec<(String, String, Option<String>)>, // (id, title, body)
    ) -> Result<HashMap<String, (Vec<f32>, Option<Vec<f32>>)>> {
        let mut result = HashMap::new();

        // Prepare all titles
        let titles: Vec<String> = items
            .iter()
            .map(|(_, title, _)| Self::normalize_proposal_text(title))
            .collect();

        // Prepare all bodies
        let bodies: Vec<Option<String>> = items
            .iter()
            .map(|(_, _, body)| body.clone())
            .collect();

        // Batch embed titles
        let title_embeddings = self.embed_batch(titles).await?;

        // Batch embed bodies (only non-None ones)
        let mut body_texts = Vec::new();
        let mut body_indices = Vec::new();
        for (i, body) in bodies.iter().enumerate() {
            if let Some(b) = body {
                body_texts.push(b.clone());
                body_indices.push(i);
            }
        }

        let body_embeddings = if !body_texts.is_empty() {
            Some(self.embed_batch(body_texts).await?)
        } else {
            None
        };

        // Store results
        let mut body_embed_idx = 0;
        for (i, (id, _, _)) in items.into_iter().enumerate() {
            let title_embedding = title_embeddings[i].clone();
            let body_embedding = if bodies[i].is_some() {
                let embed = body_embeddings.as_ref().unwrap()[body_embed_idx].clone();
                body_embed_idx += 1;
                Some(embed)
            } else {
                None
            };

            result.insert(id, (title_embedding, body_embedding));
        }

        Ok(result)
    }
}