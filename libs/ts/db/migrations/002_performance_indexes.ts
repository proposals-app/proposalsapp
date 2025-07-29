import { sql, type Kysely } from 'kysely';
import type { DB } from '../src/kysely_db';

export async function up(db: Kysely<DB>): Promise<void> {
  // --- PRIMARY KEY AND FOREIGN KEY INDEXES ---
  // These are typically created automatically, but we'll ensure critical ones exist

  // --- JOB QUEUE INDEXES ---
  await db.schema
    .createIndex('idx_job_queue_status_created_at')
    .on('public.job_queue')
    .columns(['status', 'created_at'])
    .execute();

  // --- DAO INDEXES ---
  await db.schema
    .createIndex('idx_dao_slug')
    .on('public.dao')
    .column('slug')
    .unique()
    .execute();

  // --- DAO_DISCOURSE INDEXES ---
  // Composite index for queries filtering by dao
  // This covers both dao_id alone and (dao_id) queries
  await db.schema
    .createIndex('idx_dao_discourse_dao_id')
    .on('public.dao_discourse')
    .columns(['dao_id'])
    .execute();

  // --- DAO_GOVERNOR INDEXES ---
  // Composite index covers both dao_id alone and (dao_id, type) queries
  await db.schema
    .createIndex('idx_dao_governor_dao_id_type')
    .on('public.dao_governor')
    .columns(['dao_id', 'type'])
    .execute();

  // --- DELEGATE INDEXES ---
  await db.schema
    .createIndex('idx_delegate_dao_id')
    .on('public.delegate')
    .column('dao_id')
    .execute();

  // --- DISCOURSE_USER INDEXES ---
  await db.schema
    .createIndex('idx_discourse_user_external_id_dao_discourse_id')
    .on('public.discourse_user')
    .columns(['external_id', 'dao_discourse_id'])
    .unique()
    .execute();

  await db.schema
    .createIndex('idx_discourse_user_dao_discourse_id')
    .on('public.discourse_user')
    .column('dao_discourse_id')
    .execute();

  await db.schema
    .createIndex('idx_discourse_user_username_dao_discourse_id')
    .on('public.discourse_user')
    .columns(['username', 'dao_discourse_id'])
    .execute();

  // --- DELEGATE_TO_DISCOURSE_USER INDEXES ---
  await db.schema
    .createIndex('idx_delegate_to_discourse_user_delegate_id')
    .on('public.delegate_to_discourse_user')
    .column('delegate_id')
    .execute();

  await db.schema
    .createIndex('idx_delegate_to_discourse_user_discourse_user_id')
    .on('public.delegate_to_discourse_user')
    .column('discourse_user_id')
    .execute();

  await db.schema
    .createIndex('idx_delegate_to_discourse_user_created_at')
    .on('public.delegate_to_discourse_user')
    .column('created_at')
    .execute();

  await db.schema
    .createIndex('idx_delegate_to_discourse_user_period')
    .on('public.delegate_to_discourse_user')
    .columns(['period_start', 'period_end'])
    .execute();

  // Composite index for DELETE operations
  await db.schema
    .createIndex('idx_delegate_to_discourse_user_delegate_discourse')
    .on('public.delegate_to_discourse_user')
    .columns(['delegate_id', 'discourse_user_id'])
    .execute();

  // --- VOTER INDEXES ---
  await db.schema
    .createIndex('idx_voter_address')
    .on('public.voter')
    .column('address')
    .unique()
    .execute();

  await db.schema
    .createIndex('idx_voter_ens')
    .on('public.voter')
    .column('ens')
    .where('ens', 'is not', null)
    .execute();

  // --- DELEGATE_TO_VOTER INDEXES ---
  await db.schema
    .createIndex('idx_delegate_to_voter_delegate_id')
    .on('public.delegate_to_voter')
    .column('delegate_id')
    .execute();

  await db.schema
    .createIndex('idx_delegate_to_voter_voter_id')
    .on('public.delegate_to_voter')
    .column('voter_id')
    .execute();

  await db.schema
    .createIndex('idx_delegate_to_voter_created_at')
    .on('public.delegate_to_voter')
    .column('created_at')
    .execute();

  await db.schema
    .createIndex('idx_delegate_to_voter_voter_id_created_at')
    .on('public.delegate_to_voter')
    .columns(['voter_id', 'created_at'])
    .execute();

  // Composite index for DELETE operations
  await db.schema
    .createIndex('idx_delegate_to_voter_delegate_voter')
    .on('public.delegate_to_voter')
    .columns(['delegate_id', 'voter_id'])
    .execute();

  // --- DELEGATION INDEXES ---
  await db.schema
    .createIndex('idx_delegation_dao_id')
    .on('public.delegation')
    .column('dao_id')
    .execute();

  await db.schema
    .createIndex('idx_delegation_delegator')
    .on('public.delegation')
    .column('delegator')
    .execute();

  await db.schema
    .createIndex('idx_delegation_delegate')
    .on('public.delegation')
    .column('delegate')
    .execute();

  await db.schema
    .createIndex('idx_delegation_dao_id_delegator_delegate')
    .on('public.delegation')
    .columns(['dao_id', 'delegator', 'delegate'])
    .execute();

  await db.schema
    .createIndex('idx_delegation_block')
    .on('public.delegation')
    .column('block')
    .execute();

  // --- DISCOURSE_CATEGORY INDEXES ---
  await db.schema
    .createIndex('idx_discourse_category_external_id_dao_discourse_id')
    .on('public.discourse_category')
    .columns(['external_id', 'dao_discourse_id'])
    .unique()
    .execute();

  await db.schema
    .createIndex('idx_discourse_category_dao_discourse_id')
    .on('public.discourse_category')
    .column('dao_discourse_id')
    .execute();

  await db.schema
    .createIndex('idx_discourse_category_slug')
    .on('public.discourse_category')
    .column('slug')
    .execute();

  // --- DISCOURSE_POST INDEXES ---
  await db.schema
    .createIndex('idx_discourse_post_external_id_dao_discourse_id')
    .on('public.discourse_post')
    .columns(['external_id', 'dao_discourse_id'])
    .unique()
    .execute();

  await db.schema
    .createIndex('idx_discourse_post_user_id')
    .on('public.discourse_post')
    .column('user_id')
    .execute();

  await db.schema
    .createIndex('idx_discourse_post_created_at')
    .on('public.discourse_post')
    .column('created_at')
    .execute();

  await db.schema
    .createIndex('idx_discourse_post_deleted')
    .on('public.discourse_post')
    .column('deleted')
    .where('deleted', '=', false)
    .execute();

  // Index for revision update queries
  await db.schema
    .createIndex('idx_discourse_post_version_history')
    .on('public.discourse_post')
    .columns([
      'dao_discourse_id',
      'version',
      'can_view_edit_history',
      'deleted',
    ])
    .where('version', '>', 1)
    .execute();

  // Index for recent updates (used in revision indexer)
  await db.schema
    .createIndex('idx_discourse_post_updated_at')
    .on('public.discourse_post')
    .column('updated_at')
    .execute();

  // Comprehensive index for queries filtering by dao, topic, and post number
  // This covers topic_id alone, (topic_id, dao_discourse_id), and all three columns
  await db.schema
    .createIndex('idx_discourse_post_topic_dao_postnumber')
    .on('public.discourse_post')
    .columns(['topic_id', 'dao_discourse_id', 'post_number'])
    .execute();

  // --- DISCOURSE_POST_LIKE INDEXES ---
  await db.schema
    .createIndex('idx_discourse_post_like_post_dao')
    .on('public.discourse_post_like')
    .columns(['external_discourse_post_id', 'dao_discourse_id'])
    .execute();

  await db.schema
    .createIndex('idx_discourse_post_like_user_dao')
    .on('public.discourse_post_like')
    .columns(['external_user_id', 'dao_discourse_id'])
    .execute();

  await db.schema
    .createIndex('idx_discourse_post_like_created_at')
    .on('public.discourse_post_like')
    .column('created_at')
    .execute();

  // --- DISCOURSE_POST_REVISION INDEXES ---
  await db.schema
    .createIndex('idx_discourse_post_revision_discourse_post_id')
    .on('public.discourse_post_revision')
    .column('discourse_post_id')
    .execute();

  await db.schema
    .createIndex('idx_discourse_post_revision_external_post_version')
    .on('public.discourse_post_revision')
    .columns(['external_post_id', 'version'])
    .execute();

  // Unique constraint for upsert operations in discourse
  await db.schema
    .createIndex('idx_discourse_post_revision_unique')
    .on('public.discourse_post_revision')
    .columns(['external_post_id', 'version', 'dao_discourse_id'])
    .unique()
    .execute();

  // --- DISCOURSE_TOPIC INDEXES ---
  await db.schema
    .createIndex('idx_discourse_topic_external_id_dao_discourse_id')
    .on('public.discourse_topic')
    .columns(['external_id', 'dao_discourse_id'])
    .unique()
    .execute();

  await db.schema
    .createIndex('idx_discourse_topic_dao_discourse_id')
    .on('public.discourse_topic')
    .column('dao_discourse_id')
    .execute();

  await db.schema
    .createIndex('idx_discourse_topic_slug_dao_discourse_id')
    .on('public.discourse_topic')
    .columns(['slug', 'dao_discourse_id'])
    .execute();

  await db.schema
    .createIndex('idx_discourse_topic_category_id')
    .on('public.discourse_topic')
    .column('category_id')
    .execute();

  await db.schema
    .createIndex('idx_discourse_topic_created_at')
    .on('public.discourse_topic')
    .column('created_at')
    .execute();

  await db.schema
    .createIndex('idx_discourse_topic_last_posted_at')
    .on('public.discourse_topic')
    .column('last_posted_at')
    .execute();

  await db.schema
    .createIndex('idx_discourse_topic_visible')
    .on('public.discourse_topic')
    .column('visible')
    .where('visible', '=', true)
    .execute();

  // --- PROPOSAL INDEXES ---
  await db.schema
    .createIndex('idx_proposal_external_id_governor_id')
    .on('public.proposal')
    .columns(['external_id', 'governor_id'])
    .unique()
    .execute();

  await db.schema
    .createIndex('idx_proposal_dao_id')
    .on('public.proposal')
    .column('dao_id')
    .execute();

  await db.schema
    .createIndex('idx_proposal_governor_id')
    .on('public.proposal')
    .column('governor_id')
    .execute();

  // Composite index for dao_id and state queries
  // This covers both proposal_state alone and (dao_id, proposal_state) queries
  await db.schema
    .createIndex('idx_proposal_dao_id_state')
    .on('public.proposal')
    .columns(['dao_id', 'proposal_state'])
    .execute();

  await db.schema
    .createIndex('idx_proposal_start_at')
    .on('public.proposal')
    .column('start_at')
    .execute();

  await db.schema
    .createIndex('idx_proposal_end_at')
    .on('public.proposal')
    .column('end_at')
    .execute();

  await db.schema
    .createIndex('idx_proposal_created_at')
    .on('public.proposal')
    .column('created_at')
    .execute();

  await db.schema
    .createIndex('idx_proposal_author')
    .on('public.proposal')
    .column('author')
    .where('author', 'is not', null)
    .execute();

  await db.schema
    .createIndex('idx_proposal_marked_spam')
    .on('public.proposal')
    .column('marked_spam')
    .where('marked_spam', '=', false)
    .execute();

  // Composite index for active proposals query
  await db.schema
    .createIndex('idx_proposal_active_state_time')
    .on('public.proposal')
    .columns(['proposal_state', 'start_at', 'end_at'])
    .where('proposal_state', '=', 'ACTIVE')
    .execute();

  // Index for rindexer proposal state updates
  await db.schema
    .createIndex('idx_proposal_governor_state_end')
    .on('public.proposal')
    .columns(['governor_id', 'proposal_state', 'end_at'])
    .execute();

  // --- PROPOSAL_GROUP INDEXES ---
  await db.schema
    .createIndex('idx_proposal_group_created_at')
    .on('public.proposal_group')
    .column('created_at')
    .execute();

  // Composite index for dao_id and created_at queries
  // This covers dao_id alone, (dao_id, created_at), and (dao_id, name) queries
  await db.schema
    .createIndex('idx_proposal_group_dao_id_created_at')
    .on('public.proposal_group')
    .columns(['dao_id', 'created_at'])
    .execute();

  // Composite index for filtering by name and dao_id
  await db.schema
    .createIndex('idx_proposal_group_dao_id_name')
    .on('public.proposal_group')
    .columns(['dao_id', 'name'])
    .execute();

  // --- VOTE INDEXES ---
  await db.schema
    .createIndex('idx_vote_proposal_id')
    .on('public.vote')
    .column('proposal_id')
    .execute();

  await db.schema
    .createIndex('idx_vote_voter_address')
    .on('public.vote')
    .column('voter_address')
    .execute();

  await db.schema
    .createIndex('idx_vote_dao_id')
    .on('public.vote')
    .column('dao_id')
    .execute();

  await db.schema
    .createIndex('idx_vote_governor_id')
    .on('public.vote')
    .column('governor_id')
    .execute();

  await db.schema
    .createIndex('idx_vote_created_at')
    .on('public.vote')
    .column('created_at')
    .execute();

  await db.schema
    .createIndex('idx_vote_proposal_external_id_governor_id')
    .on('public.vote')
    .columns(['proposal_external_id', 'governor_id'])
    .execute();

  await db.schema
    .createIndex('idx_vote_proposal_voter')
    .on('public.vote')
    .columns(['proposal_id', 'voter_address'])
    .execute();

  // Index for vote counting by proposal (used in rindexer)
  await db.schema
    .createIndex('idx_vote_proposal_id_choice')
    .on('public.vote')
    .columns(['proposal_id', 'choice'])
    .execute();

  // --- VOTING_POWER INDEXES ---
  await db.schema
    .createIndex('idx_voting_power_dao_id_timestamp')
    .on('public.voting_power')
    .columns(['dao_id', 'timestamp'])
    .execute();

  // This index covers (voter, dao_id) and (voter, dao_id, timestamp) queries
  await db.schema
    .createIndex('idx_voting_power_voter_dao_id_timestamp')
    .on('public.voting_power')
    .columns(['voter', 'dao_id', 'timestamp'])
    .execute();

  await db.schema
    .createIndex('idx_voting_power_block')
    .on('public.voting_power')
    .column('block')
    .execute();

  // Composite index for distinct voting power queries
  await db.schema
    .createIndex('idx_voting_power_distinct_latest')
    .on('public.voting_power')
    .columns(['dao_id', 'voter', 'timestamp'])
    .execute();

  // Partial index for non-zero voting power
  await db.schema
    .createIndex('idx_voting_power_non_zero')
    .on('public.voting_power')
    .columns(['dao_id', 'voting_power'])
    .where('voting_power', '>', 0)
    .execute();

  // Index for getNonVoters eligible voters query
  await db.schema
    .createIndex('idx_voting_power_dao_timestamp_positive')
    .on('public.voting_power')
    .columns(['dao_id', 'timestamp', 'voter'])
    .where('voting_power', '>', 0)
    .execute();

  // Index for voter address lookup (used in vote joins)
  await db.schema
    .createIndex('idx_voter_address_id')
    .on('public.voter')
    .columns(['address', 'id'])
    .execute();

  // --- JSONB GIN INDEXES ---
  await sql`CREATE INDEX idx_proposal_metadata_gin ON public.proposal USING gin (metadata);`.execute(
    db
  );
  await sql`CREATE INDEX idx_proposal_metadata_hidden_vote ON public.proposal ((metadata->>'hidden_vote')) WHERE metadata->>'hidden_vote' = 'true';`.execute(
    db
  );
  await sql`CREATE INDEX idx_proposal_group_items_gin ON public.proposal_group USING gin (items);`.execute(
    db
  );
  await sql`CREATE INDEX idx_vote_choice_gin ON public.vote USING gin (choice);`.execute(
    db
  );

  // --- CRITICAL PERFORMANCE INDEXES FROM PG_STAT_STATEMENTS ANALYSIS ---

  // Critical composite index for proposal queries (5-11 second queries)
  await db.schema
    .createIndex('idx_proposal_dao_state_created_at')
    .on('public.proposal')
    .columns(['dao_id', 'proposal_state', 'created_at'])
    .where('marked_spam', '=', false)
    .execute();

  // Critical index for vote queries (2-6 second queries)
  await db.schema
    .createIndex('idx_vote_voter_proposal_created')
    .on('public.vote')
    .columns(['voter_address', 'proposal_id', 'created_at'])
    .execute();

  // Better index for vote proposal lookups
  await db.schema
    .createIndex('idx_vote_proposal_created')
    .on('public.vote')
    .columns(['proposal_id', 'created_at'])
    .execute();

  // Index for time-based active proposal queries
  await db.schema
    .createIndex('idx_proposal_active_time_range')
    .on('public.proposal')
    .columns(['proposal_state', 'end_at', 'start_at'])
    .where('proposal_state', '=', 'ACTIVE')
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  // Drop indexes in reverse order

  // Drop critical performance indexes
  await db.schema
    .dropIndex('idx_proposal_active_time_range')
    .ifExists()
    .execute();
  await db.schema.dropIndex('idx_vote_proposal_created').ifExists().execute();
  await db.schema
    .dropIndex('idx_vote_voter_proposal_created')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_proposal_dao_state_created_at')
    .ifExists()
    .execute();

  // Drop JSONB indexes
  await sql`DROP INDEX IF EXISTS idx_vote_choice_gin;`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_proposal_group_items_gin;`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_proposal_metadata_hidden_vote;`.execute(
    db
  );
  await sql`DROP INDEX IF EXISTS idx_proposal_metadata_gin;`.execute(db);

  // Drop voting_power indexes
  await db.schema
    .dropIndex('idx_voting_power_dao_timestamp_positive')
    .ifExists()
    .execute();
  await db.schema.dropIndex('idx_voting_power_non_zero').ifExists().execute();
  await db.schema
    .dropIndex('idx_voting_power_distinct_latest')
    .ifExists()
    .execute();
  await db.schema.dropIndex('idx_voting_power_block').ifExists().execute();
  await db.schema
    .dropIndex('idx_voting_power_voter_dao_id_timestamp')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_voting_power_dao_id_timestamp')
    .ifExists()
    .execute();

  // Drop vote indexes
  await db.schema.dropIndex('idx_vote_proposal_id_choice').ifExists().execute();
  await db.schema.dropIndex('idx_vote_proposal_voter').ifExists().execute();
  await db.schema
    .dropIndex('idx_vote_proposal_external_id_governor_id')
    .ifExists()
    .execute();
  await db.schema.dropIndex('idx_vote_created_at').ifExists().execute();
  await db.schema.dropIndex('idx_vote_governor_id').ifExists().execute();
  await db.schema.dropIndex('idx_vote_dao_id').ifExists().execute();
  await db.schema.dropIndex('idx_vote_voter_address').ifExists().execute();
  await db.schema.dropIndex('idx_vote_proposal_id').ifExists().execute();

  // Drop proposal_group indexes
  await db.schema
    .dropIndex('idx_proposal_group_dao_id_name')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_proposal_group_dao_id_created_at')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_proposal_group_created_at')
    .ifExists()
    .execute();

  // Drop proposal indexes
  await db.schema
    .dropIndex('idx_proposal_governor_state_end')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_proposal_active_state_time')
    .ifExists()
    .execute();
  await db.schema.dropIndex('idx_proposal_marked_spam').ifExists().execute();
  await db.schema.dropIndex('idx_proposal_author').ifExists().execute();
  await db.schema.dropIndex('idx_proposal_created_at').ifExists().execute();
  await db.schema.dropIndex('idx_proposal_end_at').ifExists().execute();
  await db.schema.dropIndex('idx_proposal_start_at').ifExists().execute();
  await db.schema.dropIndex('idx_proposal_dao_id_state').ifExists().execute();
  await db.schema.dropIndex('idx_proposal_governor_id').ifExists().execute();
  await db.schema.dropIndex('idx_proposal_dao_id').ifExists().execute();
  await db.schema
    .dropIndex('idx_proposal_external_id_governor_id')
    .ifExists()
    .execute();

  // Drop discourse_topic indexes
  await db.schema.dropIndex('idx_discourse_topic_visible').ifExists().execute();
  await db.schema
    .dropIndex('idx_discourse_topic_last_posted_at')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_discourse_topic_created_at')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_discourse_topic_category_id')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_discourse_topic_slug_dao_discourse_id')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_discourse_topic_dao_discourse_id')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_discourse_topic_external_id_dao_discourse_id')
    .ifExists()
    .execute();

  // Drop discourse_post_revision indexes
  await db.schema
    .dropIndex('idx_discourse_post_revision_unique')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_discourse_post_revision_external_post_version')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_discourse_post_revision_discourse_post_id')
    .ifExists()
    .execute();

  // Drop discourse_post_like indexes
  await db.schema
    .dropIndex('idx_discourse_post_like_created_at')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_discourse_post_like_user_dao')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_discourse_post_like_post_dao')
    .ifExists()
    .execute();

  // Drop discourse_post indexes
  await db.schema
    .dropIndex('idx_discourse_post_topic_dao_postnumber')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_discourse_post_updated_at')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_discourse_post_version_history')
    .ifExists()
    .execute();
  await db.schema.dropIndex('idx_discourse_post_deleted').ifExists().execute();
  await db.schema
    .dropIndex('idx_discourse_post_created_at')
    .ifExists()
    .execute();
  await db.schema.dropIndex('idx_discourse_post_user_id').ifExists().execute();
  await db.schema
    .dropIndex('idx_discourse_post_external_id_dao_discourse_id')
    .ifExists()
    .execute();

  // Drop discourse_category indexes
  await db.schema.dropIndex('idx_discourse_category_slug').ifExists().execute();
  await db.schema
    .dropIndex('idx_discourse_category_dao_discourse_id')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_discourse_category_external_id_dao_discourse_id')
    .ifExists()
    .execute();

  // Drop delegation indexes
  await db.schema.dropIndex('idx_delegation_block').ifExists().execute();
  await db.schema
    .dropIndex('idx_delegation_dao_id_delegator_delegate')
    .ifExists()
    .execute();
  await db.schema.dropIndex('idx_delegation_delegate').ifExists().execute();
  await db.schema.dropIndex('idx_delegation_delegator').ifExists().execute();
  await db.schema.dropIndex('idx_delegation_dao_id').ifExists().execute();

  // Drop delegate_to_voter indexes
  await db.schema
    .dropIndex('idx_delegate_to_voter_delegate_voter')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_delegate_to_voter_voter_id_created_at')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_delegate_to_voter_created_at')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_delegate_to_voter_voter_id')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_delegate_to_voter_delegate_id')
    .ifExists()
    .execute();

  // Drop voter indexes
  await db.schema.dropIndex('idx_voter_address_id').ifExists().execute();
  await db.schema.dropIndex('idx_voter_ens').ifExists().execute();
  await db.schema.dropIndex('idx_voter_address').ifExists().execute();

  // Drop delegate_to_discourse_user indexes
  await db.schema
    .dropIndex('idx_delegate_to_discourse_user_delegate_discourse')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_delegate_to_discourse_user_period')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_delegate_to_discourse_user_created_at')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_delegate_to_discourse_user_discourse_user_id')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_delegate_to_discourse_user_delegate_id')
    .ifExists()
    .execute();

  // Drop discourse_user indexes
  await db.schema
    .dropIndex('idx_discourse_user_username_dao_discourse_id')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_discourse_user_dao_discourse_id')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_discourse_user_external_id_dao_discourse_id')
    .ifExists()
    .execute();

  // Drop delegate indexes
  await db.schema.dropIndex('idx_delegate_dao_id').ifExists().execute();

  // Drop dao_governor indexes
  await db.schema
    .dropIndex('idx_dao_governor_dao_id_type')
    .ifExists()
    .execute();

  // Drop dao_discourse indexes
  await db.schema.dropIndex('idx_dao_discourse_dao_id').ifExists().execute();

  // Drop dao indexes
  await db.schema.dropIndex('idx_dao_slug').ifExists().execute();

  // Drop job_queue indexes
  await db.schema
    .dropIndex('idx_job_queue_status_created_at')
    .ifExists()
    .execute();
}
