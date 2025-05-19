import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Create the new schema if it doesn't exist
  await sql`CREATE SCHEMA IF NOT EXISTS arbitrum_web;`.execute(db);

  // Move tables to the new schema
  await sql`ALTER TABLE "account" SET SCHEMA arbitrum_web;`.execute(db);
  await sql`ALTER TABLE "session" SET SCHEMA arbitrum_web;`.execute(db);
  await sql`ALTER TABLE "user" SET SCHEMA arbitrum_web;`.execute(db);
  await sql`ALTER TABLE "user_notification" SET SCHEMA arbitrum_web;`.execute(
    db,
  );
  await sql`ALTER TABLE "user_proposal_group_last_read" SET SCHEMA arbitrum_web;`.execute(
    db,
  );
  await sql`ALTER TABLE "verification" SET SCHEMA arbitrum_web;`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // Move tables back to the public schema
  await sql`ALTER TABLE arbitrum_web."account" SET SCHEMA public;`.execute(db);
  await sql`ALTER TABLE arbitrum_web."session" SET SCHEMA public;`.execute(db);
  await sql`ALTER TABLE arbitrum_web."user" SET SCHEMA public;`.execute(db);
  await sql`ALTER TABLE arbitrum_web."user_notification" SET SCHEMA public;`.execute(
    db,
  );
  await sql`ALTER TABLE arbitrum_web."user_proposal_group_last_read" SET SCHEMA public;`.execute(
    db,
  );
  await sql`ALTER TABLE arbitrum_web."verification" SET SCHEMA public;`.execute(
    db,
  );

  // Optionally drop the schema if it's empty, but it's generally safer not to drop schemas
  // unless you are certain nothing else relies on it. We will not drop the schema here.
}
