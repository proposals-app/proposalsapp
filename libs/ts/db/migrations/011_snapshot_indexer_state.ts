import { type Kysely, sql } from 'kysely';
import { type DB } from '../src';

export async function up(db: Kysely<DB>): Promise<void> {
    await sql`
    CREATE TABLE snapshot_indexer_state (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      last_mci BIGINT NOT NULL DEFAULT 0
    )
  `.execute(db);

    await sql`
    INSERT INTO snapshot_indexer_state (id, last_mci) VALUES (1, 0)
    ON CONFLICT (id) DO NOTHING
  `.execute(db);
}

export async function down(db: Kysely<DB>): Promise<void> {
    await sql`
    DROP TABLE IF EXISTS snapshot_indexer_state
  `.execute(db);
}
