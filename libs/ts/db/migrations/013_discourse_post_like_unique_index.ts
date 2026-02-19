import { type Kysely, sql } from 'kysely';
import { type DB } from '../src';

export async function up(db: Kysely<DB>): Promise<void> {
  // Keep the newest row for each logical like and remove duplicates first.
  await sql`
    WITH ranked_likes AS (
      SELECT
        id,
        row_number() OVER (
          PARTITION BY external_discourse_post_id, external_user_id, dao_discourse_id
          ORDER BY created_at DESC, id DESC
        ) AS row_num
      FROM public.discourse_post_like
    )
    DELETE FROM public.discourse_post_like dpl
    USING ranked_likes rl
    WHERE dpl.id = rl.id
      AND rl.row_num > 1
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_discourse_post_like_unique
    ON public.discourse_post_like (
      external_discourse_post_id,
      external_user_id,
      dao_discourse_id
    )
  `.execute(db);
}

export async function down(db: Kysely<DB>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS idx_discourse_post_like_unique
  `.execute(db);
}
