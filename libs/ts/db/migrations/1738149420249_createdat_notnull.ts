import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("vote")
    .alterColumn("created_at", (col) => col.setDefault(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema
    .alterTable("vote")
    .alterColumn("created_at", (col) => col.setNotNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("vote")
    .alterColumn("created_at", (col) => col.dropNotNull())
    .execute();
}
