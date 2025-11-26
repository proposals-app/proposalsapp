import { type Kysely, sql } from 'kysely';
import { type DB } from '../src';

/**
 * Migration 010: Database Fixes
 *
 * This migration addresses several issues identified in code review:
 *
 * 1. Add index for notification cooldown query (performance)
 * 2. Fix NULL handling in unique constraints (data integrity)
 * 3. Fix voting power trigger race condition (data integrity)
 * 4. Add cascade deletes to Account and Session FKs (orphan prevention)
 */
export async function up(db: Kysely<DB>): Promise<void> {
  // ============================================
  // 1. Add index for notification cooldown query
  // ============================================
  // The email service queries: WHERE user_id = ? AND target_id = ? AND type = ? AND dao_id = ? AND sent_at >= ?
  await sql`
    CREATE INDEX IF NOT EXISTS idx_user_notification_cooldown_lookup
    ON public.user_notification (user_id, target_id, type, dao_id, sent_at DESC)
  `.execute(db);

  // ============================================
  // 2. Fix NULL handling in unique constraints
  // ============================================
  // PostgreSQL treats NULL as distinct in unique constraints, allowing duplicate rows.
  // Replace table constraints with partial unique indexes that handle NULLs properly.

  // Drop existing constraints
  await sql`ALTER TABLE public.vote DROP CONSTRAINT IF EXISTS unique_vote_proposal_voter_txid`.execute(
    db
  );
  await sql`ALTER TABLE public.voting_power_timeseries DROP CONSTRAINT IF EXISTS unique_voting_power_voter_dao_txid`.execute(
    db
  );
  await sql`ALTER TABLE public.delegation DROP CONSTRAINT IF EXISTS unique_delegation_delegator_dao_txid`.execute(
    db
  );

  // Create partial unique indexes for non-NULL txid values
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_vote_proposal_voter_txid_not_null
    ON public.vote (proposal_id, voter_address, txid)
    WHERE txid IS NOT NULL
  `.execute(db);

  // For NULL txid values, we need a separate unique index
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_vote_proposal_voter_txid_null
    ON public.vote (proposal_id, voter_address)
    WHERE txid IS NULL
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_voting_power_voter_dao_txid_not_null
    ON public.voting_power_timeseries (voter, dao_id, txid)
    WHERE txid IS NOT NULL
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_voting_power_voter_dao_txid_null
    ON public.voting_power_timeseries (voter, dao_id)
    WHERE txid IS NULL
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_delegation_delegator_dao_txid_not_null
    ON public.delegation (delegator, dao_id, txid)
    WHERE txid IS NOT NULL
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_delegation_delegator_dao_txid_null
    ON public.delegation (delegator, dao_id)
    WHERE txid IS NULL
  `.execute(db);

  // ============================================
  // 3. Fix voting power trigger race condition
  // ============================================
  // The current trigger only updates if new timestamp > existing timestamp.
  // Multiple inserts from the same block can have identical timestamps,
  // causing updates to be lost. Use (timestamp, block) as the comparison.
  await sql`
    CREATE OR REPLACE FUNCTION update_voting_power_latest()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO public.voting_power_latest (voter, voting_power, dao_id, timestamp, block, txid)
      VALUES (NEW.voter, NEW.voting_power, NEW.dao_id, NEW.timestamp, NEW.block, NEW.txid)
      ON CONFLICT (voter, dao_id)
      DO UPDATE SET
        voting_power = EXCLUDED.voting_power,
        timestamp = EXCLUDED.timestamp,
        block = EXCLUDED.block,
        txid = EXCLUDED.txid
      WHERE
        -- Update if new data is from a later timestamp
        EXCLUDED.timestamp > voting_power_latest.timestamp
        -- Or same timestamp but higher block number (shouldn't happen but handles edge cases)
        OR (EXCLUDED.timestamp = voting_power_latest.timestamp AND EXCLUDED.block > voting_power_latest.block)
        -- Or same timestamp and block but we have a txid and existing doesn't
        OR (EXCLUDED.timestamp = voting_power_latest.timestamp
            AND EXCLUDED.block = voting_power_latest.block
            AND EXCLUDED.txid IS NOT NULL
            AND voting_power_latest.txid IS NULL);
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  // ============================================
  // 4. Add cascade deletes to Account and Session FKs
  // ============================================
  // Drop existing constraints and recreate with ON DELETE CASCADE

  // Account table
  await sql`ALTER TABLE public.account DROP CONSTRAINT IF EXISTS account_userId_fkey`.execute(
    db
  );
  await sql`
    ALTER TABLE public.account
    ADD CONSTRAINT account_userId_fkey
    FOREIGN KEY (user_id) REFERENCES public.user(id) ON DELETE CASCADE
  `.execute(db);

  // Session table
  await sql`ALTER TABLE public.session DROP CONSTRAINT IF EXISTS session_userId_fkey`.execute(
    db
  );
  await sql`
    ALTER TABLE public.session
    ADD CONSTRAINT session_userId_fkey
    FOREIGN KEY (user_id) REFERENCES public.user(id) ON DELETE CASCADE
  `.execute(db);
}

export async function down(db: Kysely<DB>): Promise<void> {
  // ============================================
  // 4. Revert cascade deletes (remove CASCADE)
  // ============================================
  await sql`ALTER TABLE public.session DROP CONSTRAINT IF EXISTS session_userId_fkey`.execute(
    db
  );
  await sql`
    ALTER TABLE public.session
    ADD CONSTRAINT session_userId_fkey
    FOREIGN KEY (user_id) REFERENCES public.user(id)
  `.execute(db);

  await sql`ALTER TABLE public.account DROP CONSTRAINT IF EXISTS account_userId_fkey`.execute(
    db
  );
  await sql`
    ALTER TABLE public.account
    ADD CONSTRAINT account_userId_fkey
    FOREIGN KEY (user_id) REFERENCES public.user(id)
  `.execute(db);

  // ============================================
  // 3. Revert voting power trigger to original
  // ============================================
  await sql`
    CREATE OR REPLACE FUNCTION update_voting_power_latest()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO public.voting_power_latest (voter, voting_power, dao_id, timestamp, block, txid)
      VALUES (NEW.voter, NEW.voting_power, NEW.dao_id, NEW.timestamp, NEW.block, NEW.txid)
      ON CONFLICT (voter, dao_id)
      DO UPDATE SET
        voting_power = EXCLUDED.voting_power,
        timestamp = EXCLUDED.timestamp,
        block = EXCLUDED.block,
        txid = EXCLUDED.txid
      WHERE EXCLUDED.timestamp > voting_power_latest.timestamp;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  // ============================================
  // 2. Revert NULL handling (restore constraints)
  // ============================================
  // Drop the partial unique indexes
  await sql`DROP INDEX IF EXISTS unique_vote_proposal_voter_txid_not_null`.execute(
    db
  );
  await sql`DROP INDEX IF EXISTS unique_vote_proposal_voter_txid_null`.execute(
    db
  );
  await sql`DROP INDEX IF EXISTS unique_voting_power_voter_dao_txid_not_null`.execute(
    db
  );
  await sql`DROP INDEX IF EXISTS unique_voting_power_voter_dao_txid_null`.execute(
    db
  );
  await sql`DROP INDEX IF EXISTS unique_delegation_delegator_dao_txid_not_null`.execute(
    db
  );
  await sql`DROP INDEX IF EXISTS unique_delegation_delegator_dao_txid_null`.execute(
    db
  );

  // Recreate the original constraints
  await sql`
    ALTER TABLE public.vote
    ADD CONSTRAINT unique_vote_proposal_voter_txid
    UNIQUE (proposal_id, voter_address, txid)
  `.execute(db);

  await sql`
    ALTER TABLE public.voting_power_timeseries
    ADD CONSTRAINT unique_voting_power_voter_dao_txid
    UNIQUE (voter, dao_id, txid)
  `.execute(db);

  await sql`
    ALTER TABLE public.delegation
    ADD CONSTRAINT unique_delegation_delegator_dao_txid
    UNIQUE (delegator, dao_id, txid)
  `.execute(db);

  // ============================================
  // 1. Drop notification cooldown index
  // ============================================
  await sql`DROP INDEX IF EXISTS idx_user_notification_cooldown_lookup`.execute(
    db
  );
}
