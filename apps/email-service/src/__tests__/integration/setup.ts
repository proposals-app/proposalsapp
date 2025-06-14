import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Set environment variables for testing BEFORE any imports that might validate them
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
}
if (!process.env.ARBITRUM_DATABASE_URL) {
  process.env.ARBITRUM_DATABASE_URL =
    'postgresql://test:test@localhost:5432/test';
}
if (!process.env.UNISWAP_DATABASE_URL) {
  process.env.UNISWAP_DATABASE_URL =
    'postgresql://test:test@localhost:5432/test';
}

import {
  Kysely,
  sql,
  PostgresDialect,
  CamelCasePlugin,
  DeduplicateJoinsPlugin,
  ParseJSONResultsPlugin,
} from 'kysely';
import { Pool } from 'pg';
import {
  type StartedPostgreSqlContainer,
  PostgreSqlContainer,
} from '@testcontainers/postgresql';

import type { DB } from '@proposalsapp/db';

let testContainer: StartedPostgreSqlContainer;
let testDbPool: Pool;
let testDb: Kysely<DB>;

export const setupTestDatabase = () => {
  beforeAll(async () => {
    // Start PostgreSQL container
    console.log('Starting PostgreSQL container...');
    testContainer = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('testdb')
      .withUsername('testuser')
      .withPassword('testpassword')
      .start();

    console.log(
      'PostgreSQL container started at:',
      testContainer.getConnectionUri()
    );

    // Create test database pool
    testDbPool = new Pool({
      connectionString: testContainer.getConnectionUri(),
      max: 5, // Allow more connections for concurrent operations
    });

    testDb = new Kysely<DB>({
      dialect: new PostgresDialect({
        pool: testDbPool,
      }),
      plugins: [
        new CamelCasePlugin(),
        new DeduplicateJoinsPlugin(),
        new ParseJSONResultsPlugin(),
      ],
    });

    // Create test tables
    await createTestTables();
    console.log('Test database setup completed');
  }, 60000); // 60 second timeout for container startup

  afterAll(async () => {
    console.log('Tearing down test database...');
    try {
      if (testDb) {
        await testDb.destroy();
        testDb = null as any;
      }
    } catch (error) {
      console.warn('Error destroying testDb:', error);
    }

    try {
      if (testDbPool && !testDbPool.ended) {
        await testDbPool.end();
        testDbPool = null as any;
      }
    } catch (error) {
      console.warn('Error ending testDbPool:', error);
    }

    try {
      if (testContainer) {
        await testContainer.stop();
        testContainer = null as any;
      }
    } catch (error) {
      console.warn('Error stopping testContainer:', error);
    }
    console.log('Test database teardown completed');
  });

  beforeEach(async () => {
    // Clean all test data before each test
    await cleanTestData();
  });

  afterEach(async () => {
    // Clean all test data after each test
    await cleanTestData();
  });
};

async function createTestTables() {
  // Create test schemas first
  try {
    await sql`CREATE SCHEMA IF NOT EXISTS "public";`.execute(testDb);
    await sql`CREATE SCHEMA IF NOT EXISTS testdao;`.execute(testDb);

    // Create enum types
    await testDb.schema
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

    // Create tables following the exact real schema
    await testDb.schema
      .createTable('public.dao')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('slug', 'text', (col) => col.notNull())
      .addColumn('picture', 'text', (col) => col.notNull())
      .execute();

    await testDb.schema
      .createIndex('dao_name_key')
      .on('public.dao')
      .column('name')
      .unique()
      .execute();
    await testDb.schema
      .createIndex('dao_slug_key')
      .on('public.dao')
      .column('slug')
      .unique()
      .execute();

    await testDb.schema
      .createTable('public.dao_governor')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn('dao_id', 'uuid', (col) => col.notNull())
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('type', 'text', (col) => col.notNull())
      .addColumn('metadata', 'jsonb', (col) => col.notNull().defaultTo('{}'))
      .addColumn('enabled', 'boolean', (col) => col.notNull().defaultTo(true))
      .addColumn('portal_url', 'text')
      .addForeignKeyConstraint(
        'fk_dao_governor_dao_id',
        ['dao_id'],
        'public.dao',
        ['id'],
        (cb) => cb.onDelete('cascade')
      )
      .execute();

    await testDb.schema
      .createTable('public.dao_discourse')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn('dao_id', 'uuid', (col) => col.notNull())
      .addColumn('discourse_base_url', 'text', (col) => col.notNull())
      .addColumn('enabled', 'boolean', (col) => col.notNull().defaultTo(true))
      .addColumn('with_user_agent', 'boolean', (col) =>
        col.notNull().defaultTo(false)
      )
      .addForeignKeyConstraint(
        'fk_dao_discourse_dao_id',
        ['dao_id'],
        'public.dao',
        ['id'],
        (cb) => cb.onDelete('cascade')
      )
      .execute();

    await testDb.schema
      .createTable('public.proposal')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn('external_id', 'text', (col) => col.notNull())
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('body', 'text', (col) => col.notNull())
      .addColumn('url', 'text', (col) => col.notNull())
      .addColumn('discussion_url', 'text')
      .addColumn('choices', 'jsonb', (col) => col.notNull().defaultTo('[]'))
      .addColumn('quorum', 'float8', (col) => col.notNull())
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

    // Create DAO-specific user table (like arbitrum.user)
    await testDb.schema
      .createTable('testdao.user')
      .ifNotExists()
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('email', 'text', (col) => col.notNull())
      .addColumn('email_verified', 'boolean', (col) => col.notNull())
      .addColumn('image', 'text')
      .addColumn('created_at', 'timestamp', (col) => col.notNull())
      .addColumn('updated_at', 'timestamp', (col) => col.notNull())
      .addColumn('email_settings_new_proposals', 'boolean', (col) =>
        col.notNull().defaultTo(true)
      )
      .addColumn('email_settings_new_discussions', 'boolean', (col) =>
        col.notNull().defaultTo(true)
      )
      .addColumn('is_onboarded', 'boolean', (col) =>
        col.notNull().defaultTo(false)
      )
      .addColumn('email_settings_ending_proposals', 'boolean', (col) =>
        col.notNull().defaultTo(true)
      )
      .execute();

    await testDb.schema
      .createIndex('user_email_key')
      .on('testdao.user')
      .column('email')
      .unique()
      .execute();

    // Create DAO-specific user_notification table
    await testDb.schema
      .createTable('testdao.user_notification')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn('user_id', 'text', (col) => col.notNull())
      .addColumn('type', 'text', (col) => col.notNull())
      .addColumn('target_id', 'text', (col) => col.notNull())
      .addColumn('sent_at', 'timestamp', (col) =>
        col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
      )
      .addForeignKeyConstraint(
        'user_notification_userId_fkey',
        ['user_id'],
        'testdao.user',
        ['id'],
        (cb) => cb.onDelete('cascade')
      )
      .execute();

    await testDb.schema
      .createTable('public.discourse_topic')
      .ifNotExists()
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

    await testDb.schema
      .createTable('public.discourse_user')
      .ifNotExists()
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

    await testDb.schema
      .createTable('public.discourse_post')
      .ifNotExists()
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
      .addColumn('score', 'float8', (col) => col.notNull())
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

    await testDb.schema
      .createTable('public.proposal_group')
      .ifNotExists()
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

    console.log('Test tables created successfully');
  } catch (error) {
    console.error('Error creating test tables:', error);
    throw error;
  }
}

async function cleanTestData() {
  try {
    // Clean in dependency order
    // Note: We need to use the .withSchema() method for DAO-specific tables
    await testDb.withSchema('testdao').deleteFrom('userNotification').execute();
    await testDb.deleteFrom('discoursePost').execute();
    await testDb.deleteFrom('discourseTopic').execute();
    await testDb.deleteFrom('discourseUser').execute();
    await testDb.deleteFrom('proposalGroup').execute();
    await testDb.deleteFrom('proposal').execute();
    await testDb.withSchema('testdao').deleteFrom('user').execute();
    await testDb.deleteFrom('daoDiscourse').execute();
    await testDb.deleteFrom('daoGovernor').execute();
    await testDb.deleteFrom('dao').execute();
  } catch (error) {
    console.error('Error cleaning test data:', error);
    throw error;
  }
}

export function getTestDb(): Kysely<DB> {
  return testDb;
}

export async function createTestData() {
  // Create test DAO
  const [dao] = await testDb
    .insertInto('dao')
    .values({
      name: 'Test DAO',
      slug: 'testdao',
      picture: 'https://example.com/dao.jpg',
    })
    .returning(['id', 'name', 'slug', 'picture'])
    .execute();

  // Create test governor
  const [governor] = await testDb
    .insertInto('daoGovernor')
    .values({
      daoId: dao.id,
      name: 'Test Governor',
      type: 'governor',
      enabled: true,
      metadata: {},
    })
    .returning('id')
    .execute();

  // Create test discourse
  const [discourse] = await testDb
    .insertInto('daoDiscourse')
    .values({
      daoId: dao.id,
      discourseBaseUrl: 'https://forum.example.com',
      enabled: true,
      withUserAgent: false,
    })
    .returning('id')
    .execute();

  // Create test user
  const [user] = await testDb
    .withSchema('testdao')
    .insertInto('user')
    .values({
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      emailVerified: true,
      emailSettingsNewProposals: true,
      emailSettingsNewDiscussions: true,
      emailSettingsEndingProposals: true,
      isOnboarded: true,
      createdAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .returning('id')
    .execute();

  // Create test discourse user
  const [discourseUser] = await testDb
    .insertInto('discourseUser')
    .values({
      daoDiscourseId: discourse.id,
      externalId: 1,
      username: 'testuser',
      name: 'Test User',
      avatarTemplate: '/avatar/{size}.jpg',
      likesGiven: 10n,
      likesReceived: 20n,
      daysVisited: 30n,
      postsRead: 100n,
      topicsEntered: 50n,
      postCount: 25n,
      topicCount: 15n,
    })
    .returning(['id', 'externalId', 'username'])
    .execute();

  return {
    dao,
    governor,
    discourse,
    user,
    discourseUser,
  };
}
