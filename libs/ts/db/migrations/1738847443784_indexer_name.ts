import { type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Add the name column to the dao_indexer table
  await db.schema.alterTable("dao_indexer").addColumn("name", "text").execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop the name column from the dao_indexer table
  await db.schema.alterTable("dao_indexer").dropColumn("name").execute();
}
