import { sql, type Kysely } from "kysely";
import { DB } from "../src/kysely_db";

export async function up(db: Kysely<DB>): Promise<void> {
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
    .createIndex("idx_discourse_category_dao_discourse_id")
    .on("discourse_category")
    .column("dao_discourse_id")
    .execute();

  await db.schema
    .createIndex("idx_discourse_category_external_id")
    .on("discourse_category")
    .columns(["dao_discourse_id", "external_id"])
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.schema.dropTable("discourse_category").execute();
}
