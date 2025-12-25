import { type Kysely, sql } from 'kysely';
import { type DB } from '../src';

/**
 * Migration 011: Add embeddings table for semantic search
 *
 * Uses pgvector extension to store and search vector embeddings
 * for proposals and discourse topics, enabling semantic matching.
 *
 * The embedding table stores:
 * - entity_type: 'proposal' or 'topic'
 * - entity_id: UUID reference to the entity
 * - embedding: 768-dimensional vector (nomic-embed-text)
 * - content_hash: SHA256 hash for change detection
 * - model_version: embedding model version for tracking
 */
export async function up(db: Kysely<DB>): Promise<void> {
  // Enable pgvector extension
  await sql`CREATE EXTENSION IF NOT EXISTS vector`.execute(db);

  // Create embeddings table
  await sql`
    CREATE TABLE public.embedding (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type VARCHAR(50) NOT NULL,
      entity_id UUID NOT NULL,
      external_id VARCHAR(255) NOT NULL,
      embedding vector(768) NOT NULL,
      content_hash VARCHAR(64) NOT NULL,
      model_version VARCHAR(50) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(entity_type, entity_id)
    )
  `.execute(db);

  // Index for fast cosine similarity search
  // HNSW provides excellent recall and doesn't require pre-existing data (unlike IVFFlat)
  // m=16 and ef_construction=64 are good defaults for most use cases
  await sql`
    CREATE INDEX embedding_cosine_idx ON public.embedding
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)
  `.execute(db);

  // Index for entity type filtering
  await sql`
    CREATE INDEX idx_embedding_entity_type ON public.embedding (entity_type)
  `.execute(db);

  // Index for entity lookups
  await sql`
    CREATE INDEX idx_embedding_entity_id ON public.embedding (entity_id)
  `.execute(db);

  // Index for content hash lookups (to detect changes)
  await sql`
    CREATE INDEX idx_embedding_content_hash ON public.embedding (content_hash)
  `.execute(db);
}

export async function down(db: Kysely<DB>): Promise<void> {
  await sql`DROP TABLE IF EXISTS public.embedding`.execute(db);
  // Note: We don't drop the vector extension as other tables might use it
}
