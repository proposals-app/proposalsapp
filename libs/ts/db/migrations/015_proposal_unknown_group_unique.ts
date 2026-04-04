import { type Kysely, sql } from 'kysely';
import { type DB } from '../src';

export async function up(db: Kysely<DB>): Promise<void> {
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_proposal_group_unknown_per_dao
    ON public.proposal_group (dao_id)
    WHERE name = 'UNKNOWN'
  `.execute(db);
}

export async function down(db: Kysely<DB>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS public.idx_proposal_group_unknown_per_dao
  `.execute(db);
}
