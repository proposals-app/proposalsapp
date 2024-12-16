import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Drop the notification table if it exists
  await db.schema.dropTable("notification").ifExists().execute();

  // Drop the job_queue table if it exists
  await db.schema.dropTable("job_queue").ifExists().execute();

  // Recreate the job_queue table with a generalized structure
  await db.schema
    .createTable("job_queue")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("type", "text", (col) => col.notNull())
    .addColumn("data", "jsonb", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.defaultTo("PENDING").notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop the job_queue table if it exists
  await db.schema.dropTable("job_queue").ifExists().execute();

  // Recreate the old job_queue table structure (optional)
  await db.schema
    .createTable("job_queue")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("job_type", "varchar", (col) => col.notNull())
    .addColumn("job", "jsonb", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("processed", "boolean", (col) => col.defaultTo(false))
    .execute();

  // Recreate the notification table structure (optional)
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
    .execute();
}
