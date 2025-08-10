import { sql, type Kysely } from 'kysely';
import type { DB } from '../src/kysely_db';

export async function up(db: Kysely<DB>): Promise<void> {
  // User table - single auth for all DAOs
  await db.schema
    .createTable('public.user')
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

  // Verification table for email verification
  await db.schema
    .createTable('public.verification')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('identifier', 'text', (col) => col.notNull())
    .addColumn('value', 'text', (col) => col.notNull())
    .addColumn('expires_at', 'timestamp', (col) => col.notNull())
    .addColumn('created_at', 'timestamp')
    .addColumn('updated_at', 'timestamp')
    .execute();

  // Account table for OAuth providers
  await db.schema
    .createTable('public.account')
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
      'public.user',
      ['id']
    )
    .execute();

  // Session table
  await db.schema
    .createTable('public.session')
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
      'public.user',
      ['id']
    )
    .execute();

  // User notification table
  await db.schema
    .createTable('public.user_notification')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('user_id', 'text', (col) => col.notNull())
    .addColumn('type', 'text', (col) => col.notNull())
    .addColumn('target_id', 'text', (col) => col.notNull())
    .addColumn('dao_id', 'uuid') // Optional DAO association
    .addColumn('sent_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addUniqueConstraint('user_notification_unique', [
      'user_id',
      'type',
      'target_id',
    ])
    .addForeignKeyConstraint(
      'user_notification_userId_fkey',
      ['user_id'],
      'public.user',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .addForeignKeyConstraint(
      'user_notification_daoId_fkey',
      ['dao_id'],
      'public.dao',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .execute();

  // User proposal group last read table
  await db.schema
    .createTable('public.user_proposal_group_last_read')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('user_id', 'text', (col) => col.notNull())
    .addColumn('proposal_group_id', 'uuid', (col) => col.notNull())
    .addColumn('last_read_at', 'timestamp')
    .addUniqueConstraint('user_proposal_group_last_read_unique', [
      'user_id',
      'proposal_group_id',
    ])
    .addForeignKeyConstraint(
      'user_proposal_group_last_read_user_id_fkey',
      ['user_id'],
      'public.user',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .addForeignKeyConstraint(
      'user_proposal_group_last_read_proposal_group_id_fkey',
      ['proposal_group_id'],
      'public.proposal_group',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .execute();

  // ===== USER-SPECIFIC INDEXES FOR READ TRACKING =====

  // CRITICAL: User proposal group read tracking
  await sql`
    CREATE INDEX IF NOT EXISTS idx_user_proposal_group_last_read_lookup
    ON public.user_proposal_group_last_read(user_id, proposal_group_id)
    INCLUDE (last_read_at);
  `.execute(db);
}

export async function down(db: Kysely<DB>): Promise<void> {
  await sql`DROP INDEX IF EXISTS public.idx_user_proposal_group_last_read_lookup;`.execute(
    db
  );

  // Drop tables in reverse order of creation
  await db.schema
    .dropTable('public.user_proposal_group_last_read')
    .ifExists()
    .execute();
  await db.schema.dropTable('public.user_notification').ifExists().execute();
  await db.schema.dropTable('public.session').ifExists().execute();
  await db.schema.dropTable('public.account').ifExists().execute();
  await db.schema.dropTable('public.verification').ifExists().execute();
  await db.schema.dropTable('public.user').ifExists().execute();
}
