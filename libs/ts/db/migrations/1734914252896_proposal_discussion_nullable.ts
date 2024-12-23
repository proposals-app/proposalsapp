import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE proposal ALTER COLUMN discussion_url DROP NOT NULL`.execute(
    db,
  );
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE proposal ALTER COLUMN discussion_url SET NOT NULL`.execute(
    db,
  );
}
