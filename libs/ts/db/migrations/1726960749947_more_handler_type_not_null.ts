import type { Kysely } from "kysely";
import { DB } from "../src/kysely_db";

export async function up(db: Kysely<DB>): Promise<void> {
  await db.schema
    .alterTable("dao_handler")
    .alterColumn("handler_type", (col) => col.setNotNull())
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  // down migration code goes here...
  // note: down migrations are optional. you can safely delete this function.
  // For more info, see: https://kysely.dev/docs/migrations
}
