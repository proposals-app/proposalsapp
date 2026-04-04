import { sql, type Kysely } from 'kysely';
import type { DB } from '../src/kysely_db';

export async function up(db: Kysely<DB>): Promise<void> {
  await sql`
    CREATE INDEX IF NOT EXISTS idx_discourse_topic_dao_discourse_category
    ON public.discourse_topic (dao_discourse_id, category_id)
    INCLUDE (external_id, title)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_discourse_post_dao_topic_user
    ON public.discourse_post (dao_discourse_id, topic_id)
    INCLUDE (user_id)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_vote_dao_voter_address
    ON public.vote (dao_id, voter_address)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_voting_power_latest_dao_voter
    ON public.voting_power_latest (dao_id, voter)
  `.execute(db);
}

export async function down(db: Kysely<DB>): Promise<void> {
  await sql`DROP INDEX IF EXISTS public.idx_voting_power_latest_dao_voter`.execute(
    db
  );
  await sql`DROP INDEX IF EXISTS public.idx_vote_dao_voter_address`.execute(db);
  await sql`DROP INDEX IF EXISTS public.idx_discourse_post_dao_topic_user`.execute(
    db
  );
  await sql`DROP INDEX IF EXISTS public.idx_discourse_topic_dao_discourse_category`.execute(
    db
  );
}
