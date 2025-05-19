import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER SCHEMA "arbitrum_web" RENAME TO "arbitrum"`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER SCHEMA "arbitrum" RENAME TO "arbitrum_web"`.execute(db);
}
