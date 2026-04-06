import { type Kysely, sql } from 'kysely';
import { type DB } from '../src';

export async function up(db: Kysely<DB>): Promise<void> {
  await sql`
    ALTER TABLE public.mapping_proposal_decision
      ADD COLUMN IF NOT EXISTS session_trace JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS session_stats JSONB NOT NULL DEFAULT '{}'::jsonb
  `.execute(db);

  await sql`
    ALTER TABLE public.mapping_delegate_decision
      ADD COLUMN IF NOT EXISTS session_trace JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS session_stats JSONB NOT NULL DEFAULT '{}'::jsonb
  `.execute(db);
}

export async function down(db: Kysely<DB>): Promise<void> {
  await sql`
    ALTER TABLE public.mapping_proposal_decision
      DROP COLUMN IF EXISTS session_trace,
      DROP COLUMN IF EXISTS session_stats
  `.execute(db);

  await sql`
    ALTER TABLE public.mapping_delegate_decision
      DROP COLUMN IF EXISTS session_trace,
      DROP COLUMN IF EXISTS session_stats
  `.execute(db);
}
