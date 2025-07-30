import { type Kysely, sql } from 'kysely';
import { type DB } from '../src';

export async function up(db: Kysely<DB>): Promise<void> {
  // First, remove duplicates from delegation table
  // Keep the most recent delegation (by timestamp) for each unique combination
  // Using COALESCE to handle NULL txid values
  await sql`
    DELETE FROM public.delegation d1
    WHERE EXISTS (
      SELECT 1
      FROM public.delegation d2
      WHERE d2.delegator = d1.delegator
        AND d2.dao_id = d1.dao_id
        AND COALESCE(d2.txid, '') = COALESCE(d1.txid, '')
        AND (
          d2.timestamp > d1.timestamp
          OR (d2.timestamp = d1.timestamp AND d2.id > d1.id)
        )
    )
  `.execute(db);

  // Create unique index on delegator, dao_id, and txid
  // This allows multiple delegations in the same block with different txids
  await sql`
    CREATE UNIQUE INDEX unique_delegation_delegator_dao_txid 
    ON public.delegation (delegator, dao_id, COALESCE(txid, ''))
  `.execute(db);

  // Also create an index on block for query performance
  await sql`
    CREATE INDEX IF NOT EXISTS idx_delegation_block 
    ON public.delegation (block)
  `.execute(db);
}

export async function down(db: Kysely<DB>): Promise<void> {
  // Drop the indexes
  await sql`
    DROP INDEX IF EXISTS idx_delegation_block
  `.execute(db);

  await sql`
    DROP INDEX IF EXISTS unique_delegation_delegator_dao_txid
  `.execute(db);
}
