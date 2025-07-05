import { type Kysely } from 'kysely';
import { type DB } from '../src';

export async function up(db: Kysely<DB>): Promise<void> {
  // Fix voting_power table constraints
  // 1. Drop the problematic unique constraint on txid
  await db.schema.dropIndex('uq_voting_power_txid').execute();

  // 2. Add composite unique constraint to properly handle multiple events per transaction
  await db.schema
    .createIndex('uq_voting_power_voter_dao_block_txid')
    .on('voting_power')
    .columns(['voter', 'dao_id', 'block', 'txid'])
    .unique()
    .execute();

  // Fix delegation table constraints
  // 1. Drop the problematic unique constraint on txid
  await db.schema.dropIndex('uq_delegation_txid').execute();

  // 2. Add composite unique constraint to properly handle multiple events per transaction
  await db.schema
    .createIndex('uq_delegation_delegator_dao_block_txid')
    .on('delegation')
    .columns(['delegator', 'dao_id', 'block', 'txid'])
    .unique()
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  // Revert voting_power changes
  await db.schema.dropIndex('uq_voting_power_voter_dao_block_txid').execute();
  await db.schema
    .createIndex('uq_voting_power_txid')
    .on('voting_power')
    .column('txid')
    .unique()
    .execute();

  // Revert delegation changes
  await db.schema.dropIndex('uq_delegation_delegator_dao_block_txid').execute();
  await db.schema
    .createIndex('uq_delegation_txid')
    .on('delegation')
    .column('txid')
    .unique()
    .execute();
}
