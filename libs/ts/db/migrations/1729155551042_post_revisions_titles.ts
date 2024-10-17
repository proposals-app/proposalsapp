import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("discourse_post_revision")
    .addColumn("title_changes", "text")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("discourse_post_revision")
    .addColumn("title_changes", "text")
    .execute();
}
