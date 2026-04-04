import { type Kysely, sql } from 'kysely';
import { type DB } from '../src';

export async function up(db: Kysely<DB>): Promise<void> {
  await sql`
    ALTER TABLE IF EXISTS public.proposal_mapping_decision
    RENAME TO mapping_proposal_decision
  `.execute(db);

  await sql`
    ALTER INDEX IF EXISTS public.idx_proposal_mapping_decision_lookup
    RENAME TO idx_mapping_proposal_decision_lookup
  `.execute(db);

  await sql`
    ALTER TABLE IF EXISTS public.delegate_mapping_decision
    RENAME TO mapping_delegate_decision
  `.execute(db);

  await sql`
    ALTER INDEX IF EXISTS public.idx_delegate_mapping_decision_lookup
    RENAME TO idx_mapping_delegate_decision_lookup
  `.execute(db);

  await sql`DROP TABLE IF EXISTS public.embedding`.execute(db);

  await sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        BEGIN
          EXECUTE 'DROP EXTENSION vector';
        EXCEPTION
          WHEN dependent_objects_still_exist THEN
            NULL;
        END;
      END IF;
    END
    $$;
  `.execute(db);
}

export async function down(db: Kysely<DB>): Promise<void> {
  await sql`
    ALTER TABLE IF EXISTS public.mapping_proposal_decision
    RENAME TO proposal_mapping_decision
  `.execute(db);

  await sql`
    ALTER INDEX IF EXISTS public.idx_mapping_proposal_decision_lookup
    RENAME TO idx_proposal_mapping_decision_lookup
  `.execute(db);

  await sql`
    ALTER TABLE IF EXISTS public.mapping_delegate_decision
    RENAME TO delegate_mapping_decision
  `.execute(db);

  await sql`
    ALTER INDEX IF EXISTS public.idx_mapping_delegate_decision_lookup
    RENAME TO idx_delegate_mapping_decision_lookup
  `.execute(db);

  await sql`CREATE EXTENSION IF NOT EXISTS vector`.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS public.embedding (
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

  await sql`
    CREATE INDEX IF NOT EXISTS embedding_cosine_idx ON public.embedding
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_embedding_entity_type
    ON public.embedding (entity_type)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_embedding_entity_id
    ON public.embedding (entity_id)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_embedding_content_hash
    ON public.embedding (content_hash)
  `.execute(db);
}
