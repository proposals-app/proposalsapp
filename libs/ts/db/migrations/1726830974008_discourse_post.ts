import { sql, type Kysely } from "kysely";
import { DB } from "../src/kysely_db";

export async function up(db: Kysely<DB>): Promise<void> {
  await db.schema
    .createTable("discourse_post")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("external_id", "integer", (col) => col.notNull())
    .addColumn("name", "text")
    .addColumn("username", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) => col.notNull())
    .addColumn("cooked", "text", (col) => col.notNull())
    .addColumn("post_number", "integer", (col) => col.notNull())
    .addColumn("post_type", "integer", (col) => col.notNull())
    .addColumn("updated_at", "timestamp", (col) => col.notNull())
    .addColumn("reply_count", "integer", (col) => col.notNull())
    .addColumn("reply_to_post_number", "integer")
    .addColumn("quote_count", "integer", (col) => col.notNull())
    .addColumn("incoming_link_count", "integer", (col) => col.notNull())
    .addColumn("reads", "integer", (col) => col.notNull())
    .addColumn("readers_count", "integer", (col) => col.notNull())
    .addColumn("score", "float8", (col) => col.notNull())
    .addColumn("topic_id", "integer", (col) => col.notNull())
    .addColumn("topic_slug", "text", (col) => col.notNull())
    .addColumn("display_username", "text")
    .addColumn("primary_group_name", "text")
    .addColumn("flair_name", "text")
    .addColumn("flair_url", "text")
    .addColumn("flair_bg_color", "text")
    .addColumn("flair_color", "text")
    .addColumn("version", "integer", (col) => col.notNull())
    .addColumn("user_id", "integer", (col) => col.notNull())
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
    .createIndex("idx_discourse_post_external_id")
    .on("discourse_post")
    .column("external_id")
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.schema.dropTable("discourse_post").execute();
}
