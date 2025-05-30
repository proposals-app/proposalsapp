import type { Kysely } from "kysely";

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<any>): Promise<void> {
  // up migration code goes here...
  // note: up migrations are mandatory. you must implement this function.
  // For more info, see: https://kysely.dev/docs/migrations

  await db.schema
    .alterTable("user")
    .dropColumn("emailSettingsDailyRoundup")
    .execute();

  await db.schema
    .alterTable("user")
    .addColumn("emailSettingsEndingProposals", "boolean", (col) =>
      col.notNull().defaultTo(true),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("user")
    .dropColumn("emailSettingsEndingProposals")
    .execute();

  await db.schema
    .alterTable("user")
    .addColumn("emailSettingsDailyRoundup", "boolean", (col) =>
      col.notNull().defaultTo(true),
    )
    .execute();
}
