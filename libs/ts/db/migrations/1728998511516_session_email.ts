import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("user_session")
    .addColumn("email", "text")
    .execute();

  // Optionally, you can add an index on the email column for faster lookups
  await db.schema
    .createIndex("idx_user_session_email")
    .on("user_session")
    .column("email")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // First, drop the index if you created one
  await db.schema.dropIndex("idx_user_session_email").execute();

  // Then, drop the column
  await db.schema.alterTable("user_session").dropColumn("email").execute();
}
