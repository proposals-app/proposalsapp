import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Create an index on the version column of the discourse_post table
  await db.schema
    .createIndex("idx_discourse_post_version")
    .on("discourse_post")
    .column("version")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop the index in case we need to rollback
  await db.schema.dropIndex("idx_discourse_post_version").execute();
}
