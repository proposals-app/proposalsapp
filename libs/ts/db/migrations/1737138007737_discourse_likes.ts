import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("discourse_post_like")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("external_discourse_post_id", "integer", (col) => col.notNull())
    .addColumn("external_user_id", "integer", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) => col.notNull())
    .addColumn("dao_discourse_id", "uuid", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_discourse_like_dao_discourse_id",
      ["dao_discourse_id"],
      "dao_discourse",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  // Add indexes
  await db.schema
    .createIndex("idx_external_discourse_post_like_post_id")
    .on("discourse_post_like")
    .column("external_discourse_post_id")
    .execute();

  await db.schema
    .createIndex("idx_discourse_post_like_external_user_id")
    .on("discourse_post_like")
    .column("external_user_id")
    .execute();

  await db.schema
    .createIndex("idx_discourse_post_like_created_at")
    .on("discourse_post_like")
    .column("created_at")
    .execute();

  // Add unique constraint
  await db.schema
    .alterTable("discourse_post_like")
    .addUniqueConstraint("uq_external_discourse_post_like_post_user_dao", [
      "external_discourse_post_id",
      "external_user_id",
      "dao_discourse_id",
    ])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("discourse_post_like").execute();
}
