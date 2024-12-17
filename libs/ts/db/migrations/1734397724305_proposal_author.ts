import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Add the author column to the proposal table
  await db.schema.alterTable("proposal").addColumn("author", "text").execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop the author column from the proposal table
  await db.schema.alterTable("proposal").dropColumn("author").execute();
}
