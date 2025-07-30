import { type Kysely, sql } from 'kysely';
import { type DB } from '../src';

export async function up(db: Kysely<DB>): Promise<void> {
  // First, remove duplicates from voting_power_timeseries
  // Keep the record with the highest voting_power for each unique combination
  // Using COALESCE to handle NULL txid values
  await sql`
    DELETE FROM public.voting_power_timeseries v1
    WHERE EXISTS (
      SELECT 1
      FROM public.voting_power_timeseries v2
      WHERE v2.voter = v1.voter
        AND v2.dao_id = v1.dao_id
        AND COALESCE(v2.txid, '') = COALESCE(v1.txid, '')
        AND (
          v2.voting_power > v1.voting_power
          OR (v2.voting_power = v1.voting_power AND v2.id > v1.id)
        )
    )
  `.execute(db);

  // Create unique index on voter, dao_id, and txid
  // This allows multiple voting power changes in the same block with different txids
  await sql`
    CREATE UNIQUE INDEX unique_voting_power_voter_dao_txid 
    ON public.voting_power_timeseries (voter, dao_id, COALESCE(txid, ''))
  `.execute(db);

  // Also create an index on block for query performance
  await sql`
    CREATE INDEX IF NOT EXISTS idx_voting_power_block
    ON public.voting_power_timeseries (block)
  `.execute(db);
}

export async function down(db: Kysely<DB>): Promise<void> {
  // Drop the indexes
  await sql`
    DROP INDEX IF EXISTS idx_voting_power_block
  `.execute(db);

  await sql`
    DROP INDEX IF EXISTS unique_voting_power_voter_dao_txid
  `.execute(db);
}
