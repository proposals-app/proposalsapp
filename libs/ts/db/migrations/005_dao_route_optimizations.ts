import { type Kysely } from 'kysely';
import { type DB } from '../src';

export async function up(db: Kysely<DB>): Promise<void> {
  // Critical index for getGroups() - sorts by created_at DESC
  await db.schema
    .createIndex('idx_proposal_group_dao_id_created_at')
    .on('proposal_group')
    .columns(['dao_id', 'created_at desc'])
    .execute();

  // Optimize vote filtering with voting power thresholds
  await db.schema
    .createIndex('idx_vote_proposal_id_voter_address_voting_power')
    .on('vote')
    .columns(['proposal_id', 'voter_address', 'voting_power'])
    .execute();

  // Speed up delegate lookups
  await db.schema
    .createIndex('idx_delegate_dao_id')
    .on('delegate')
    .column('dao_id')
    .execute();

  // Optimize latest voting power lookups (already have similar, but this is more specific)
  await db.schema
    .createIndex('idx_voting_power_voter_dao_id_timestamp_desc')
    .on('voting_power')
    .columns(['voter', 'dao_id', 'timestamp desc'])
    .execute();

  // Note: user_proposal_group_last_read is in DAO-specific schemas (e.g., arbitrum schema)
  // So we don't create an index for it in the public schema

  // Optimize discourse post lookups by user
  await db.schema
    .createIndex('idx_discourse_post_user_id_created_at')
    .on('discourse_post')
    .columns(['user_id', 'created_at desc'])
    .execute();

  // Speed up proposal lookups by multiple criteria
  await db.schema
    .createIndex('idx_proposal_dao_id_created_at')
    .on('proposal')
    .columns(['dao_id', 'created_at desc'])
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.schema.dropIndex('idx_proposal_group_dao_id_created_at').execute();
  await db.schema
    .dropIndex('idx_vote_proposal_id_voter_address_voting_power')
    .execute();
  await db.schema.dropIndex('idx_delegate_dao_id').execute();
  await db.schema
    .dropIndex('idx_voting_power_voter_dao_id_timestamp_desc')
    .execute();
  await db.schema.dropIndex('idx_discourse_post_user_id_created_at').execute();
  await db.schema.dropIndex('idx_proposal_dao_id_created_at').execute();
}
