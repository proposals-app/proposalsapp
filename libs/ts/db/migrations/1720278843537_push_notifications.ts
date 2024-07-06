import { sql, type Kysely } from "kysely";
import { DB } from "../src/kysely_db";

export async function up(db: Kysely<DB>): Promise<void> {
  // Create the new enum type
  await db.schema
    .createType("notification_type_enum_v2")
    .asEnum([
      "EMAIL_BULLETIN",
      "EMAIL_QUORUM_NOT_REACHED",
      "EMAIL_TIMEEND",
      "PUSH_QUORUM_NOT_REACHED",
      "PUSH_TIMEEND",
    ])
    .execute();

  // Create a temporary column to hold the new enum values
  await db.schema
    .alterTable("notification")
    .addColumn("type_temp", sql`notification_type_enum_v2`)
    .execute();

  // Update the temporary column with the mapped values using raw SQL
  await sql`
    UPDATE notification
    SET type_temp = CASE
      WHEN type = 'BULLETIN_EMAIL' THEN 'EMAIL_BULLETIN'::notification_type_enum_v2
      WHEN type = 'QUORUM_NOT_REACHED_EMAIL' THEN 'EMAIL_QUORUM_NOT_REACHED'::notification_type_enum_v2
      WHEN type = 'TIMEEND_EMAIL' THEN 'EMAIL_TIMEEND'::notification_type_enum_v2
      ELSE NULL
    END
  `.execute(db);

  // Drop the old column
  await db.schema.alterTable("notification").dropColumn("type").execute();

  // Rename the temporary column to the original column name
  await db.schema
    .alterTable("notification")
    .renameColumn("type_temp", "type")
    .execute();

  // Proceed with the rest of the migration
  await db.schema
    .createTable("user_push_notification_subscription")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("user_id", "uuid", (col) => col.notNull())
    .addColumn("endpoint", "text", (col) => col.notNull())
    .addColumn("p256dh", "text", (col) => col.notNull())
    .addColumn("auth", "text", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_user_push_notification_subscription_user_id",
      ["user_id"],
      "user",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addUniqueConstraint("unique_user_subscription", ["user_id", "endpoint"])
    .execute();

  await db.schema
    .alterTable("user_settings")
    .addColumn("push_notifications", "boolean", (col) =>
      col.defaultTo(false).notNull(),
    )
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  // Reverse the addition of the new column
  await db.schema
    .alterTable("user_settings")
    .dropColumn("push_notifications")
    .execute();

  // Create the old enum type
  await db.schema
    .createType("notification_type_enum_v1")
    .asEnum(["BULLETIN_EMAIL", "QUORUM_NOT_REACHED_EMAIL", "TIMEEND_EMAIL"])
    .execute();

  // Create a temporary column to hold the old enum values
  await db.schema
    .alterTable("notification")
    .addColumn("type_temp", sql`notification_type_enum_v1`)
    .execute();

  // Update the temporary column with the mapped values using raw SQL
  await sql`
    UPDATE notification
    SET type_temp = CASE
      WHEN type = 'EMAIL_BULLETIN' THEN 'BULLETIN_EMAIL'::notification_type_enum_v1
      WHEN type = 'EMAIL_QUORUM_NOT_REACHED' THEN 'QUORUM_NOT_REACHED_EMAIL'::notification_type_enum_v1
      WHEN type = 'EMAIL_TIMEEND' THEN 'TIMEEND_EMAIL'::notification_type_enum_v1
      ELSE NULL
    END
  `.execute(db);

  // Drop the new column
  await db.schema.alterTable("notification").dropColumn("type").execute();

  // Rename the temporary column to the original column name
  await db.schema
    .alterTable("notification")
    .renameColumn("type_temp", "type")
    .execute();

  // Drop the new enum type
  await db.schema.dropType("notification_type_enum_v2").execute();

  // Drop the new table
  await db.schema.dropTable("user_push_notification_subscription").execute();
}
