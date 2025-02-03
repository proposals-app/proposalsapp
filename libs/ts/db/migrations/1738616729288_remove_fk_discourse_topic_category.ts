import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Drop the foreign key constraint fk_discourse_topic_category from discourse_topic table
  await db.schema
    .alterTable("discourse_topic")
    .dropConstraint("fk_discourse_topic_category")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Re-add the foreign key constraint fk_discourse_topic_category to discourse_topic table
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
