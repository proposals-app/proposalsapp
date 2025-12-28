use crate::embeddings::{
    hash_content, prepare_proposal_text, prepare_topic_text, strip_html, EmbeddingInput,
    EmbeddingStore, EntityType, OllamaEmbedder,
};
use anyhow::{Context, Result};
use proposalsapp_db::models::*;
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, sea_query};
use std::collections::{HashMap, HashSet};
use tracing::{info, warn};
use utils::types::{ProposalGroupItem, ProposalItem};
use uuid::Uuid;

/// Result of a semantic match
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct SemanticMatchResult {
    pub proposal_id: Uuid,
    pub proposal_external_id: String,
    pub proposal_name: String,
    pub topic_id: Uuid,
    pub topic_external_id: String,
    pub similarity_score: f32,
    pub governor_id: Uuid,
}

/// Semantic grouper that uses embeddings to match proposals to topics
#[allow(dead_code)]
pub struct SemanticGrouper {
    db: DatabaseConnection,
    embedder: OllamaEmbedder,
    store: EmbeddingStore,
    similarity_threshold: f32,
}

impl SemanticGrouper {
    /// Create a new semantic grouper
    pub fn new(db: DatabaseConnection) -> Self {
        let threshold = std::env::var("SEMANTIC_SIMILARITY_THRESHOLD")
            .ok()
            .and_then(|t| t.parse().ok())
            .unwrap_or(0.75);

        Self {
            embedder: OllamaEmbedder::new(),
            store: EmbeddingStore::with_threshold(db.clone(), threshold),
            db,
            similarity_threshold: threshold,
        }
    }

    /// Index all topics for a DAO that don't have embeddings yet
    pub async fn index_topics(&self, dao_id: Uuid) -> Result<usize> {
        // Get DAO discourse info
        let dao_discourse = dao_discourse::Entity::find()
            .filter(dao_discourse::Column::DaoId.eq(dao_id))
            .one(&self.db)
            .await
            .context("Failed to load DAO discourse")?;

        let Some(dao_discourse) = dao_discourse else {
            info!(dao_id = %dao_id, "No discourse configured for DAO, skipping topic indexing");
            return Ok(0);
        };

        // Get all topics for this DAO
        let topics = discourse_topic::Entity::find()
            .filter(discourse_topic::Column::DaoDiscourseId.eq(dao_discourse.id))
            .filter(discourse_topic::Column::Closed.eq(false))
            .filter(discourse_topic::Column::Archived.eq(false))
            .filter(discourse_topic::Column::Visible.eq(true))
            .all(&self.db)
            .await
            .context("Failed to load topics")?;

        if topics.is_empty() {
            return Ok(0);
        }

        // Get existing embeddings
        let existing_hashes = self
            .store
            .get_content_hashes(EntityType::Topic, &topics.iter().map(|t| t.id).collect::<Vec<_>>())
            .await?;

        // Batch load all first posts for topics (fixes N+1 query)
        let topic_ids: Vec<i32> = topics.iter().map(|t| t.external_id).collect();
        let first_posts: HashMap<i32, discourse_post::Model> = discourse_post::Entity::find()
            .filter(discourse_post::Column::TopicId.is_in(topic_ids))
            .filter(discourse_post::Column::DaoDiscourseId.eq(dao_discourse.id))
            .filter(discourse_post::Column::PostNumber.eq(1))
            .filter(discourse_post::Column::Deleted.eq(false))
            .all(&self.db)
            .await
            .context("Failed to batch load first posts")?
            .into_iter()
            .map(|p| (p.topic_id, p))
            .collect();

        let model_version = self.embedder.model_version().to_string();
        let mut indexed_count = 0;

        // Process topics that need embedding
        for topic in &topics {
            // Get first post from batch-loaded map
            let first_post = first_posts.get(&topic.external_id);

            // Extract and strip HTML from cooked field
            let post_content = first_post
                .and_then(|p| p.cooked.as_ref())
                .map(|html| strip_html(html))
                .unwrap_or_default();

            let text = prepare_topic_text(&topic.title, Some(&post_content));
            let content_hash = hash_content(&text);

            // Skip if already indexed with same content
            if let Some(existing_hash) = existing_hashes.get(&topic.id)
                && existing_hash == &content_hash
            {
                continue;
            }

            // Generate embedding
            let embedding = self.embedder.embed_single(&text).await?;

            // Store embedding
            self.store
                .upsert_embedding(EmbeddingInput {
                    entity_type: EntityType::Topic,
                    entity_id: topic.id,
                    external_id: topic.external_id.to_string(),
                    embedding,
                    content_hash,
                    model_version: model_version.clone(),
                })
                .await?;

            indexed_count += 1;
        }

        info!(
            dao_id = %dao_id,
            total_topics = topics.len(),
            indexed = indexed_count,
            "Indexed topics"
        );

        Ok(indexed_count)
    }

    /// Find semantic matches for proposals that don't have URL matches
    pub async fn find_semantic_matches(
        &self,
        dao_id: Uuid,
        url_matched_proposal_ids: &HashSet<String>,
    ) -> Result<Vec<SemanticMatchResult>> {
        // Get all proposals for this DAO
        let governors = dao_governor::Entity::find()
            .filter(dao_governor::Column::DaoId.eq(dao_id))
            .all(&self.db)
            .await
            .context("Failed to load governors")?;

        let governor_ids: Vec<Uuid> = governors.iter().map(|g| g.id).collect();

        if governor_ids.is_empty() {
            return Ok(vec![]);
        }

        let proposals = proposal::Entity::find()
            .filter(proposal::Column::GovernorId.is_in(governor_ids))
            .order_by_asc(proposal::Column::CreatedAt)
            .all(&self.db)
            .await
            .context("Failed to load proposals")?;

        // Filter to only unmatched proposals
        let unmatched_proposals: Vec<_> = proposals
            .into_iter()
            .filter(|p| {
                let item_id = format!("proposal_{}", p.external_id);
                !url_matched_proposal_ids.contains(&item_id)
            })
            .collect();

        info!(
            dao_id = %dao_id,
            total_unmatched = unmatched_proposals.len(),
            "Finding semantic matches for unmatched proposals"
        );

        let mut matches = Vec::new();
        let model_version = self.embedder.model_version().to_string();

        for proposal in unmatched_proposals {
            // Prepare text and generate embedding
            let text = prepare_proposal_text(&proposal.name, &proposal.body, None);
            let embedding = self.embedder.embed_single(&text).await?;

            // Store the proposal embedding for future use
            let content_hash = hash_content(&text);
            self.store
                .upsert_embedding(EmbeddingInput {
                    entity_type: EntityType::Proposal,
                    entity_id: proposal.id,
                    external_id: proposal.external_id.clone(),
                    embedding: embedding.clone(),
                    content_hash,
                    model_version: model_version.clone(),
                })
                .await?;

            // Search for similar topics
            let similar_topics = match self
                .store
                .find_similar_for_dao(&embedding, EntityType::Topic, dao_id, 1)
                .await
            {
                Ok(topics) => topics,
                Err(e) => {
                    warn!(
                        proposal_id = %proposal.id,
                        proposal_name = %proposal.name,
                        error = %e,
                        error_chain = ?e,
                        "Failed to find similar topics for proposal"
                    );
                    return Err(e);
                }
            };

            // Take the best match if above threshold
            if let Some(best_match) = similar_topics.first() {
                info!(
                    proposal_id = %proposal.id,
                    proposal_name = %proposal.name,
                    topic_external_id = %best_match.external_id,
                    similarity = best_match.similarity,
                    "Found semantic match"
                );

                matches.push(SemanticMatchResult {
                    proposal_id: proposal.id,
                    proposal_external_id: proposal.external_id.clone(),
                    proposal_name: proposal.name.clone(),
                    topic_id: best_match.entity_id,
                    topic_external_id: best_match.external_id.clone(),
                    similarity_score: best_match.similarity,
                    governor_id: proposal.governor_id,
                });
            }
        }

        info!(
            dao_id = %dao_id,
            matches_found = matches.len(),
            "Semantic matching complete"
        );

        Ok(matches)
    }

    /// Apply semantic matches to proposal groups
    pub async fn apply_matches(
        &self,
        matches: Vec<SemanticMatchResult>,
        dao_id: Uuid,
    ) -> Result<usize> {
        if matches.is_empty() {
            return Ok(0);
        }

        // Load existing groups
        let existing_groups = proposal_group::Entity::find()
            .filter(proposal_group::Column::DaoId.eq(dao_id))
            .all(&self.db)
            .await
            .context("Failed to load existing groups")?;

        // Build a map of topic external_id -> group
        let mut topic_to_group: HashMap<String, (Uuid, Vec<ProposalGroupItem>)> = HashMap::new();

        for group in existing_groups {
            let items: Vec<ProposalGroupItem> = serde_json::from_value(group.items.clone())
                .context("Failed to deserialize group items")?;

            // Find the topic in this group
            for item in &items {
                if let ProposalGroupItem::Topic(topic) = item {
                    topic_to_group.insert(topic.external_id.clone(), (group.id, items.clone()));
                    break; // Each group has exactly one topic
                }
            }
        }

        let mut applied_count = 0;

        for match_result in matches {
            // Find the group for this topic
            if let Some((group_id, mut items)) = topic_to_group.remove(&match_result.topic_external_id) {
                // Check if proposal is already in the group
                let already_in_group = items.iter().any(|item| {
                    matches!(item, ProposalGroupItem::Proposal(p) if p.external_id == match_result.proposal_external_id)
                });

                if already_in_group {
                    // Put the group back
                    topic_to_group.insert(match_result.topic_external_id.clone(), (group_id, items));
                    continue;
                }

                // Add proposal to the group
                items.push(ProposalGroupItem::Proposal(ProposalItem {
                    name: match_result.proposal_name.clone(),
                    external_id: match_result.proposal_external_id.clone(),
                    governor_id: match_result.governor_id,
                }));

                let items_json = serde_json::to_value(&items)?;

                // Update the group
                proposal_group::Entity::update_many()
                    .filter(proposal_group::Column::Id.eq(group_id))
                    .col_expr(
                        proposal_group::Column::Items,
                        sea_query::Expr::value(items_json),
                    )
                    .exec(&self.db)
                    .await?;

                info!(
                    group_id = %group_id,
                    proposal_id = %match_result.proposal_id,
                    proposal_name = %match_result.proposal_name,
                    topic_external_id = %match_result.topic_external_id,
                    similarity = match_result.similarity_score,
                    "Applied semantic match to group"
                );

                applied_count += 1;

                // Put the updated group back
                topic_to_group.insert(match_result.topic_external_id, (group_id, items));
            } else {
                warn!(
                    proposal_id = %match_result.proposal_id,
                    topic_external_id = %match_result.topic_external_id,
                    "Topic not found in any group, skipping semantic match"
                );
            }
        }

        info!(
            dao_id = %dao_id,
            applied = applied_count,
            "Applied semantic matches"
        );

        Ok(applied_count)
    }

    /// Run the full semantic grouping pipeline for a DAO
    pub async fn run_semantic_grouping(
        &self,
        dao_id: Uuid,
        url_matched_proposal_ids: HashSet<String>,
    ) -> Result<usize> {
        // Step 1: Index topics
        let topics_indexed = self.index_topics(dao_id).await?;
        info!(dao_id = %dao_id, topics_indexed = topics_indexed, "Topics indexed");

        // Step 2: Find semantic matches for unmatched proposals
        let matches = self
            .find_semantic_matches(dao_id, &url_matched_proposal_ids)
            .await?;

        // Step 3: Apply matches to groups
        let applied = self.apply_matches(matches, dao_id).await?;

        Ok(applied)
    }
}
