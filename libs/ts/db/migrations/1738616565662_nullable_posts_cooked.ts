import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Alter the discourse_post table to make the cooked column nullable
  await db.schema
    .alterTable("discourse_post")
    .alterColumn("cooked", (col) => col.dropNotNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Revert the change by making the cooked column NOT NULL again
  await db.schema
    .alterTable("discourse_post")
    .alterColumn("cooked", (col) => col.setNotNull())
    .execute();
}
