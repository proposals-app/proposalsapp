import { sql, type Kysely } from "kysely";
import { DB } from "../src/kysely_db";

export async function up(db: Kysely<DB>): Promise<void> {
  await db.schema
    .createTable("proposal_group")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("items", "jsonb", (col) => col.notNull().defaultTo("[]"))
    .execute();

  await db.schema
    .createIndex("idx_proposal_group_items")
    .on("proposal_group")
    .using("gin")
    .column("items")
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.schema.dropTable("proposal_group").execute();
}
