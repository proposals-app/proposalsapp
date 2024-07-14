import { type Kysely } from "kysely";
import { DB } from "../src/kysely_db";

export async function up(db: Kysely<DB>): Promise<void> {
  await db.schema
    .alterTable("proposal")
    .addColumn("scores_quorum", "float8", (col) => col.notNull().defaultTo(0.0))
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.schema.alterTable("proposal").dropColumn("scores_quorum").execute();
}
