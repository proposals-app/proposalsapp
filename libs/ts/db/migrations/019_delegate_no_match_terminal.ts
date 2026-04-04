import { type Kysely, sql } from 'kysely';
import { type DB } from '../src';

export async function up(db: Kysely<DB>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS public.mapping_delegate_case_state (
      dao_id UUID NOT NULL REFERENCES public.dao(id) ON DELETE CASCADE,
      delegate_id UUID NOT NULL REFERENCES public.delegate(id) ON DELETE CASCADE,
      missing_side TEXT NOT NULL CHECK (missing_side IN ('voter', 'discourse_user')),
      status TEXT NOT NULL CHECK (status IN ('no_match')),
      decision_source TEXT NOT NULL,
      reason TEXT NOT NULL,
      evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (dao_id, delegate_id, missing_side)
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_mapping_delegate_case_state_lookup
    ON public.mapping_delegate_case_state (dao_id, status, delegate_id, missing_side)
  `.execute(db);
}

export async function down(db: Kysely<DB>): Promise<void> {
  await sql`
    DROP TABLE IF EXISTS public.mapping_delegate_case_state
  `.execute(db);
}
