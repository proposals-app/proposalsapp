import type { Kysely } from "kysely";
import { DB } from "../src";

export async function up(db: Kysely<DB>): Promise<void> {
  await db.schema
    .alterTable("notification")
    .alterColumn("type", (col) => col.setNotNull())
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {}
