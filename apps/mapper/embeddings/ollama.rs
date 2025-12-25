use anyhow::{Context, Result};
use ollama_rs::{generation::embeddings::request::GenerateEmbeddingsRequest, Ollama};
use once_cell::sync::Lazy;
use scraper::Html;
use sha2::{Digest, Sha256};
use std::sync::Mutex;
use tokenizers::Tokenizer;
use tracing::{info, warn};

/// Default embedding model
const DEFAULT_MODEL: &str = "nomic-embed-text";

/// Default batch size for embedding generation
const DEFAULT_BATCH_SIZE: usize = 32;

/// Expected embedding dimension for nomic-embed-text
pub const EMBEDDING_DIMENSION: usize = 768;

/// Maximum tokens for nomic-embed-text (Ollama defaults to 2048 context)
const MAX_TOKENS: usize = 2048;

/// BERT tokenizer for nomic-embed-text (uses bert-base-uncased tokenizer)
static TOKENIZER: Lazy<Mutex<Option<Tokenizer>>> = Lazy::new(|| {
    match Tokenizer::from_pretrained("bert-base-uncased", None) {
        Ok(tokenizer) => {
            info!("BERT tokenizer loaded successfully");
            Mutex::new(Some(tokenizer))
        }
        Err(e) => {
            warn!(error = %e, "Failed to load BERT tokenizer, falling back to character-based truncation");
            Mutex::new(None)
        }
    }
});

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
        // Ensure host has a protocol prefix
        let host = if !host.starts_with("http://") && !host.starts_with("https://") {
            format!("http://{}", host)
        } else {
            host
        };
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

        let embedding = response
            .embeddings
            .into_iter()
            .next()
            .context("No embedding returned")?;

        // Validate embedding dimension
        if embedding.len() != EMBEDDING_DIMENSION {
            anyhow::bail!(
                "Embedding dimension mismatch: expected {}, got {}",
                EMBEDDING_DIMENSION,
                embedding.len()
            );
        }

        Ok(embedding)
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

/// Strip HTML tags and normalize whitespace
pub fn strip_html(html: &str) -> String {
    let document = Html::parse_document(html);
    document
        .root_element()
        .text()
        .collect::<Vec<_>>()
        .join(" ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Prepare proposal text for embedding
/// Uses token-based truncation to fit within nomic-embed-text's 2048 token limit
pub fn prepare_proposal_text(name: &str, body: &str, description: Option<&str>) -> String {
    let desc = description.unwrap_or("");
    // Format the text first, then truncate to fit token limit
    let full_text = format!(
        "Title: {}\n\nDescription: {}\n\nBody: {}",
        name, desc, body
    );
    truncate_to_tokens(&full_text, MAX_TOKENS)
}

/// Prepare topic text for embedding
/// Uses token-based truncation to fit within nomic-embed-text's 2048 token limit
pub fn prepare_topic_text(title: &str, first_post_content: Option<&str>) -> String {
    let content = first_post_content.unwrap_or("");
    // Format the text first, then truncate to fit token limit
    let full_text = format!("Title: {}\n\nContent: {}", title, content);
    truncate_to_tokens(&full_text, MAX_TOKENS)
}

/// Truncate text to fit within max_tokens using BERT tokenizer
/// Falls back to character-based truncation if tokenizer unavailable
fn truncate_to_tokens(text: &str, max_tokens: usize) -> String {
    // Try to use the BERT tokenizer
    if let Ok(guard) = TOKENIZER.lock() {
        if let Some(ref tokenizer) = *guard {
            // Encode the text
            if let Ok(encoding) = tokenizer.encode(text, false) {
                let token_count = encoding.get_ids().len();
                if token_count <= max_tokens {
                    return text.to_string();
                }

                // Truncate tokens and decode back
                let truncated_ids: Vec<u32> = encoding.get_ids()[..max_tokens].to_vec();
                if let Ok(decoded) = tokenizer.decode(&truncated_ids, true) {
                    return decoded;
                }
            }
        }
    }

    // Fallback: character-based truncation (~4 chars per token for English)
    let max_chars = max_tokens * 4;
    truncate_text_by_chars(text, max_chars).to_string()
}

/// Truncate text to approximately max_chars bytes, breaking at word boundaries
fn truncate_text_by_chars(text: &str, max_chars: usize) -> &str {
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
    fn test_truncate_text_by_chars() {
        let short = "short text";
        assert_eq!(truncate_text_by_chars(short, 100), short);

        let long = "this is a longer text that needs to be truncated at word boundaries";
        let truncated = truncate_text_by_chars(long, 30);
        assert!(truncated.len() <= 30);
        assert!(!truncated.ends_with(char::is_whitespace));
    }

    #[test]
    fn test_truncate_text_non_ascii() {
        let text = "a\u{00E9}b".repeat(3000);
        let truncated = truncate_text_by_chars(&text, 6000);
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
        let text = prepare_topic_text("Discussion Title", Some("First post content here"));
        assert!(text.contains("Title: Discussion Title"));
        assert!(text.contains("Content: First post content here"));
    }

    #[test]
    fn test_strip_html() {
        let html = "<p>Hello <strong>world</strong>!</p><br><div>More text</div>";
        let stripped = strip_html(html);
        assert_eq!(stripped, "Hello world ! More text");
    }

    #[test]
    fn test_truncate_to_tokens_short_text() {
        // Short text should not be truncated
        let text = "Hello, this is a short text.";
        let result = truncate_to_tokens(text, 100);
        assert_eq!(result, text);
    }
}
