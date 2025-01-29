import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("proposal")
    .renameColumn("time_created", "created_at")
    .execute();

  await db.schema
    .alterTable("proposal")
    .renameColumn("time_start", "start_at")
    .execute();

  await db.schema
    .alterTable("proposal")
    .renameColumn("time_end", "end_at")
    .execute();

  await db.schema
    .alterTable("vote")
    .renameColumn("time_created", "created_at")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("proposal")
    .renameColumn("created_at", "time_created")
    .execute();

  await db.schema
    .alterTable("proposal")
    .renameColumn("start_at", "time_start")
    .execute();

  await db.schema
    .alterTable("proposal")
    .renameColumn("end_at", "time_end")
    .execute();

  await db.schema
    .alterTable("vote")
    .renameColumn("created_at", "time_created")
    .execute();
}
