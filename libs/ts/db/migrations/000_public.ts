import { sql, type Kysely } from 'kysely';
import type { DB } from '../src/kysely_db';

export async function up(db: Kysely<DB>): Promise<void> {
  // --- SCHEMAS ---
  await sql`CREATE SCHEMA IF NOT EXISTS "public";`.execute(db);
  await sql`COMMENT ON SCHEMA "public" IS 'standard public schema';`.execute(
    db
  );

  // --- ENUM TYPES ---
  await db.schema
    .createType('public.proposal_state')
    .asEnum([
      'PENDING',
      'ACTIVE',
      'CANCELED',
      'DEFEATED',
      'SUCCEEDED',
      'QUEUED',
      'EXPIRED',
      'EXECUTED',
      'HIDDEN',
      'UNKNOWN',
    ])
    .execute();

  // --- TABLES IN public SCHEMA ---
  await db.schema
    .createTable('public.job_queue')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('type', 'text', (col) => col.notNull())
    .addColumn('data', 'jsonb', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('PENDING'))
    .addColumn('created_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  await db.schema
    .createTable('public.dao')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('slug', 'text', (col) => col.notNull())
    .addColumn('picture', 'text', (col) => col.notNull())
    .execute();

  await db.schema
    .createTable('public.dao_discourse')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('dao_id', 'uuid', (col) => col.notNull())
    .addColumn('discourse_base_url', 'text', (col) => col.notNull())
    .addForeignKeyConstraint(
      'fk_dao_discourse_dao_id',
      ['dao_id'],
      'public.dao',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .execute();

  await db.schema
    .createTable('public.dao_governor')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('dao_id', 'uuid', (col) => col.notNull())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('type', 'text', (col) => col.notNull())
    .addColumn('portal_url', 'text')
    .addForeignKeyConstraint(
      'fk_dao_governor_dao_id',
      ['dao_id'],
      'public.dao',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .execute();

  await db.schema
    .createTable('public.delegate')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('dao_id', 'uuid', (col) => col.notNull())
    .addForeignKeyConstraint(
      'fk_delegate_dao_id',
      ['dao_id'],
      'public.dao',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .execute();

  await db.schema
    .createTable('public.discourse_user')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('external_id', 'integer', (col) => col.notNull())
    .addColumn('username', 'text', (col) => col.notNull())
    .addColumn('name', 'text')
    .addColumn('avatar_template', 'text', (col) => col.notNull())
    .addColumn('title', 'text')
    .addColumn('likes_received', 'bigint')
    .addColumn('likes_given', 'bigint')
    .addColumn('topics_entered', 'bigint')
    .addColumn('topic_count', 'bigint')
    .addColumn('post_count', 'bigint')
    .addColumn('posts_read', 'bigint')
    .addColumn('days_visited', 'bigint')
    .addColumn('dao_discourse_id', 'uuid', (col) => col.notNull())
    .addForeignKeyConstraint(
      'fk_discourse_user_dao_discourse_id',
      ['dao_discourse_id'],
      'public.dao_discourse',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .execute();

  await db.schema
    .createTable('public.delegate_to_discourse_user')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('delegate_id', 'uuid', (col) => col.notNull())
    .addColumn('discourse_user_id', 'uuid', (col) => col.notNull())
    .addColumn('period_start', 'timestamp', (col) => col.notNull())
    .addColumn('period_end', 'timestamp', (col) => col.notNull())
    .addColumn('proof', 'jsonb')
    .addColumn('verified', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('created_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addForeignKeyConstraint(
      'fk_delegate_to_discourse_user_delegate_id',
      ['delegate_id'],
      'public.delegate',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .addForeignKeyConstraint(
      'fk_delegate_to_discourse_user_discourse_user_id',
      ['discourse_user_id'],
      'public.discourse_user',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .execute();

  await db.schema
    .createTable('public.voter')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('address', 'text', (col) => col.notNull())
    .addColumn('ens', 'text')
    .addColumn('avatar', 'text')
    .addColumn('updated_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  await db.schema
    .createTable('public.delegate_to_voter')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('delegate_id', 'uuid', (col) => col.notNull())
    .addColumn('voter_id', 'uuid', (col) => col.notNull())
    .addColumn('period_start', 'timestamp', (col) => col.notNull())
    .addColumn('period_end', 'timestamp', (col) => col.notNull())
    .addColumn('proof', 'jsonb')
    .addColumn('verified', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('created_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addForeignKeyConstraint(
      'fk_delegate_to_voter_delegate_id',
      ['delegate_id'],
      'public.delegate',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .addForeignKeyConstraint(
      'fk_delegate_to_voter_voter_id',
      ['voter_id'],
      'public.voter',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .execute();

  await db.schema
    .createTable('public.delegation')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('delegator', 'text', (col) => col.notNull())
    .addColumn('delegate', 'text', (col) => col.notNull())
    .addColumn('dao_id', 'uuid', (col) => col.notNull())
    .addColumn('timestamp', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addColumn('block', 'integer', (col) => col.notNull())
    .addColumn('txid', 'text')
    .addForeignKeyConstraint(
      'fk_delegation_dao_id',
      ['dao_id'],
      'public.dao',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .execute();

  await db.schema
    .createTable('public.discourse_category')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('external_id', 'integer', (col) => col.notNull())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('color', 'text', (col) => col.notNull())
    .addColumn('text_color', 'text', (col) => col.notNull())
    .addColumn('slug', 'text', (col) => col.notNull())
    .addColumn('topic_count', 'integer', (col) => col.notNull())
    .addColumn('post_count', 'integer', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('description_text', 'text')
    .addColumn('topics_day', 'integer')
    .addColumn('topics_week', 'integer')
    .addColumn('topics_month', 'integer')
    .addColumn('topics_year', 'integer')
    .addColumn('topics_all_time', 'integer')
    .addColumn('dao_discourse_id', 'uuid', (col) => col.notNull())
    .addForeignKeyConstraint(
      'fk_discourse_category_dao_discourse_id',
      ['dao_discourse_id'],
      'public.dao_discourse',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .execute();

  await db.schema
    .createTable('public.discourse_post')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('external_id', 'integer', (col) => col.notNull())
    .addColumn('name', 'text')
    .addColumn('username', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.notNull())
    .addColumn('cooked', 'text')
    .addColumn('post_number', 'integer', (col) => col.notNull())
    .addColumn('post_type', 'integer', (col) => col.notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.notNull())
    .addColumn('reply_count', 'integer', (col) => col.notNull())
    .addColumn('reply_to_post_number', 'integer')
    .addColumn('quote_count', 'integer', (col) => col.notNull())
    .addColumn('incoming_link_count', 'integer', (col) => col.notNull())
    .addColumn('reads', 'integer', (col) => col.notNull())
    .addColumn('readers_count', 'integer', (col) => col.notNull())
    .addColumn('score', 'float8', (col) => col.notNull()) // double precision -> float8
    .addColumn('topic_id', 'integer', (col) => col.notNull())
    .addColumn('topic_slug', 'text', (col) => col.notNull())
    .addColumn('display_username', 'text')
    .addColumn('primary_group_name', 'text')
    .addColumn('flair_name', 'text')
    .addColumn('flair_url', 'text')
    .addColumn('flair_bg_color', 'text')
    .addColumn('flair_color', 'text')
    .addColumn('version', 'integer', (col) => col.notNull())
    .addColumn('user_id', 'integer', (col) => col.notNull())
    .addColumn('dao_discourse_id', 'uuid', (col) => col.notNull())
    .addColumn('can_view_edit_history', 'boolean', (col) =>
      col.notNull().defaultTo(false)
    )
    .addColumn('deleted', 'boolean', (col) => col.notNull().defaultTo(false))
    .addForeignKeyConstraint(
      'fk_discourse_post_dao_discourse_id',
      ['dao_discourse_id'],
      'public.dao_discourse',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .execute();

  await db.schema
    .createTable('public.discourse_post_like')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('external_discourse_post_id', 'integer', (col) => col.notNull())
    .addColumn('external_user_id', 'integer', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.notNull())
    .addColumn('dao_discourse_id', 'uuid', (col) => col.notNull())
    .addForeignKeyConstraint(
      'fk_discourse_post_like_dao_discourse_id',
      ['dao_discourse_id'],
      'public.dao_discourse',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .execute();

  await db.schema
    .createTable('public.discourse_post_revision')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('discourse_post_id', 'uuid', (col) => col.notNull())
    .addColumn('external_post_id', 'integer', (col) => col.notNull())
    .addColumn('version', 'integer', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.notNull())
    .addColumn('username', 'text', (col) => col.notNull())
    .addColumn('body_changes', 'text', (col) => col.notNull())
    .addColumn('edit_reason', 'text')
    .addColumn('dao_discourse_id', 'uuid', (col) => col.notNull())
    .addColumn('title_changes', 'text')
    .addColumn('cooked_body_before', 'text')
    .addColumn('cooked_title_before', 'text')
    .addColumn('cooked_body_after', 'text')
    .addColumn('cooked_title_after', 'text')
    .addForeignKeyConstraint(
      'fk_discourse_post_revision_dao_discourse_id',
      ['dao_discourse_id'],
      'public.dao_discourse',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .addForeignKeyConstraint(
      'fk_discourse_post_revision_discourse_post_id',
      ['discourse_post_id'],
      'public.discourse_post',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .execute();

  await db.schema
    .createTable('public.discourse_topic')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('external_id', 'integer', (col) => col.notNull())
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('fancy_title', 'text', (col) => col.notNull())
    .addColumn('slug', 'text', (col) => col.notNull())
    .addColumn('posts_count', 'integer', (col) => col.notNull())
    .addColumn('reply_count', 'integer', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.notNull())
    .addColumn('last_posted_at', 'timestamp', (col) => col.notNull())
    .addColumn('bumped_at', 'timestamp', (col) => col.notNull())
    .addColumn('pinned', 'boolean', (col) => col.notNull())
    .addColumn('pinned_globally', 'boolean', (col) => col.notNull())
    .addColumn('visible', 'boolean', (col) => col.notNull())
    .addColumn('closed', 'boolean', (col) => col.notNull())
    .addColumn('archived', 'boolean', (col) => col.notNull())
    .addColumn('views', 'integer', (col) => col.notNull())
    .addColumn('like_count', 'integer', (col) => col.notNull())
    .addColumn('category_id', 'integer', (col) => col.notNull())
    .addColumn('dao_discourse_id', 'uuid', (col) => col.notNull())
    .addForeignKeyConstraint(
      'fk_discourse_topic_dao_discourse_id',
      ['dao_discourse_id'],
      'public.dao_discourse',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .execute();

  await db.schema
    .createTable('public.proposal')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('external_id', 'text', (col) => col.notNull())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('body', 'text', (col) => col.notNull())
    .addColumn('url', 'text', (col) => col.notNull())
    .addColumn('discussion_url', 'text')
    .addColumn('choices', 'jsonb', (col) => col.notNull().defaultTo('[]'))
    .addColumn('quorum', 'float8', (col) => col.notNull()) // double precision -> float8
    .addColumn('proposal_state', sql`public.proposal_state`, (col) =>
      col.notNull()
    )
    .addColumn('marked_spam', 'boolean', (col) =>
      col.notNull().defaultTo(false)
    )
    .addColumn('created_at', 'timestamp', (col) => col.notNull())
    .addColumn('start_at', 'timestamp', (col) => col.notNull())
    .addColumn('end_at', 'timestamp', (col) => col.notNull())
    .addColumn('block_created_at', 'integer')
    .addColumn('txid', 'text')
    .addColumn('metadata', 'jsonb')
    .addColumn('dao_id', 'uuid', (col) => col.notNull())
    .addColumn('author', 'text')
    .addColumn('governor_id', 'uuid', (col) => col.notNull())
    .addColumn('block_start_at', 'integer')
    .addColumn('block_end_at', 'integer')
    .addForeignKeyConstraint(
      'fk_proposal_dao_id',
      ['dao_id'],
      'public.dao',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .addForeignKeyConstraint(
      'fk_proposal_governor_id',
      ['governor_id'],
      'public.dao_governor',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .execute();

  await db.schema
    .createTable('public.proposal_group')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('items', 'jsonb', (col) => col.notNull().defaultTo('[]'))
    .addColumn('created_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addColumn('dao_id', 'uuid', (col) => col.notNull())
    .addForeignKeyConstraint(
      'fk_proposal_group_dao_id',
      ['dao_id'],
      'public.dao',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .execute();

  await db.schema
    .createTable('public.vote')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('voter_address', 'text', (col) => col.notNull())
    .addColumn('choice', 'jsonb', (col) => col.notNull().defaultTo('[]'))
    .addColumn('voting_power', 'float8', (col) => col.notNull()) // double precision -> float8
    .addColumn('reason', 'text')
    .addColumn('created_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addColumn('block_created_at', 'integer')
    .addColumn('txid', 'text')
    .addColumn('proposal_external_id', 'text', (col) => col.notNull())
    .addColumn('proposal_id', 'uuid', (col) => col.notNull())
    .addColumn('dao_id', 'uuid', (col) => col.notNull())
    .addColumn('governor_id', 'uuid', (col) => col.notNull())
    .addForeignKeyConstraint(
      'fk_vote_dao_id',
      ['dao_id'],
      'public.dao',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .addForeignKeyConstraint(
      'fk_vote_governor_id',
      ['governor_id'],
      'public.dao_governor',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .addForeignKeyConstraint(
      'fk_vote_proposal_id',
      ['proposal_id'],
      'public.proposal',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .addForeignKeyConstraint(
      'fk_vote_voter_address',
      ['voter_address'],
      'public.voter',
      ['address'],
      (cb) => cb.onDelete('cascade')
    )
    .execute();

  await db.schema
    .createTable('public.voting_power')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('voter', 'text', (col) => col.notNull())
    .addColumn('voting_power', 'float8', (col) => col.notNull()) // double precision -> float8
    .addColumn('dao_id', 'uuid', (col) => col.notNull())
    .addColumn('timestamp', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addColumn('block', 'integer', (col) => col.notNull())
    .addColumn('txid', 'text')
    .addForeignKeyConstraint(
      'fk_voting_power_dao_id',
      ['dao_id'],
      'public.dao',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  // --- DROP TABLES (Reverse order of creation, considering dependencies) ---

  // public schema tables (children first)
  await db.schema.dropTable('public.voting_power').ifExists().execute();
  await db.schema.dropTable('public.vote').ifExists().execute();
  await db.schema.dropTable('public.proposal_group').ifExists().execute();
  await db.schema.dropTable('public.proposal').ifExists().execute();
  await db.schema
    .dropTable('public.discourse_post_revision')
    .ifExists()
    .execute();
  await db.schema.dropTable('public.discourse_post_like').ifExists().execute();
  await db.schema.dropTable('public.discourse_post').ifExists().execute();
  await db.schema.dropTable('public.discourse_topic').ifExists().execute();
  await db.schema.dropTable('public.discourse_category').ifExists().execute();
  await db.schema.dropTable('public.delegate_to_voter').ifExists().execute();
  await db.schema
    .dropTable('public.delegate_to_discourse_user')
    .ifExists()
    .execute();
  await db.schema.dropTable('public.discourse_user').ifExists().execute();
  await db.schema.dropTable('public.voter').ifExists().execute();
  await db.schema.dropTable('public.delegation').ifExists().execute();
  await db.schema.dropTable('public.delegate').ifExists().execute();
  await db.schema.dropTable('public.dao_governor').ifExists().execute();
  await db.schema.dropTable('public.dao_discourse').ifExists().execute();
  await db.schema.dropTable('public.dao').ifExists().execute();
  await db.schema.dropTable('public.job_queue').ifExists().execute();

  // --- DROP ENUM TYPES ---
  await db.schema.dropType('public.proposal_state').ifExists().execute();
}
