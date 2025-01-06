import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Add the updatedAt column to the dao_indexer table
  await db.schema
    .alterTable("dao_indexer")
    .addColumn("updatedAt", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop the updatedAt column from the dao_indexer table
  await db.schema.alterTable("dao_indexer").dropColumn("updatedAt").execute();
}
