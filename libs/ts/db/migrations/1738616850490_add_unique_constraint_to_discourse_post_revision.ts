import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Add a new unique constraint on external_post_id, version, and dao_discourse_id
  await db.schema
    .alterTable("discourse_post_revision")
    .addUniqueConstraint(
      "uq_discourse_post_revision_external_post_id_version_dao_discourse_id",
      ["external_post_id", "version", "dao_discourse_id"],
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop the unique constraint
  await db.schema
    .alterTable("discourse_post_revision")
    .dropConstraint(
      "uq_discourse_post_revision_external_post_id_version_dao_discourse_id",
    )
    .execute();
}
