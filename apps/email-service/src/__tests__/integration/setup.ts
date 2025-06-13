import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Kysely, sql, PostgresDialect } from 'kysely';
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
  // Create minimal tables needed for integration tests
  try {
    await testDb.schema
      .createTable('dao')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('slug', 'text', (col) => col.notNull().unique())
      .addColumn('picture', 'text', (col) => col.notNull())
      .execute();

    await testDb.schema
      .createTable('daoGovernor')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn('daoId', 'uuid', (col) => col.notNull().references('dao.id'))
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('type', 'text', (col) => col.notNull())
      .addColumn('enabled', 'boolean', (col) => col.notNull().defaultTo(true))
      .addColumn('portalUrl', 'text')
      .addColumn('metadata', 'jsonb', (col) => col.notNull().defaultTo('{}'))
      .execute();

    await testDb.schema
      .createTable('daoDiscourse')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn('daoId', 'uuid', (col) => col.notNull().references('dao.id'))
      .addColumn('discourseBaseUrl', 'text', (col) => col.notNull())
      .addColumn('enabled', 'boolean', (col) => col.notNull().defaultTo(true))
      .addColumn('withUserAgent', 'boolean', (col) =>
        col.notNull().defaultTo(false)
      )
      .execute();

    await testDb.schema
      .createTable('proposal')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn('daoId', 'uuid', (col) => col.notNull().references('dao.id'))
      .addColumn('governorId', 'uuid', (col) =>
        col.notNull().references('daoGovernor.id')
      )
      .addColumn('externalId', 'text', (col) => col.notNull())
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('body', 'text', (col) => col.notNull())
      .addColumn('url', 'text', (col) => col.notNull())
      .addColumn('discussionUrl', 'text')
      .addColumn('author', 'text')
      .addColumn('proposalState', 'text', (col) => col.notNull())
      .addColumn('startAt', 'timestamp', (col) => col.notNull())
      .addColumn('endAt', 'timestamp', (col) => col.notNull())
      .addColumn('quorum', 'numeric', (col) => col.notNull())
      .addColumn('choices', 'jsonb', (col) =>
        col.notNull().defaultTo(sql`'[]'::jsonb`)
      )
      .addColumn('metadata', 'jsonb')
      .addColumn('txid', 'text')
      .addColumn('blockCreatedAt', 'bigint')
      .addColumn('blockStartAt', 'bigint')
      .addColumn('blockEndAt', 'bigint')
      .addColumn('markedSpam', 'boolean', (col) =>
        col.notNull().defaultTo(false)
      )
      .addColumn('createdAt', 'timestamp', (col) =>
        col.notNull().defaultTo(sql`now()`)
      )
      .execute();

    await testDb.schema
      .createTable('user')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn('email', 'text', (col) => col.notNull().unique())
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('emailVerified', 'boolean', (col) =>
        col.notNull().defaultTo(false)
      )
      .addColumn('emailSettingsNewProposals', 'boolean', (col) =>
        col.notNull().defaultTo(true)
      )
      .addColumn('emailSettingsNewDiscussions', 'boolean', (col) =>
        col.notNull().defaultTo(true)
      )
      .addColumn('emailSettingsEndingProposals', 'boolean', (col) =>
        col.notNull().defaultTo(true)
      )
      .addColumn('isOnboarded', 'boolean', (col) =>
        col.notNull().defaultTo(false)
      )
      .addColumn('image', 'text')
      .addColumn('createdAt', 'timestamp', (col) =>
        col.notNull().defaultTo(sql`now()`)
      )
      .addColumn('updatedAt', 'timestamp', (col) =>
        col.notNull().defaultTo(sql`now()`)
      )
      .execute();

    await testDb.schema
      .createTable('userNotification')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn('userId', 'uuid', (col) => col.notNull().references('user.id'))
      .addColumn('targetId', 'text', (col) => col.notNull())
      .addColumn('type', 'text', (col) => col.notNull())
      .addColumn('sentAt', 'timestamp', (col) =>
        col.notNull().defaultTo(sql`now()`)
      )
      .execute();

    await testDb.schema
      .createTable('discourseTopic')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn('daoDiscourseId', 'uuid', (col) =>
        col.notNull().references('daoDiscourse.id')
      )
      .addColumn('externalId', 'integer', (col) => col.notNull())
      .addColumn('title', 'text', (col) => col.notNull())
      .addColumn('slug', 'text', (col) => col.notNull())
      .addColumn('fancyTitle', 'text', (col) => col.notNull())
      .addColumn('categoryId', 'integer', (col) => col.notNull())
      .addColumn('archived', 'boolean', (col) => col.notNull().defaultTo(false))
      .addColumn('closed', 'boolean', (col) => col.notNull().defaultTo(false))
      .addColumn('pinned', 'boolean', (col) => col.notNull().defaultTo(false))
      .addColumn('pinnedGlobally', 'boolean', (col) =>
        col.notNull().defaultTo(false)
      )
      .addColumn('visible', 'boolean', (col) => col.notNull().defaultTo(true))
      .addColumn('postsCount', 'integer', (col) => col.notNull().defaultTo(0))
      .addColumn('replyCount', 'integer', (col) => col.notNull().defaultTo(0))
      .addColumn('likeCount', 'integer', (col) => col.notNull().defaultTo(0))
      .addColumn('views', 'integer', (col) => col.notNull().defaultTo(0))
      .addColumn('createdAt', 'timestamp', (col) =>
        col.notNull().defaultTo(sql`now()`)
      )
      .addColumn('bumpedAt', 'timestamp', (col) =>
        col.notNull().defaultTo(sql`now()`)
      )
      .addColumn('lastPostedAt', 'timestamp', (col) =>
        col.notNull().defaultTo(sql`now()`)
      )
      .execute();

    await testDb.schema
      .createTable('discourseUser')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn('daoDiscourseId', 'uuid', (col) =>
        col.notNull().references('daoDiscourse.id')
      )
      .addColumn('externalId', 'integer', (col) => col.notNull())
      .addColumn('username', 'text', (col) => col.notNull())
      .addColumn('name', 'text')
      .addColumn('avatarTemplate', 'text', (col) => col.notNull())
      .addColumn('title', 'text')
      .addColumn('likesGiven', 'bigint')
      .addColumn('likesReceived', 'bigint')
      .addColumn('daysVisited', 'bigint')
      .addColumn('postsRead', 'bigint')
      .addColumn('topicsEntered', 'bigint')
      .addColumn('postCount', 'bigint')
      .addColumn('topicCount', 'bigint')
      .execute();

    await testDb.schema
      .createTable('discoursePost')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn('daoDiscourseId', 'uuid', (col) =>
        col.notNull().references('daoDiscourse.id')
      )
      .addColumn('topicId', 'integer', (col) => col.notNull())
      .addColumn('postNumber', 'integer', (col) => col.notNull())
      .addColumn('userId', 'integer', (col) => col.notNull())
      .addColumn('deleted', 'boolean', (col) => col.notNull().defaultTo(false))
      .execute();

    await testDb.schema
      .createTable('proposalGroup')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn('daoId', 'uuid', (col) => col.notNull().references('dao.id'))
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('items', 'jsonb', (col) => col.notNull().defaultTo('[]'))
      .addColumn('createdAt', 'timestamp', (col) =>
        col.notNull().defaultTo(sql`now()`)
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
    await testDb.deleteFrom('userNotification').execute();
    await testDb.deleteFrom('discoursePost').execute();
    await testDb.deleteFrom('discourseTopic').execute();
    await testDb.deleteFrom('discourseUser').execute();
    await testDb.deleteFrom('proposalGroup').execute();
    await testDb.deleteFrom('proposal').execute();
    await testDb.deleteFrom('user').execute();
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
      slug: 'test-dao',
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
    .insertInto('user')
    .values({
      id: sql`gen_random_uuid()`,
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
      likesGiven: '10',
      likesReceived: '20',
      daysVisited: '30',
      postsRead: '100',
      topicsEntered: '50',
      postCount: '25',
      topicCount: '15',
    })
    .returning(['id', 'externalId'])
    .execute();

  return {
    dao,
    governor,
    discourse,
    user,
    discourseUser,
  };
}
