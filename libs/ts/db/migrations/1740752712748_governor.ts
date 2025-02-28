import { sql, type Kysely } from "kysely";
import { DB } from "../src/kysely_db";

export async function up(db: Kysely<DB>): Promise<void> {
  await db.schema
    .createTable("governor_new")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("dao_id", "uuid", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("type", "text", (col) => col.notNull())
    .addColumn("metadata", "jsonb", (col) => col.defaultTo("{}").notNull())
    .addColumn("enabled", "boolean", (col) => col.defaultTo(true).notNull())
    .addColumn("portal_url", "text")
    .addForeignKeyConstraint(
      "fk_governor_new_dao_id",
      ["dao_id"],
      "dao",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  // Create indexes
  await db.schema
    .createIndex("idx_governor_new_dao_id")
    .on("governor_new")
    .column("dao_id")
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  // Drop the governor_new table
  await db.schema.dropTable("governor_new").execute();
}
