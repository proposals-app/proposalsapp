import { sql, type Kysely } from "kysely";
import { DB } from "../src/kysely_db";

export async function up(db: Kysely<DB>): Promise<void> {
  await db.schema
    .createTable("discourse_topic")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("external_id", "integer", (col) => col.notNull())
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("fancy_title", "text", (col) => col.notNull())
    .addColumn("slug", "text", (col) => col.notNull())
    .addColumn("posts_count", "integer", (col) => col.notNull())
    .addColumn("reply_count", "integer", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) => col.notNull())
    .addColumn("last_posted_at", "timestamp", (col) => col.notNull())
    .addColumn("bumped_at", "timestamp", (col) => col.notNull())
    .addColumn("pinned", "boolean", (col) => col.notNull())
    .addColumn("pinned_globally", "boolean", (col) => col.notNull())
    .addColumn("visible", "boolean", (col) => col.notNull())
    .addColumn("closed", "boolean", (col) => col.notNull())
    .addColumn("archived", "boolean", (col) => col.notNull())
    .addColumn("views", "integer", (col) => col.notNull())
    .addColumn("like_count", "integer", (col) => col.notNull())
    .addColumn("category_id", "integer", (col) => col.notNull())
    .addColumn("dao_discourse_id", "uuid", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_discourse_topic_dao_discourse_id",
      ["dao_discourse_id"],
      "dao_discourse",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  await db.schema
    .createIndex("idx_discourse_topic_dao_discourse_id")
    .on("discourse_topic")
    .column("dao_discourse_id")
    .execute();

  await db.schema
    .createIndex("idx_discourse_topic_external_id")
    .on("discourse_topic")
    .columns(["dao_discourse_id", "external_id"])
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.schema.dropTable("discourse_topic").execute();
}
