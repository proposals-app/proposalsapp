import { sql, type Kysely } from "kysely";
import { DB } from "../src/kysely_db";

export async function up(db: Kysely<DB>): Promise<void> {
  await db.schema
    .alterTable("proposalGroup")
    .addColumn("createdAt", "timestamp", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.schema.alterTable("proposalGroup").dropColumn("createdAt").execute();
}
