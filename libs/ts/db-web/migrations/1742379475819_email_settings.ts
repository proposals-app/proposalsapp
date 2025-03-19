import type { Kysely } from "kysely";

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<any>): Promise<void> {
  // up migration code goes here...
  // note: up migrations are mandatory. you must implement this function.
  // For more info, see: https://kysely.dev/docs/migrations
  await db.schema
    .alterTable("user")
    .addColumn("emailSettingsNewProposals", "boolean", (col) =>
      col.notNull().defaultTo(true),
    )
    .execute();

  await db.schema
    .alterTable("user")
    .addColumn("emailSettingsNewDiscussions", "boolean", (col) =>
      col.notNull().defaultTo(true),
    )
    .execute();

  await db.schema
    .alterTable("user")
    .addColumn("emailSettingsDailyRoundup", "boolean", (col) =>
      col.notNull().defaultTo(true),
    )
    .execute();
}

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function down(db: Kysely<any>): Promise<void> {
  // down migration code goes here...
  // note: down migrations are optional. you can safely delete this function.
  // For more info, see: https://kysely.dev/docs/migrations
  await db.schema
    .alterTable("user")
    .dropColumn("emailSettingsNewProposals")
    .execute();

  await db.schema
    .alterTable("user")
    .dropColumn("emailSettingsNewDiscussions")
    .execute();

  await db.schema
    .alterTable("user")
    .dropColumn("emailSettingsDailyRoundup")
    .execute();
}
