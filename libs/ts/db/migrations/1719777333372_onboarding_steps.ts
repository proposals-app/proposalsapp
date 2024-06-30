import { type Kysely } from "kysely";
import { DB } from "../src/kysely_db";

export async function up(db: Kysely<DB>): Promise<void> {
  await db.schema
    .alterTable("user")
    .addColumn("onboarding_step", "integer", (col) =>
      col.defaultTo(0).notNull(),
    )
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.schema.alterTable("user").dropColumn("onboarding_step").execute();
}
