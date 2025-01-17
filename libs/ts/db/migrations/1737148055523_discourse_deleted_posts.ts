import { type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Add the deleted column with default value false
  await db.schema
    .alterTable("discourse_post")
    .addColumn("deleted", "boolean", (col) => col.defaultTo(false).notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop the deleted column
  await db.schema.alterTable("discourse_post").dropColumn("deleted").execute();
}
