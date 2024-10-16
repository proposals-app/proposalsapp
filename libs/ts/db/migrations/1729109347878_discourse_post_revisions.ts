import { sql, type Kysely } from "kysely";
import { DB } from "../src/kysely_db";

export async function up(db: Kysely<DB>): Promise<void> {
  await db.schema
    .createTable("discourse_post_revision")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("discourse_post_id", "uuid", (col) => col.notNull())
    .addColumn("external_post_id", "integer", (col) => col.notNull())
    .addColumn("version", "integer", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) => col.notNull())
    .addColumn("username", "text", (col) => col.notNull())
    .addColumn("body_changes", "text", (col) => col.notNull())
    .addColumn("edit_reason", "text")
    .addColumn("dao_discourse_id", "uuid", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_discourse_revision_dao_discourse_id",
      ["dao_discourse_id"],
      "dao_discourse",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_discourse_revision_discourse_post",
      ["discourse_post_id"],
      "discourse_post",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  // Add indexes
  await db.schema
    .createIndex("idx_discourse_post_revision_external_post_id")
    .on("discourse_post_revision")
    .column("external_post_id")
    .execute();

  await db.schema
    .createIndex("idx_discourse_post_revision_discourse_post_id")
    .on("discourse_post_revision")
    .column("discourse_post_id")
    .execute();

  await db.schema
    .createIndex("idx_discourse_post_revision_version")
    .on("discourse_post_revision")
    .column("version")
    .execute();

  // Add unique constraint
  await db.schema
    .alterTable("discourse_post_revision")
    .addUniqueConstraint("uq_discourse_post_revision_post_version", [
      "discourse_post_id",
      "version",
    ])
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.schema.dropTable("discourse_post_revision").execute();
}
