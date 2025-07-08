use anyhow::{Context, Result};
use fastembed::{
    EmbeddingModel, InitOptions, RerankInitOptions, RerankerModel, TextEmbedding, TextRerank,
};
use redis::aio::ConnectionManager;
use redis::{AsyncCommands, Client};
use std::sync::Arc;
use tracing::{debug, info};

const EMBEDDING_KEY_PREFIX: &str = "mapper:embeddings:";
const EMBEDDING_TTL_SECONDS: i64 = 24 * 60 * 60; // 24 hours

#[derive(Clone)]
pub struct RedisEmbeddingCache {
    /// Redis connection manager for async operations
    redis: ConnectionManager,
    /// The embedding model
    model: Arc<TextEmbedding>,
    /// The reranking model for cross-encoder scoring
    reranker: Arc<TextRerank>,
}

#[derive(Debug, Clone)]
pub struct RankedCandidate {
    pub id: String,
    pub angular_similarity: f32,
    pub rerank_score: f32,
    pub rank: usize,
}

impl RedisEmbeddingCache {
    pub async fn new() -> Result<Self> {
        info!("Initializing Redis-backed embedding cache...");

        // Connect to Redis
        let redis_url =
            std::env::var("REDIS_URL").context("REDIS_URL environment variable not set")?;

        let client = Client::open(redis_url).context("Failed to create Redis client")?;

        let redis = ConnectionManager::new(client)
            .await
            .context("Failed to connect to Redis")?;

        info!("Connected to Redis successfully");

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

        Ok(Self {
            redis,
            model: Arc::new(model),
            reranker: Arc::new(reranker),
        })
    }

    /// Generate embeddings for multiple texts at once
    pub async fn embed_batch(&self, texts: Vec<String>) -> Result<Vec<Vec<f32>>> {
        if texts.is_empty() {
            return Ok(vec![]);
        }

        let mut results = Vec::with_capacity(texts.len());

        // Process each text one by one to avoid memory spikes
        for text in texts {
            let key = format!("{}{}", EMBEDDING_KEY_PREFIX, text);

            // Check Redis cache first
            let cached: Option<Vec<u8>> = self
                .redis
                .clone()
                .get(&key)
                .await
                .context("Failed to query Redis cache")?;

            let embedding = if let Some(bytes) = cached {
                // Deserialize from JSON
                let json_str =
                    std::str::from_utf8(&bytes).context("Failed to parse bytes as UTF-8")?;
                serde_json::from_str(json_str)
                    .context("Failed to deserialize embedding from JSON")?
            } else {
                // Generate embedding for single text
                debug!("Generating embedding for text");

                let embeddings = self
                    .model
                    .embed(vec![text.as_str()], None)
                    .context("Failed to generate embedding")?;

                let embedding = embeddings
                    .into_iter()
                    .next()
                    .context("Failed to get embedding from result")?;

                // Serialize as JSON for better debugging visibility
                let json_str = serde_json::to_string(&embedding)
                    .context("Failed to serialize embedding to JSON")?;

                debug!(
                    "Storing embedding in Redis - key: {}, value_len: {}, ttl: {}s",
                    &key,
                    json_str.len(),
                    EMBEDDING_TTL_SECONDS
                );

                let _: () = self
                    .redis
                    .clone()
                    .set_ex(&key, json_str.as_bytes(), EMBEDDING_TTL_SECONDS as u64)
                    .await
                    .context("Failed to store embedding in Redis")?;

                embedding
            };

            results.push(embedding);
        }

        Ok(results)
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

    /// Find top N candidates using embeddings and reranking
    /// Returns the ranked candidates in order of relevance (best first)
    pub async fn find_top_candidates(
        &self,
        query_title: &str,
        query_body: Option<&str>,
        candidates: Vec<(String, String, Option<String>)>, // (id, title, body)
        top_n: usize,
    ) -> Result<Vec<RankedCandidate>> {
        if candidates.is_empty() {
            return Ok(vec![]);
        }

        // Get query embeddings
        let query_title_embedding = self.embed(query_title).await?;
        let query_body_embedding = if let Some(qb) = query_body {
            Some(self.embed(qb).await?)
        } else {
            None
        };

        // Process candidates in chunks to avoid memory spikes
        const CHUNK_SIZE: usize = 50;
        let mut all_scored_candidates = Vec::new();

        for chunk in candidates.chunks(CHUNK_SIZE) {
            // Prepare texts for this chunk
            let mut title_texts = Vec::new();
            let mut body_texts = Vec::new();
            let mut chunk_has_bodies = Vec::new();

            for (_, title, body) in chunk {
                title_texts.push(title.clone());
                if let Some(body_text) = body {
                    body_texts.push(body_text.clone());
                    chunk_has_bodies.push(true);
                } else {
                    chunk_has_bodies.push(false);
                }
            }

            // Get embeddings for this chunk
            let title_embeddings = self.embed_batch(title_texts).await?;
            let body_embeddings = if !body_texts.is_empty() {
                Some(self.embed_batch(body_texts).await?)
            } else {
                None
            };

            // Score candidates in this chunk
            let mut body_idx = 0;
            for (i, (id, _title, body)) in chunk.iter().enumerate() {
                // Title similarity
                let title_sim =
                    Self::angular_similarity(&query_title_embedding, &title_embeddings[i]);

                // Body similarity (if both have bodies)
                let body_sim =
                    if body.is_some() && query_body_embedding.is_some() && chunk_has_bodies[i] {
                        let sim = Self::angular_similarity(
                            query_body_embedding.as_ref().unwrap(),
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

                all_scored_candidates.push((id.clone(), combined_score));
            }
        }

        // Sort by combined score and take top candidates for reranking
        all_scored_candidates.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        let rerank_count = top_n.max(20).min(all_scored_candidates.len());
        let rerank_candidates = all_scored_candidates
            .iter()
            .take(rerank_count)
            .collect::<Vec<_>>();

        if rerank_candidates.is_empty() {
            return Ok(vec![]);
        }

        // Prepare documents for reranking
        let mut documents = Vec::new();
        let mut candidate_map = std::collections::HashMap::new();
        
        for (id, angular_score) in &rerank_candidates {
            // Find the original candidate data
            let original = candidates.iter().find(|(cid, _, _)| cid == id).unwrap();
            let doc = if let Some(b) = &original.2 {
                format!("{}\n\n{}", original.1, b)
            } else {
                original.1.clone()
            };
            documents.push(doc);
            candidate_map.insert(id.clone(), *angular_score);
        }

        let query_full = if let Some(qb) = query_body {
            format!("{}\n\n{}", query_title, qb)
        } else {
            query_title.to_string()
        };

        let document_refs: Vec<&String> = documents.iter().collect();

        // Rerank and get scores for all candidates
        let rerank_results = self
            .reranker
            .rerank(&query_full, document_refs, true, None) // Return all with scores
            .context("Failed to rerank candidates")?;

        // Build final ranked list
        let mut ranked_candidates = Vec::new();
        for (rank, result) in rerank_results.iter().take(top_n).enumerate() {
            let idx = result.index;
            let (id, _) = &rerank_candidates[idx];
            let angular_score = candidate_map[id];

            ranked_candidates.push(RankedCandidate {
                id: id.clone(),
                angular_similarity: angular_score,
                rerank_score: result.score as f32,
                rank: rank + 1,
            });
        }

        info!(
            "Reranked {} candidates, returning top {}",
            rerank_candidates.len(),
            ranked_candidates.len()
        );

        Ok(ranked_candidates)
    }

    /// Get cache statistics
    pub async fn cache_stats(&self) -> Result<(usize, usize)> {
        // Count keys in Redis
        let keys: Vec<String> = self
            .redis
            .clone()
            .keys(format!("{}*", EMBEDDING_KEY_PREFIX))
            .await
            .context("Failed to query Redis keys")?;

        let entries = keys.len();
        let memory_estimate = entries * 1024 * 4; // BGELargeENV15 has 1024 dimensions * 4 bytes per float
        Ok((entries, memory_estimate))
    }

    /// Clear the cache
    pub async fn clear_cache(&self) -> Result<()> {
        let keys: Vec<String> = self
            .redis
            .clone()
            .keys(format!("{}*", EMBEDDING_KEY_PREFIX))
            .await
            .context("Failed to query Redis keys")?;

        if !keys.is_empty() {
            let _: () = self
                .redis
                .clone()
                .del(keys)
                .await
                .context("Failed to delete keys from Redis")?;
        }

        info!("Cleared Redis embedding cache");
        Ok(())
    }
}