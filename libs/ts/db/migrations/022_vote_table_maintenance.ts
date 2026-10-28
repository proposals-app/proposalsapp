import { sql, type Kysely } from 'kysely';
import type { DB } from '../src/kysely_db';

// Large, append-mostly tables never reach the default 10% autoanalyze
// threshold (about 700k changed rows for `vote`), so their planner statistics
// stayed months old while the vote and voting power queries grew. Analyze
// them after ~1% of rows change instead.
const FREQUENTLY_ANALYZED_TABLES = [
  'vote',
  'voting_power_timeseries',
  'voting_power_latest',
  'voter',
  'delegation',
] as const;

export async function up(db: Kysely<DB>): Promise<void> {
  // Dropping an index takes an exclusive lock on its table. Fail fast instead
  // of queueing every reader behind a long-running query.
  await sql`SET LOCAL lock_timeout = '10s'`.execute(db);

  // Exact duplicates of other indexes on the same columns. Every write to
  // these tables maintained both copies, and the planner only needs one.
  // - idx_voting_power_block was recreated by 006 after 003 had renamed it to
  //   idx_voting_power_timeseries_block.
  // - idx_voting_power_timeseries_voter_dao_id_timestamp duplicates
  //   idx_voting_power_timeseries_voter_dao_timestamp.
  // - idx_voting_power_latest_voter_dao duplicates the
  //   unique_voting_power_latest_voter_dao constraint index.
  // - idx_voter_address duplicates the unique_voter_address constraint index.
  await sql`DROP INDEX IF EXISTS public.idx_voting_power_block`.execute(db);
  await sql`DROP INDEX IF EXISTS public.idx_voting_power_timeseries_voter_dao_id_timestamp`.execute(
    db
  );
  await sql`DROP INDEX IF EXISTS public.idx_voting_power_latest_voter_dao`.execute(
    db
  );
  await sql`DROP INDEX IF EXISTS public.idx_voter_address`.execute(db);

  for (const table of FREQUENTLY_ANALYZED_TABLES) {
    await sql`
      ALTER TABLE ${sql.table(`public.${table}`)}
      SET (autovacuum_analyze_scale_factor = 0.01)
    `.execute(db);
  }
}

export async function down(db: Kysely<DB>): Promise<void> {
  for (const table of FREQUENTLY_ANALYZED_TABLES) {
    await sql`
      ALTER TABLE ${sql.table(`public.${table}`)}
      RESET (autovacuum_analyze_scale_factor)
    `.execute(db);
  }

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_voter_address
    ON public.voter (address)
  `.execute(db);
  await sql`
    CREATE INDEX IF NOT EXISTS idx_voting_power_latest_voter_dao
    ON public.voting_power_latest (voter, dao_id)
  `.execute(db);
  await sql`
    CREATE INDEX IF NOT EXISTS idx_voting_power_timeseries_voter_dao_id_timestamp
    ON public.voting_power_timeseries (voter, dao_id, timestamp)
  `.execute(db);
  await sql`
    CREATE INDEX IF NOT EXISTS idx_voting_power_block
    ON public.voting_power_timeseries (block)
  `.execute(db);
}
