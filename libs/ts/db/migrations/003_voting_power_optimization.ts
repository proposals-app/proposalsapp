import { sql, type Kysely } from 'kysely';
import type { DB } from '../src/kysely_db';

export async function up(db: Kysely<DB>): Promise<void> {
  // 1. Rename the existing voting_power table to voting_power_timeseries
  await sql`ALTER TABLE public.voting_power RENAME TO voting_power_timeseries`.execute(
    db
  );

  // 2. Rename the constraints and indexes to match the new table name
  await sql`ALTER TABLE public.voting_power_timeseries RENAME CONSTRAINT fk_voting_power_dao_id TO fk_voting_power_timeseries_dao_id`.execute(
    db
  );

  // Rename indexes
  await sql`ALTER INDEX IF EXISTS idx_voting_power_dao_id_timestamp RENAME TO idx_voting_power_timeseries_dao_id_timestamp`.execute(
    db
  );
  await sql`ALTER INDEX IF EXISTS idx_voting_power_voter_dao_id_timestamp RENAME TO idx_voting_power_timeseries_voter_dao_id_timestamp`.execute(
    db
  );
  await sql`ALTER INDEX IF EXISTS idx_voting_power_block RENAME TO idx_voting_power_timeseries_block`.execute(
    db
  );
  await sql`ALTER INDEX IF EXISTS idx_voting_power_distinct_latest RENAME TO idx_voting_power_timeseries_distinct_latest`.execute(
    db
  );
  await sql`ALTER INDEX IF EXISTS idx_voting_power_non_zero RENAME TO idx_voting_power_timeseries_non_zero`.execute(
    db
  );
  await sql`ALTER INDEX IF EXISTS idx_voting_power_dao_timestamp_positive RENAME TO idx_voting_power_timeseries_dao_timestamp_positive`.execute(
    db
  );

  // 3. Create the new voting_power_latest table
  await db.schema
    .createTable('public.voting_power_latest')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('voter', 'text', (col) => col.notNull())
    .addColumn('voting_power', 'float8', (col) => col.notNull())
    .addColumn('dao_id', 'uuid', (col) => col.notNull())
    .addColumn('timestamp', 'timestamp', (col) => col.notNull())
    .addColumn('block', 'integer', (col) => col.notNull())
    .addColumn('txid', 'text')
    .addForeignKeyConstraint(
      'fk_voting_power_latest_dao_id',
      ['dao_id'],
      'public.dao',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .addUniqueConstraint('unique_voting_power_latest_voter_dao', [
      'voter',
      'dao_id',
    ])
    .execute();

  // 4. Create indexes on voting_power_latest
  await db.schema
    .createIndex('idx_voting_power_latest_dao_id')
    .on('public.voting_power_latest')
    .column('dao_id')
    .execute();

  await db.schema
    .createIndex('idx_voting_power_latest_voter')
    .on('public.voting_power_latest')
    .column('voter')
    .execute();

  await db.schema
    .createIndex('idx_voting_power_latest_voter_dao')
    .on('public.voting_power_latest')
    .columns(['voter', 'dao_id'])
    .execute();

  await db.schema
    .createIndex('idx_voting_power_latest_dao_power_nonzero')
    .on('public.voting_power_latest')
    .columns(['dao_id', 'voting_power'])
    .where('voting_power', '>', 0)
    .execute();

  // 5. Populate voting_power_latest with the latest data from voting_power_timeseries
  await sql`
    INSERT INTO public.voting_power_latest (voter, voting_power, dao_id, timestamp, block, txid)
    SELECT DISTINCT ON (voter, dao_id)
      voter, voting_power, dao_id, timestamp, block, txid
    FROM public.voting_power_timeseries
    ORDER BY voter, dao_id, timestamp DESC
  `.execute(db);

  // 6. Create a function to update voting_power_latest
  await sql`
    CREATE OR REPLACE FUNCTION update_voting_power_latest()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO public.voting_power_latest (voter, voting_power, dao_id, timestamp, block, txid)
      VALUES (NEW.voter, NEW.voting_power, NEW.dao_id, NEW.timestamp, NEW.block, NEW.txid)
      ON CONFLICT (voter, dao_id)
      DO UPDATE SET
        voting_power = EXCLUDED.voting_power,
        timestamp = EXCLUDED.timestamp,
        block = EXCLUDED.block,
        txid = EXCLUDED.txid
      WHERE EXCLUDED.timestamp > voting_power_latest.timestamp;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  // 7. Create trigger on voting_power_timeseries to maintain voting_power_latest
  await sql`
    CREATE TRIGGER maintain_voting_power_latest
    AFTER INSERT ON public.voting_power_timeseries
    FOR EACH ROW EXECUTE FUNCTION update_voting_power_latest();
  `.execute(db);

  // 8. Create improved index for the voting_power_timeseries table
  await db.schema
    .createIndex('idx_voting_power_timeseries_voter_dao_timestamp')
    .on('public.voting_power_timeseries')
    .columns(['voter', 'dao_id', 'timestamp'])
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  // Drop the voting_power_timeseries index
  await db.schema
    .dropIndex('idx_voting_power_timeseries_voter_dao_timestamp')
    .ifExists()
    .execute();

  // Drop the trigger and function
  await sql`DROP TRIGGER IF EXISTS maintain_voting_power_latest ON public.voting_power_timeseries`.execute(
    db
  );
  await sql`DROP FUNCTION IF EXISTS update_voting_power_latest()`.execute(db);

  // Drop voting_power_latest table
  await db.schema.dropTable('public.voting_power_latest').ifExists().execute();

  // Rename voting_power_timeseries back to voting_power
  await sql`ALTER TABLE public.voting_power_timeseries RENAME TO voting_power`.execute(
    db
  );

  // Rename the constraint back
  await sql`ALTER TABLE public.voting_power RENAME CONSTRAINT fk_voting_power_timeseries_dao_id TO fk_voting_power_dao_id`.execute(
    db
  );

  // Rename indexes back
  await sql`ALTER INDEX IF EXISTS idx_voting_power_timeseries_dao_id_timestamp RENAME TO idx_voting_power_dao_id_timestamp`.execute(
    db
  );
  await sql`ALTER INDEX IF EXISTS idx_voting_power_timeseries_voter_dao_id_timestamp RENAME TO idx_voting_power_voter_dao_id_timestamp`.execute(
    db
  );
  await sql`ALTER INDEX IF EXISTS idx_voting_power_timeseries_block RENAME TO idx_voting_power_block`.execute(
    db
  );
  await sql`ALTER INDEX IF EXISTS idx_voting_power_timeseries_distinct_latest RENAME TO idx_voting_power_distinct_latest`.execute(
    db
  );
  await sql`ALTER INDEX IF EXISTS idx_voting_power_timeseries_non_zero RENAME TO idx_voting_power_non_zero`.execute(
    db
  );
  await sql`ALTER INDEX IF EXISTS idx_voting_power_timeseries_dao_timestamp_positive RENAME TO idx_voting_power_dao_timestamp_positive`.execute(
    db
  );
  await sql`ALTER INDEX IF EXISTS idx_voting_power_timeseries_voter_dao_timestamp RENAME TO idx_voting_power_voter_dao_timestamp`.execute(
    db
  );
}
