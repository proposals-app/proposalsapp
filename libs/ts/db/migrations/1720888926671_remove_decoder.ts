import { type Kysely } from "kysely";
import { DB } from "../src/kysely_db";

export async function up(db: Kysely<DB>): Promise<void> {
  await db.schema.alterTable("dao_handler").dropColumn("decoder").execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.schema
    .alterTable("dao_handler")
    .addColumn("decoder", "json", (col) => col.defaultTo("{}").notNull())
    .execute();
}
