use anyhow::{Context, Result};
use fastembed::{
    EmbeddingModel, InitOptions, RerankInitOptions, RerankerModel, TextEmbedding, TextRerank,
};
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

        // Use query title directly
        let norm_query_title = query_title.to_string();

        // Stage 1: Calculate embeddings for all titles and bodies
        let mut title_texts = vec![norm_query_title.clone()];
        let mut body_texts = Vec::new();
        let mut has_bodies = Vec::new();

        for (_, title, body) in &candidates {
            title_texts.push(title.clone());
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
            let title_sim =
                Self::angular_similarity(query_title_embedding, &title_embeddings[i + 1]);

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
}
