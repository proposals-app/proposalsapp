import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Add composite index for vote filtering by proposal and voting power
  // This is needed for the getFeed function when filtering votes by voting power thresholds
  await db.schema
    .createIndex('idx_vote_proposal_id_voting_power')
    .on('vote')
    .columns(['proposal_id', 'voting_power'])
    .execute();

  // Note: idx_vote_proposal_id_voter_address already exists

  // Add index for discourse posts filtering by topic and creation time
  // This helps with sorting posts by creation time within a topic
  await db.schema
    .createIndex('idx_discourse_post_topic_created_at')
    .on('discourse_post')
    .columns(['topic_id', 'created_at'])
    .execute();

  // Note: idx_voting_power_dao_id_voter_timestamp_voting_power already exists
  // and covers our use case for voting power lookups

  // Note: idx_proposal_group_items already exists as a regular index
  // We don't need the GIN index since we're not doing JSON queries

  // Add index for delegate to voter lookups by voter and creation time
  // This helps with finding the most recent delegate link for a voter
  await db.schema
    .createIndex('idx_delegate_to_voter_voter_id_created_at')
    .on('delegate_to_voter')
    .columns(['voter_id', 'created_at'])
    .execute();

  // Add index for delegate to discourse user lookups by delegate and creation time
  // This helps with finding the most recent discourse link for a delegate
  await db.schema
    .createIndex('idx_delegate_to_discourse_user_delegate_id_created_at')
    .on('delegate_to_discourse_user')
    .columns(['delegate_id', 'created_at'])
    .execute();

  // Note: idx_proposal_external_id_governor_id already exists

  // Note: idx_discourse_topic_external_id_dao_discourse_id already exists
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_vote_proposal_id_voting_power').execute();
  await db.schema.dropIndex('idx_discourse_post_topic_created_at').execute();
  await db.schema.dropIndex('idx_delegate_to_voter_voter_id_created_at').execute();
  await db.schema.dropIndex('idx_delegate_to_discourse_user_delegate_id_created_at').execute();
}