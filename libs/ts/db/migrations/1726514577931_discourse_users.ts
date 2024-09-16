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
    .addColumn("external_id", "bigint", (col) => col.notNull())
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
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.schema.dropTable("discourse_user").execute();
  await db.schema.dropTable("dao_discourse").execute();
}
