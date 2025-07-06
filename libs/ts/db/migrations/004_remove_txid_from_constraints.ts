import { type Kysely, sql } from 'kysely';
import { type DB } from '../src';

export async function up(db: Kysely<DB>): Promise<void> {
  // Drop existing unique constraints that include txid
  await db.schema
    .alterTable('voting_power')
    .dropConstraint('voting_power_voter_dao_id_block_txid_key')
    .ifExists()
    .execute();

  await db.schema
    .alterTable('delegation')
    .dropConstraint('delegation_delegator_dao_id_block_txid_key')
    .ifExists()
    .execute();

  // Remove duplicates from voting_power table, keeping only the latest record for each (voter, dao_id, block)
  await sql`
    DELETE FROM voting_power vp1
    WHERE EXISTS (
      SELECT 1 FROM voting_power vp2
      WHERE vp2.voter = vp1.voter
        AND vp2.dao_id = vp1.dao_id
        AND vp2.block = vp1.block
        AND vp2.id > vp1.id
    )
  `.execute(db);

  // Remove duplicates from delegation table, keeping only the latest record for each (delegator, dao_id, block)
  await sql`
    DELETE FROM delegation d1
    WHERE EXISTS (
      SELECT 1 FROM delegation d2
      WHERE d2.delegator = d1.delegator
        AND d2.dao_id = d1.dao_id
        AND d2.block = d1.block
        AND d2.id > d1.id
    )
  `.execute(db);

  // Create new unique constraints without txid
  await db.schema
    .alterTable('voting_power')
    .addUniqueConstraint('voting_power_voter_dao_id_block_key', [
      'voter',
      'dao_id',
      'block',
    ])
    .execute();

  await db.schema
    .alterTable('delegation')
    .addUniqueConstraint('delegation_delegator_dao_id_block_key', [
      'delegator',
      'dao_id',
      'block',
    ])
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  // Drop new unique constraints
  await db.schema
    .alterTable('voting_power')
    .dropConstraint('voting_power_voter_dao_id_block_key')
    .ifExists()
    .execute();

  await db.schema
    .alterTable('delegation')
    .dropConstraint('delegation_delegator_dao_id_block_key')
    .ifExists()
    .execute();

  // Recreate old unique constraints with txid
  await db.schema
    .alterTable('voting_power')
    .addUniqueConstraint('voting_power_voter_dao_id_block_txid_key', [
      'voter',
      'dao_id',
      'block',
      'txid',
    ])
    .execute();

  await db.schema
    .alterTable('delegation')
    .addUniqueConstraint('delegation_delegator_dao_id_block_txid_key', [
      'delegator',
      'dao_id',
      'block',
      'txid',
    ])
    .execute();
}
