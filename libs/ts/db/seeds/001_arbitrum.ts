import { sql, type Kysely } from 'kysely';
import type { DB } from '../src';

export async function seed(db: Kysely<DB>): Promise<void> {
  await sql`CREATE SCHEMA IF NOT EXISTS "arbitrum";`.execute(db);

  // --- TABLES IN arbitrum SCHEMA ---
  await db.schema
    .createTable('arbitrum.user')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('email', 'text', (col) => col.unique().notNull())
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

  await db.schema
    .createTable('arbitrum.verification')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('identifier', 'text', (col) => col.notNull())
    .addColumn('value', 'text', (col) => col.notNull())
    .addColumn('expires_at', 'timestamp', (col) => col.notNull())
    .addColumn('created_at', 'timestamp')
    .addColumn('updated_at', 'timestamp')
    .execute();

  await db.schema
    .createTable('arbitrum.account')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('account_id', 'text', (col) => col.notNull())
    .addColumn('provider_id', 'text', (col) => col.notNull())
    .addColumn('user_id', 'text', (col) => col.notNull())
    .addColumn('access_token', 'text')
    .addColumn('refresh_token', 'text')
    .addColumn('id_token', 'text')
    .addColumn('access_token_expires_at', 'timestamp')
    .addColumn('refresh_token_expires_at', 'timestamp')
    .addColumn('scope', 'text')
    .addColumn('password', 'text')
    .addColumn('created_at', 'timestamp', (col) => col.notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.notNull())
    .addForeignKeyConstraint(
      'account_userId_fkey',
      ['user_id'],
      'arbitrum.user',
      ['id']
    ) // ON UPDATE NO ACTION ON DELETE NO ACTION is default
    .execute();

  await db.schema
    .createTable('arbitrum.session')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('expires_at', 'timestamp', (col) => col.notNull())
    .addColumn('token', 'text', (col) => col.unique().notNull())
    .addColumn('created_at', 'timestamp', (col) => col.notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.notNull())
    .addColumn('ip_address', 'text')
    .addColumn('user_agent', 'text')
    .addColumn('user_id', 'text', (col) => col.notNull())
    .addForeignKeyConstraint(
      'session_userId_fkey',
      ['user_id'],
      'arbitrum.user',
      ['id']
    )
    .execute();

  await db.schema
    .createTable('arbitrum.user_notification')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('user_id', 'text', (col) => col.notNull())
    .addColumn('type', 'text', (col) => col.notNull())
    .addColumn('target_id', 'text', (col) => col.notNull())
    .addColumn('sent_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addUniqueConstraint('email_notification_user_id_type_target_id_unique', [
      'user_id',
      'type',
      'target_id',
    ])
    .addForeignKeyConstraint(
      'user_notification_userId_fkey',
      ['user_id'],
      'arbitrum.user',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .execute();

  await db.schema
    .createTable('arbitrum.user_proposal_group_last_read')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('user_id', 'text', (col) => col.notNull())
    .addColumn('proposal_group_id', 'uuid', (col) => col.notNull())
    .addColumn('last_read_at', 'timestamp')
    .addUniqueConstraint(
      'user_proposal_group_last_read_user_id_proposal_group_id_unique',
      ['user_id', 'proposal_group_id']
    )
    .addForeignKeyConstraint(
      'user_proposal_group_last_read_user_id_fkey',
      ['user_id'],
      'arbitrum.user',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .execute();

  await db
    .insertInto('dao')
    .values({
      name: 'Arbitrum',
      slug: 'arbitrum',
      picture: 'assets/project-logos/arbitrum',
    })
    .execute();

  const arbitrumDao = await db
    .selectFrom('dao')
    .where('slug', '=', 'arbitrum')
    .selectAll()
    .executeTakeFirstOrThrow();

  await db
    .insertInto('daoDiscourse')
    .values({
      daoId: arbitrumDao.id,
      discourseBaseUrl: 'https://forum.arbitrum.foundation',
      enabled: true,
      withUserAgent: false,
    })
    .execute();

  await db
    .insertInto('daoGovernor')
    .values([
      {
        daoId: arbitrumDao.id,
        name: 'Snapshot',
        type: 'ARBITRUM_SNAPSHOT',
        metadata: {},
        enabled: true,
        portalUrl: 'https://snapshot.org/#/arbitrumfoundation.eth',
      },
      {
        daoId: arbitrumDao.id,
        name: 'Arbitrum Core Proposal',
        type: 'ARBITRUM_CORE',
        metadata: {},
        enabled: true,
        portalUrl: 'https://www.tally.xyz/gov/arbitrum',
      },
      {
        daoId: arbitrumDao.id,
        name: 'Arbitrum Treasury Proposal',
        type: 'ARBITRUM_TREASURY',
        metadata: {},
        enabled: true,
        portalUrl: 'https://www.tally.xyz/gov/arbitrum',
      },
      {
        daoId: arbitrumDao.id,
        name: 'Arbitrum Security Council Nominations',
        type: 'ARBITRUM_SC_NOMINATIONS',
        metadata: {},
        enabled: true,
      },
      {
        daoId: arbitrumDao.id,
        name: 'Arbitrum Security Council Elections',
        type: 'ARBITRUM_SC_ELECTIONS',
        metadata: {},
        enabled: true,
        portalUrl: 'https://snapshot.org/#/arbitrumfoundation.eth',
      },
    ])
    .execute();
}
