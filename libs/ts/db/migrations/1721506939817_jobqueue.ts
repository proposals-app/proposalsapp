import { sql, type Kysely } from "kysely";
import { DB } from "../src/kysely_db";

export async function up(db: Kysely<DB>): Promise<void> {
  await db.schema
    .createTable("job_queue")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("job", "jsonb", (col) => col.notNull())
    .addColumn("job_type", "varchar", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("processed", "boolean", (col) => col.defaultTo(false))
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.schema.dropTable("job_queue").execute();
}
