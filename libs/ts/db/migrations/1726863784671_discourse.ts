import { sql, type Kysely } from "kysely";
import { DB } from "../src/kysely_db";

export async function up(db: Kysely<DB>): Promise<void> {
  await db.schema
    .createTable("dao_discourse")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("dao_id", "uuid", (col) => col.notNull())
    .addColumn("discourse_base_url", "text", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_dao_discourse_dao_id",
      ["dao_id"],
      "dao",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  await db.schema
    .createTable("discourse_user")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("external_id", "integer", (col) => col.notNull())
    .addColumn("username", "text", (col) => col.notNull())
    .addColumn("name", "text")
    .addColumn("avatar_template", "text", (col) => col.notNull())
    .addColumn("title", "text")
    .addColumn("likes_received", "bigint")
    .addColumn("likes_given", "bigint")
    .addColumn("topics_entered", "bigint")
    .addColumn("topic_count", "bigint")
    .addColumn("post_count", "bigint")
    .addColumn("posts_read", "bigint")
    .addColumn("days_visited", "bigint")
    .addColumn("dao_discourse_id", "uuid", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_discourse_user_dao_discourse_id",
      ["dao_discourse_id"],
      "dao_discourse",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  await db.schema
    .createTable("discourse_category")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("external_id", "integer", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("color", "text", (col) => col.notNull())
    .addColumn("text_color", "text", (col) => col.notNull())
    .addColumn("slug", "text", (col) => col.notNull())
    .addColumn("topic_count", "integer", (col) => col.notNull())
    .addColumn("post_count", "integer", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("description_text", "text")
    .addColumn("topics_day", "integer")
    .addColumn("topics_week", "integer")
    .addColumn("topics_month", "integer")
    .addColumn("topics_year", "integer")
    .addColumn("topics_all_time", "integer")
    .addColumn("dao_discourse_id", "uuid", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_discourse_category_dao_discourse_id",
      ["dao_discourse_id"],
      "dao_discourse",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

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
      "fk_discourse_post_dao_discourse_id",
      ["dao_discourse_id"],
      "dao_discourse",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  // Add unique constraints and indexes
  await db.schema
    .alterTable("discourse_user")
    .addUniqueConstraint("uq_discourse_user_external_id_dao_discourse_id", [
      "external_id",
      "dao_discourse_id",
    ])
    .execute();

  await db.schema
    .createIndex("idx_discourse_user_external_id")
    .on("discourse_user")
    .column("external_id")
    .execute();

  await db.schema
    .alterTable("discourse_category")
    .addUniqueConstraint("uq_discourse_category_external_id_dao_discourse_id", [
      "external_id",
      "dao_discourse_id",
    ])
    .execute();

  await db.schema
    .createIndex("idx_discourse_category_external_id")
    .on("discourse_category")
    .column("external_id")
    .execute();

  await db.schema
    .alterTable("discourse_topic")
    .addUniqueConstraint("uq_discourse_topic_external_id_dao_discourse_id", [
      "external_id",
      "dao_discourse_id",
    ])
    .execute();

  await db.schema
    .createIndex("idx_discourse_topic_external_id")
    .on("discourse_topic")
    .column("external_id")
    .execute();

  await db.schema
    .createIndex("idx_discourse_topic_category_id")
    .on("discourse_topic")
    .column("category_id")
    .execute();

  await db.schema
    .alterTable("discourse_post")
    .addUniqueConstraint("uq_discourse_post_external_id_dao_discourse_id", [
      "external_id",
      "dao_discourse_id",
    ])
    .execute();

  await db.schema
    .createIndex("idx_discourse_post_external_id")
    .on("discourse_post")
    .column("external_id")
    .execute();

  await db.schema
    .createIndex("idx_discourse_post_user_id")
    .on("discourse_post")
    .column("user_id")
    .execute();

  await db.schema
    .createIndex("idx_discourse_post_topic_id")
    .on("discourse_post")
    .column("topic_id")
    .execute();

  // Add foreign key relationships
  await db.schema
    .alterTable("discourse_post")
    .addForeignKeyConstraint(
      "fk_discourse_post_user",
      ["user_id", "dao_discourse_id"],
      "discourse_user",
      ["external_id", "dao_discourse_id"],
    )
    .execute();

  await db.schema
    .alterTable("discourse_post")
    .addForeignKeyConstraint(
      "fk_discourse_post_topic",
      ["topic_id", "dao_discourse_id"],
      "discourse_topic",
      ["external_id", "dao_discourse_id"],
    )
    .execute();

  await db.schema
    .alterTable("discourse_topic")
    .addForeignKeyConstraint(
      "fk_discourse_topic_category",
      ["category_id", "dao_discourse_id"],
      "discourse_category",
      ["external_id", "dao_discourse_id"],
    )
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.schema.dropTable("discourse_post").execute();
  await db.schema.dropTable("discourse_topic").execute();
  await db.schema.dropTable("discourse_category").execute();
  await db.schema.dropTable("discourse_user").execute();
  await db.schema.dropTable("dao_discourse").execute();
}
