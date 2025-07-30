import { type Kysely, sql } from 'kysely';
import { type DB } from '../src';

export async function up(db: Kysely<DB>): Promise<void> {
  // First, remove duplicates keeping only the most recent vote
  // This query keeps the vote with the latest created_at timestamp for each unique combination
  await sql`
    DELETE FROM public.vote v1
    WHERE EXISTS (
      SELECT 1
      FROM public.vote v2
      WHERE v2.proposal_id = v1.proposal_id
        AND v2.voter_address = v1.voter_address
        AND COALESCE(v2.txid, '') = COALESCE(v1.txid, '')
        AND (
          v2.created_at > v1.created_at
          OR (v2.created_at = v1.created_at AND v2.id > v1.id)
        )
    )
  `.execute(db);

  // Create unique index on proposal_id, voter_address, and txid
  // Using COALESCE for txid to handle NULL values properly
  await sql`
    CREATE UNIQUE INDEX unique_vote_proposal_voter_txid
    ON public.vote (proposal_id, voter_address, COALESCE(txid, ''))
  `.execute(db);
}

export async function down(db: Kysely<DB>): Promise<void> {
  // Drop the unique index
  await sql`
    DROP INDEX IF EXISTS unique_vote_proposal_voter_txid
  `.execute(db);
}
