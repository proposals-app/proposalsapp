//! Embeddings module for semantic similarity matching
//!
//! This module provides:
//! - Ollama client for generating embeddings via nomic-embed-text
//! - PostgreSQL storage using pgvector for similarity search
//! - Content hashing for incremental updates

#![allow(dead_code)]

mod ollama;
mod store;
mod types;

pub use ollama::{hash_content, prepare_proposal_text, prepare_topic_text, strip_html, OllamaEmbedder};
pub use store::EmbeddingStore;
pub use types::{EmbeddingInput, EntityType};
