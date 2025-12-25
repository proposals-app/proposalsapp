use anyhow::{Context, Result};
use ollama_rs::{generation::embeddings::request::GenerateEmbeddingsRequest, Ollama};
use sha2::{Digest, Sha256};
use tracing::{info, warn};

/// Default embedding model
const DEFAULT_MODEL: &str = "nomic-embed-text";

/// Default batch size for embedding generation
const DEFAULT_BATCH_SIZE: usize = 32;

/// Expected embedding dimension for nomic-embed-text
pub const EMBEDDING_DIMENSION: usize = 768;

/// Wrapper around Ollama client for generating embeddings
pub struct OllamaEmbedder {
    client: Ollama,
    model: String,
    batch_size: usize,
}

impl OllamaEmbedder {
    /// Create a new embedder with default settings
    pub fn new() -> Self {
        let host = std::env::var("OLLAMA_HOST").unwrap_or_else(|_| "http://localhost".to_string());
        let port = std::env::var("OLLAMA_PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(11434);
        let model =
            std::env::var("OLLAMA_EMBEDDING_MODEL").unwrap_or_else(|_| DEFAULT_MODEL.to_string());
        let batch_size = std::env::var("OLLAMA_BATCH_SIZE")
            .ok()
            .and_then(|b| b.parse().ok())
            .unwrap_or(DEFAULT_BATCH_SIZE);

        info!(
            host = %host,
            port = port,
            model = %model,
            batch_size = batch_size,
            "Initializing Ollama embedder"
        );

        Self {
            client: Ollama::new(host, port),
            model,
            batch_size,
        }
    }

    /// Create an embedder with custom configuration
    pub fn with_config(host: String, port: u16, model: String, batch_size: usize) -> Self {
        Self {
            client: Ollama::new(host, port),
            model,
            batch_size,
        }
    }

    /// Get the model version string
    pub fn model_version(&self) -> &str {
        &self.model
    }

    /// Get the configured batch size
    pub fn batch_size(&self) -> usize {
        self.batch_size
    }

    /// Generate embedding for a single text
    pub async fn embed_single(&self, text: &str) -> Result<Vec<f32>> {
        let request =
            GenerateEmbeddingsRequest::new(self.model.clone(), vec![text.to_string()].into());

        let response = self
            .client
            .generate_embeddings(request)
            .await
            .context("Failed to generate embedding")?;

        response
            .embeddings
            .into_iter()
            .next()
            .context("No embedding returned")
    }

    /// Generate embeddings for a batch of texts
    pub async fn embed_batch(&self, texts: Vec<String>) -> Result<Vec<Vec<f32>>> {
        if texts.is_empty() {
            return Ok(vec![]);
        }

        let request = GenerateEmbeddingsRequest::new(self.model.clone(), texts.clone().into());

        let response = self
            .client
            .generate_embeddings(request)
            .await
            .context("Failed to generate batch embeddings")?;

        if response.embeddings.len() != texts.len() {
            warn!(
                expected = texts.len(),
                got = response.embeddings.len(),
                "Embedding count mismatch"
            );
        }

        Ok(response.embeddings)
    }

    /// Process texts in batches and return all embeddings
    pub async fn embed_all(&self, texts: Vec<String>) -> Result<Vec<Vec<f32>>> {
        let mut all_embeddings = Vec::with_capacity(texts.len());

        for chunk in texts.chunks(self.batch_size) {
            let embeddings = self.embed_batch(chunk.to_vec()).await?;
            all_embeddings.extend(embeddings);
        }

        Ok(all_embeddings)
    }
}

/// Compute SHA256 hash of content for change detection
pub fn hash_content(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Prepare proposal text for embedding
pub fn prepare_proposal_text(name: &str, body: &str, description: Option<&str>) -> String {
    let desc = description.unwrap_or("");
    let truncated_body = truncate_text(body, 6000);

    format!(
        "Title: {}\n\nDescription: {}\n\nBody: {}",
        name, desc, truncated_body
    )
}

/// Prepare topic text for embedding
pub fn prepare_topic_text(title: &str, excerpt: Option<&str>) -> String {
    let exc = excerpt.unwrap_or("");
    format!("Title: {}\n\nExcerpt: {}", title, exc)
}

/// Truncate text to approximately max_chars bytes, breaking at word boundaries
fn truncate_text(text: &str, max_chars: usize) -> &str {
    if text.len() <= max_chars {
        return text;
    }

    // Find a good break point (word boundary)
    let mut end = max_chars.min(text.len());
    while end > 0 && !text.is_char_boundary(end) {
        end -= 1;
    }

    if end == 0 {
        return "";
    }

    let truncated = &text[..end];
    if let Some(last_space) = truncated.rfind(char::is_whitespace) {
        &text[..last_space]
    } else {
        truncated
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_content() {
        let hash1 = hash_content("hello world");
        let hash2 = hash_content("hello world");
        let hash3 = hash_content("different content");

        assert_eq!(hash1, hash2);
        assert_ne!(hash1, hash3);
        assert_eq!(hash1.len(), 64); // SHA256 hex is 64 chars
    }

    #[test]
    fn test_truncate_text() {
        let short = "short text";
        assert_eq!(truncate_text(short, 100), short);

        let long = "this is a longer text that needs to be truncated at word boundaries";
        let truncated = truncate_text(long, 30);
        assert!(truncated.len() <= 30);
        assert!(!truncated.ends_with(char::is_whitespace));
    }

    #[test]
    fn test_truncate_text_non_ascii() {
        let text = "a\u{00E9}b".repeat(3000);
        let truncated = truncate_text(&text, 6000);
        assert!(truncated.len() <= 6000);
        assert!(text.starts_with(truncated));
    }

    #[test]
    fn test_prepare_proposal_text() {
        let text = prepare_proposal_text("My Proposal", "The body text", Some("A description"));
        assert!(text.contains("Title: My Proposal"));
        assert!(text.contains("Description: A description"));
        assert!(text.contains("Body: The body text"));
    }

    #[test]
    fn test_prepare_topic_text() {
        let text = prepare_topic_text("Discussion Title", Some("Brief excerpt"));
        assert!(text.contains("Title: Discussion Title"));
        assert!(text.contains("Excerpt: Brief excerpt"));
    }
}
