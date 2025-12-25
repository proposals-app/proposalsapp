use super::types::{EmbeddingInput, EntityType, SimilarityMatch};
use anyhow::{Context, Result};
use chrono::{NaiveDateTime, Utc};
use sea_orm::{ConnectionTrait, DatabaseConnection, FromQueryResult, Statement};
use tracing::info;
use uuid::Uuid;

/// Default similarity threshold for matches
const DEFAULT_SIMILARITY_THRESHOLD: f32 = 0.75;

/// Store for embedding operations using pgvector
pub struct EmbeddingStore {
    db: DatabaseConnection,
    similarity_threshold: f32,
}

/// Helper struct for query results
#[derive(Debug, FromQueryResult)]
struct EmbeddingRow {
    id: Uuid,
    entity_type: String,
    entity_id: Uuid,
    external_id: String,
    content_hash: String,
    model_version: String,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
}

#[derive(Debug, FromQueryResult)]
struct SimilarityRow {
    entity_id: Uuid,
    external_id: String,
    similarity: f32,
}

#[derive(Debug, FromQueryResult)]
struct ContentHashRow {
    entity_id: Uuid,
    content_hash: String,
}

impl EmbeddingStore {
    /// Create a new embedding store
    pub fn new(db: DatabaseConnection) -> Self {
        let threshold = std::env::var("SEMANTIC_SIMILARITY_THRESHOLD")
            .ok()
            .and_then(|t| t.parse().ok())
            .unwrap_or(DEFAULT_SIMILARITY_THRESHOLD);

        Self {
            db,
            similarity_threshold: threshold,
        }
    }

    /// Create with custom threshold
    pub fn with_threshold(db: DatabaseConnection, similarity_threshold: f32) -> Self {
        Self {
            db,
            similarity_threshold,
        }
    }

    /// Upsert an embedding (insert or update)
    pub async fn upsert_embedding(&self, input: EmbeddingInput) -> Result<Uuid> {
        let now = Utc::now().naive_utc();
        let embedding_str = format_embedding(&input.embedding);

        // Use ON CONFLICT to upsert
        let sql = format!(
            r#"
            INSERT INTO public.embedding (
                id, entity_type, entity_id, external_id, embedding,
                content_hash, model_version, created_at, updated_at
            )
            VALUES (
                gen_random_uuid(), $1, $2, $3, '{}'::vector,
                $4, $5, $6, $6
            )
            ON CONFLICT (entity_type, entity_id)
            DO UPDATE SET
                embedding = EXCLUDED.embedding,
                content_hash = EXCLUDED.content_hash,
                model_version = EXCLUDED.model_version,
                updated_at = EXCLUDED.updated_at
            RETURNING id
            "#,
            embedding_str
        );

        let stmt = Statement::from_sql_and_values(
            sea_orm::DatabaseBackend::Postgres,
            &sql,
            vec![
                input.entity_type.as_str().into(),
                input.entity_id.into(),
                input.external_id.into(),
                input.content_hash.into(),
                input.model_version.into(),
                now.into(),
            ],
        );

        #[derive(FromQueryResult)]
        struct IdResult {
            id: Uuid,
        }

        let result = IdResult::find_by_statement(stmt)
            .one(&self.db)
            .await
            .context("Failed to upsert embedding")?
            .context("No ID returned from upsert")?;

        Ok(result.id)
    }

    /// Find similar entities by embedding vector
    pub async fn find_similar(
        &self,
        embedding: &[f32],
        entity_type: EntityType,
        limit: usize,
    ) -> Result<Vec<SimilarityMatch>> {
        self.find_similar_with_threshold(embedding, entity_type, limit, self.similarity_threshold)
            .await
    }

    /// Find similar entities scoped to a DAO
    pub async fn find_similar_for_dao(
        &self,
        embedding: &[f32],
        entity_type: EntityType,
        dao_id: Uuid,
        limit: usize,
    ) -> Result<Vec<SimilarityMatch>> {
        self.find_similar_with_threshold_for_dao(
            embedding,
            entity_type,
            dao_id,
            limit,
            self.similarity_threshold,
        )
        .await
    }

    /// Find similar entities with custom threshold
    pub async fn find_similar_with_threshold(
        &self,
        embedding: &[f32],
        entity_type: EntityType,
        limit: usize,
        threshold: f32,
    ) -> Result<Vec<SimilarityMatch>> {
        let embedding_str = format_embedding(embedding);

        let sql = format!(
            r#"
            SELECT
                entity_id,
                external_id,
                1 - (embedding <=> '{}'::vector) as similarity
            FROM public.embedding
            WHERE entity_type = $1
              AND 1 - (embedding <=> '{}'::vector) > $2
            ORDER BY embedding <=> '{}'::vector
            LIMIT $3
            "#,
            embedding_str, embedding_str, embedding_str
        );

        let stmt = Statement::from_sql_and_values(
            sea_orm::DatabaseBackend::Postgres,
            &sql,
            vec![
                entity_type.as_str().into(),
                threshold.into(),
                (limit as i64).into(),
            ],
        );

        let rows = SimilarityRow::find_by_statement(stmt)
            .all(&self.db)
            .await
            .context("Failed to find similar embeddings")?;

        Ok(rows
            .into_iter()
            .map(|r| SimilarityMatch {
                entity_id: r.entity_id,
                external_id: r.external_id,
                similarity: r.similarity,
            })
            .collect())
    }

    /// Find similar entities with custom threshold scoped to a DAO
    pub async fn find_similar_with_threshold_for_dao(
        &self,
        embedding: &[f32],
        entity_type: EntityType,
        dao_id: Uuid,
        limit: usize,
        threshold: f32,
    ) -> Result<Vec<SimilarityMatch>> {
        let embedding_str = format_embedding(embedding);

        let (sql, values): (String, Vec<sea_orm::Value>) = match entity_type {
            EntityType::Topic => (
                format!(
                    r#"
                    SELECT
                        e.entity_id,
                        e.external_id,
                        1 - (e.embedding <=> '{}'::vector) as similarity
                    FROM public.embedding e
                    JOIN public.discourse_topic dt ON dt.id = e.entity_id
                    JOIN public.dao_discourse dd ON dd.id = dt.dao_discourse_id
                    WHERE e.entity_type = $1
                      AND dd.dao_id = $2
                      AND 1 - (e.embedding <=> '{}'::vector) > $3
                    ORDER BY e.embedding <=> '{}'::vector
                    LIMIT $4
                    "#,
                    embedding_str, embedding_str, embedding_str
                ),
                vec![
                    entity_type.as_str().into(),
                    dao_id.into(),
                    threshold.into(),
                    (limit as i64).into(),
                ],
            ),
            EntityType::Proposal => (
                format!(
                    r#"
                    SELECT
                        e.entity_id,
                        e.external_id,
                        1 - (e.embedding <=> '{}'::vector) as similarity
                    FROM public.embedding e
                    JOIN public.proposal p ON p.id = e.entity_id
                    WHERE e.entity_type = $1
                      AND p.dao_id = $2
                      AND 1 - (e.embedding <=> '{}'::vector) > $3
                    ORDER BY e.embedding <=> '{}'::vector
                    LIMIT $4
                    "#,
                    embedding_str, embedding_str, embedding_str
                ),
                vec![
                    entity_type.as_str().into(),
                    dao_id.into(),
                    threshold.into(),
                    (limit as i64).into(),
                ],
            ),
        };

        let stmt = Statement::from_sql_and_values(
            sea_orm::DatabaseBackend::Postgres,
            &sql,
            values,
        );

        let rows = SimilarityRow::find_by_statement(stmt)
            .all(&self.db)
            .await
            .context("Failed to find similar embeddings")?;

        Ok(rows
            .into_iter()
            .map(|r| SimilarityMatch {
                entity_id: r.entity_id,
                external_id: r.external_id,
                similarity: r.similarity,
            })
            .collect())
    }

    /// Get content hashes for entities to detect changes
    pub async fn get_content_hashes(
        &self,
        entity_type: EntityType,
        entity_ids: &[Uuid],
    ) -> Result<std::collections::HashMap<Uuid, String>> {
        if entity_ids.is_empty() {
            return Ok(std::collections::HashMap::new());
        }

        let placeholders: Vec<String> = (2..=entity_ids.len() + 1)
            .map(|i| format!("${}", i))
            .collect();
        let placeholder_str = placeholders.join(", ");

        let sql = format!(
            r#"
            SELECT entity_id, content_hash
            FROM public.embedding
            WHERE entity_type = $1
              AND entity_id IN ({})
            "#,
            placeholder_str
        );

        let mut values: Vec<sea_orm::Value> = vec![entity_type.as_str().into()];
        values.extend(entity_ids.iter().map(|id| (*id).into()));

        let stmt = Statement::from_sql_and_values(sea_orm::DatabaseBackend::Postgres, &sql, values);

        let rows = ContentHashRow::find_by_statement(stmt)
            .all(&self.db)
            .await
            .context("Failed to get content hashes")?;

        Ok(rows.into_iter().map(|r| (r.entity_id, r.content_hash)).collect())
    }

    /// Get all entity IDs that have embeddings
    pub async fn get_embedded_entity_ids(
        &self,
        entity_type: EntityType,
    ) -> Result<std::collections::HashSet<Uuid>> {
        let sql = r#"
            SELECT entity_id
            FROM public.embedding
            WHERE entity_type = $1
        "#;

        let stmt = Statement::from_sql_and_values(
            sea_orm::DatabaseBackend::Postgres,
            sql,
            vec![entity_type.as_str().into()],
        );

        #[derive(FromQueryResult)]
        struct EntityIdRow {
            entity_id: Uuid,
        }

        let rows = EntityIdRow::find_by_statement(stmt)
            .all(&self.db)
            .await
            .context("Failed to get embedded entity IDs")?;

        Ok(rows.into_iter().map(|r| r.entity_id).collect())
    }

    /// Delete embeddings for entities that no longer exist
    pub async fn delete_stale_embeddings(
        &self,
        entity_type: EntityType,
        valid_entity_ids: &[Uuid],
    ) -> Result<u64> {
        if valid_entity_ids.is_empty() {
            // Delete all embeddings of this type if no valid IDs
            let sql = r#"
                DELETE FROM public.embedding
                WHERE entity_type = $1
            "#;

            let stmt = Statement::from_sql_and_values(
                sea_orm::DatabaseBackend::Postgres,
                sql,
                vec![entity_type.as_str().into()],
            );

            let result = self.db.execute(stmt).await?;
            return Ok(result.rows_affected());
        }

        let placeholders: Vec<String> = (2..=valid_entity_ids.len() + 1)
            .map(|i| format!("${}", i))
            .collect();
        let placeholder_str = placeholders.join(", ");

        let sql = format!(
            r#"
            DELETE FROM public.embedding
            WHERE entity_type = $1
              AND entity_id NOT IN ({})
            "#,
            placeholder_str
        );

        let mut values: Vec<sea_orm::Value> = vec![entity_type.as_str().into()];
        values.extend(valid_entity_ids.iter().map(|id| (*id).into()));

        let stmt = Statement::from_sql_and_values(sea_orm::DatabaseBackend::Postgres, &sql, values);

        let result = self.db.execute(stmt).await?;
        let deleted = result.rows_affected();

        if deleted > 0 {
            info!(
                entity_type = %entity_type,
                deleted = deleted,
                "Deleted stale embeddings"
            );
        }

        Ok(deleted)
    }

    /// Get count of embeddings by entity type
    pub async fn count_embeddings(&self, entity_type: EntityType) -> Result<u64> {
        let sql = r#"
            SELECT COUNT(*) as count
            FROM public.embedding
            WHERE entity_type = $1
        "#;

        let stmt = Statement::from_sql_and_values(
            sea_orm::DatabaseBackend::Postgres,
            sql,
            vec![entity_type.as_str().into()],
        );

        #[derive(FromQueryResult)]
        struct CountRow {
            count: i64,
        }

        let result = CountRow::find_by_statement(stmt)
            .one(&self.db)
            .await?
            .map(|r| r.count as u64)
            .unwrap_or(0);

        Ok(result)
    }
}

/// Format embedding vector as PostgreSQL array string
fn format_embedding(embedding: &[f32]) -> String {
    let values: Vec<String> = embedding.iter().map(|v| v.to_string()).collect();
    format!("[{}]", values.join(","))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_embedding() {
        let embedding = vec![0.1, 0.2, 0.3];
        let formatted = format_embedding(&embedding);
        assert_eq!(formatted, "[0.1,0.2,0.3]");
    }

    #[test]
    fn test_entity_type_as_str() {
        assert_eq!(EntityType::Proposal.as_str(), "proposal");
        assert_eq!(EntityType::Topic.as_str(), "topic");
    }
}
