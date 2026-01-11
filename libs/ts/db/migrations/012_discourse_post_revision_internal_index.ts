import { type Kysely, sql } from 'kysely';
import { type DB } from '../src';

export async function up(db: Kysely<DB>): Promise<void> {
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_discourse_post_revision_unique_internal
    ON public.discourse_post_revision (discourse_post_id, version, dao_discourse_id)
  `.execute(db);
}

export async function down(db: Kysely<DB>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS idx_discourse_post_revision_unique_internal
  `.execute(db);
}
