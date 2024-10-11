import { sql, type Kysely } from "kysely";
import { DB } from "./../src/kysely_db";

export async function up(db: Kysely<DB>): Promise<void> {
  await db.schema
    .alterTable("email_verification")
    .addColumn("email", "text", (col) => col.notNull())
    .execute();

  // Add an index on the email column for faster lookups
  await db.schema
    .createIndex("idx_email_verification_email")
    .on("email_verification")
    .column("email")
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  // Drop the index first
  await db.schema.dropIndex("idx_email_verification_email").execute();

  // Then drop the column
  await db.schema
    .alterTable("email_verification")
    .dropColumn("email")
    .execute();
}
