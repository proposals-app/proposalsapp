import { type Kysely, sql } from 'kysely';
import type { DB } from '../src';

const ACTIVE_SENTINEL = "TIMESTAMP '2100-01-01 00:00:00'";

export async function up(db: Kysely<DB>): Promise<void> {
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_delegate_to_discourse_user_active_pair
    ON public.delegate_to_discourse_user (delegate_id, discourse_user_id)
    WHERE period_end = ${sql.raw(ACTIVE_SENTINEL)}
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_delegate_to_voter_active_pair
    ON public.delegate_to_voter (delegate_id, voter_id)
    WHERE period_end = ${sql.raw(ACTIVE_SENTINEL)}
  `.execute(db);
}

export async function down(db: Kysely<DB>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS public.idx_delegate_to_discourse_user_active_pair
  `.execute(db);

  await sql`
    DROP INDEX IF EXISTS public.idx_delegate_to_voter_active_pair
  `.execute(db);
}
