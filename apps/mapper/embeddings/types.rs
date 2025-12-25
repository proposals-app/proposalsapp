use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Type of entity that has an embedding
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EntityType {
    Proposal,
    Topic,
}

impl EntityType {
    pub fn as_str(&self) -> &'static str {
        match self {
            EntityType::Proposal => "proposal",
            EntityType::Topic => "topic",
        }
    }
}

impl std::fmt::Display for EntityType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// An embedding entity stored in the database
#[derive(Debug, Clone)]
pub struct EmbeddingEntity {
    pub id: Uuid,
    pub entity_type: EntityType,
    pub entity_id: Uuid,
    pub external_id: String,
    pub embedding: Vec<f32>,
    pub content_hash: String,
    pub model_version: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

/// Result of a similarity search
#[derive(Debug, Clone)]
pub struct SimilarityMatch {
    pub entity_id: Uuid,
    pub external_id: String,
    pub similarity: f32,
}

/// Input for creating or updating an embedding
#[derive(Debug, Clone)]
pub struct EmbeddingInput {
    pub entity_type: EntityType,
    pub entity_id: Uuid,
    pub external_id: String,
    pub embedding: Vec<f32>,
    pub content_hash: String,
    pub model_version: String,
}
