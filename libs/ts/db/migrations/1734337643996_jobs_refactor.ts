import { sql, type Kysely } from "kysely";
import { DB } from "./../src/kysely_db";

export async function up(db: Kysely<DB>): Promise<void> {
  // Drop the notification table if it exists
  await db.schema.dropTable("notification").execute();

  // Recreate job_queue with more generalized schema
  await db.schema
    .createTable("job_queue")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("type", "text", (col) => col.notNull())
    .addColumn("data", "jsonb", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull().defaultTo("PENDING"))
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.schema.dropTable("job_queue").execute();

  // Recreate job_queue with the original schema
  await db.schema
    .createTable("job_queue")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("job", "jsonb", (col) => col.notNull())
    .addColumn("job_type", "varchar", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("processed", "boolean", (col) => col.defaultTo(false))
    .execute();

  // Recreate notification table
  await db.schema
    .createTable("notification")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("user_id", "uuid", (col) => col.notNull())
    .addColumn("proposal_id", "uuid", (col) => col.notNull())
    .addColumn("type", sql`notification_type_enum`, (col) => col.notNull())
    .addColumn(
      "dispatch_status",
      sql`notification_dispatch_status_enum`,
      (col) => col.defaultTo("NOT_DISPATCHED").notNull(),
    )
    .addColumn("dispatched_at", "timestamp")
    .addForeignKeyConstraint(
      "fk_notification_user_id",
      ["user_id"],
      "user",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_notification_proposal_id",
      ["proposal_id"],
      "proposal",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addUniqueConstraint("unique_notification", [
      "user_id",
      "proposal_id",
      "type",
    ])
    .execute();
}
