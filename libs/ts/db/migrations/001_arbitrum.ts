import { type Kysely, sql } from 'kysely';
import type { DB } from '../src/kysely_db';

export async function up(db: Kysely<DB>): Promise<void> {
  // --- SCHEMAS ---
  await sql`CREATE SCHEMA IF NOT EXISTS "arbitrum";`.execute(db);

  // --- TABLES IN arbitrum SCHEMA ---
  await db.schema
    .createTable('arbitrum.user')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('email', 'text', (col) => col.notNull()) // Unique constraint added below
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
    .addUniqueConstraint('user_email_key', ['email']) // From your SQL
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
    .addColumn('account_id', 'text', (col) => col.notNull()) // Renamed from accountId to account_id to match SQL
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
    .addColumn('token', 'text', (col) => col.notNull()) // Unique constraint added below
    .addColumn('created_at', 'timestamp', (col) => col.notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.notNull())
    .addColumn('ip_address', 'text') // Renamed from ipAddress
    .addColumn('user_agent', 'text')
    .addColumn('user_id', 'text', (col) => col.notNull())
    .addUniqueConstraint('session_token_key', ['token']) // From your SQL
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
    .addColumn('user_id', 'text', (col) => col.notNull()) // Renamed from userId
    .addColumn('type', 'text', (col) => col.notNull())
    .addColumn('target_id', 'text', (col) => col.notNull()) // Renamed from targetId
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
  // Index for user_proposal_group_last_read.proposal_group_id
  await db.schema
    .createIndex('idx_user_proposal_group_last_read_proposal_group_id')
    .on('arbitrum.user_proposal_group_last_read')
    .column('proposal_group_id')
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  // --- DROP TABLES (Reverse order of creation, considering dependencies) ---

  // arbitrum schema tables (children first)
  await db.schema
    .dropTable('arbitrum.user_proposal_group_last_read')
    .ifExists()
    .execute();
  await db.schema.dropTable('arbitrum.user_notification').ifExists().execute();
  await db.schema.dropTable('arbitrum.session').ifExists().execute();
  await db.schema.dropTable('arbitrum.account').ifExists().execute();
  await db.schema.dropTable('arbitrum.verification').ifExists().execute();
  await db.schema.dropTable('arbitrum.user').ifExists().execute();

  // --- DROP SCHEMAS (if they are truly empty and you want Kysely to manage them fully) ---
  // Be cautious with dropping schemas, especially 'public'.
  await sql`DROP SCHEMA IF EXISTS "arbitrum" CASCADE;`.execute(db);
  // It's generally not recommended to drop the 'public' schema unless you are absolutely sure.
  // await sql`DROP SCHEMA IF EXISTS "public" CASCADE;`.execute(db);
}
