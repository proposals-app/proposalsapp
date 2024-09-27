import { sql, type Kysely } from "kysely";
import { DB } from "../src/kysely_db";

export async function up(db: Kysely<DB>): Promise<void> {
  await db.schema
    .alterTable("dao_discourse")
    .addColumn("refresh_enabled", "boolean", (col) =>
      col.notNull().defaultTo(true),
    )
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.schema
    .alterTable("dao_discourse")
    .dropColumn("refresh_enabled")
    .execute();
}
