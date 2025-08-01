import { type Kysely, sql } from 'kysely';
import { type DB } from '../src';

export async function up(db: Kysely<DB>): Promise<void> {
  // Drop the existing unique indexes
  await sql`DROP INDEX IF EXISTS unique_vote_proposal_voter_txid`.execute(db);
  await sql`DROP INDEX IF EXISTS unique_voting_power_voter_dao_txid`.execute(
    db
  );
  await sql`DROP INDEX IF EXISTS unique_delegation_delegator_dao_txid`.execute(
    db
  );

  // Add proper unique constraints for vote table
  await sql`
    ALTER TABLE public.vote
    ADD CONSTRAINT unique_vote_proposal_voter_txid
    UNIQUE (proposal_id, voter_address, txid)
  `.execute(db);

  // Add proper unique constraints for voting_power_timeseries table
  await sql`
    ALTER TABLE public.voting_power_timeseries
    ADD CONSTRAINT unique_voting_power_voter_dao_txid
    UNIQUE (voter, dao_id, txid)
  `.execute(db);

  // Add proper unique constraints for delegation table
  await sql`
    ALTER TABLE public.delegation
    ADD CONSTRAINT unique_delegation_delegator_dao_txid
    UNIQUE (delegator, dao_id, txid)
  `.execute(db);

  // Recreate the performance indexes
  await sql`
    CREATE INDEX IF NOT EXISTS idx_voting_power_block
    ON public.voting_power_timeseries (block)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_delegation_block
    ON public.delegation (block)
  `.execute(db);
}

export async function down(db: Kysely<DB>): Promise<void> {
  // Drop the unique constraints
  await sql`ALTER TABLE public.vote DROP CONSTRAINT IF EXISTS unique_vote_proposal_voter_txid`.execute(
    db
  );
  await sql`ALTER TABLE public.voting_power_timeseries DROP CONSTRAINT IF EXISTS unique_voting_power_voter_dao_txid`.execute(
    db
  );
  await sql`ALTER TABLE public.delegation DROP CONSTRAINT IF EXISTS unique_delegation_delegator_dao_txid`.execute(
    db
  );

  // Recreate the unique indexes as they were
  await sql`
    CREATE UNIQUE INDEX unique_vote_proposal_voter_txid
    ON public.vote (proposal_id, voter_address, COALESCE(txid, ''))
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX unique_voting_power_voter_dao_txid
    ON public.voting_power_timeseries (voter, dao_id, COALESCE(txid, ''))
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX unique_delegation_delegator_dao_txid
    ON public.delegation (delegator, dao_id, COALESCE(txid, ''))
  `.execute(db);
}
