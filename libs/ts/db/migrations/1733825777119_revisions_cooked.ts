import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Add new columns
  await db.schema
    .alterTable("discourse_post_revision")
    .addColumn("cooked_body", "text")
    .addColumn("cooked_title", "text")
    .execute();

  // Add indexes for the new columns
  await db.schema
    .createIndex("idx_discourse_post_revision_cooked_body")
    .on("discourse_post_revision")
    .column("cooked_body")
    .execute();

  await db.schema
    .createIndex("idx_discourse_post_revision_cooked_title")
    .on("discourse_post_revision")
    .column("cooked_title")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop indexes first
  await db.schema
    .dropIndex("idx_discourse_post_revision_cooked_body")
    .execute();
  await db.schema
    .dropIndex("idx_discourse_post_revision_cooked_title")
    .execute();

  // Drop columns
  await db.schema
    .alterTable("discourse_post_revision")
    .dropColumn("cooked_body")
    .dropColumn("cooked_title")
    .execute();
}
