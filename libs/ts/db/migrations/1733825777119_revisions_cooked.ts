import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Add new columns
  await db.schema
    .alterTable("discourse_post_revision")
    .addColumn("cooked_body_before", "text")
    .addColumn("cooked_title_before", "text")
    .addColumn("cooked_body_after", "text")
    .addColumn("cooked_title_after", "text")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop columns
  await db.schema
    .alterTable("discourse_post_revision")
    .dropColumn("cooked_body_before")
    .dropColumn("cooked_title_before")
    .dropColumn("cooked_body_after")
    .dropColumn("cooked_title_after")
    .execute();
}
