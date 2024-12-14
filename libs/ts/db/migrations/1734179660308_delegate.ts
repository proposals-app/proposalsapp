import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Create delegate table
  await db.schema
    .createTable("delegate")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("dao_id", "uuid", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_dao_discourse_dao_id",
      ["dao_id"],
      "dao",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  // Create delegate_to_voter table (many-to-many)
  await db.schema
    .createTable("delegate_to_voter")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("delegate_id", "uuid", (col) => col.notNull())
    .addColumn("voter_id", "uuid", (col) => col.notNull())
    .addColumn("period_start", "timestamp", (col) => col.notNull())
    .addColumn("period_end", "timestamp", (col) => col.notNull())
    .addColumn("proof", "jsonb")
    .addColumn("verified", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addForeignKeyConstraint(
      "fk_delegate_to_voter_delegate_id",
      ["delegate_id"],
      "delegate",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_delegate_to_voter_voter_id",
      ["voter_id"],
      "voter",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  // Create delegate_to_discourse_user table (many-to-many)
  await db.schema
    .createTable("delegate_to_discourse_user")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("delegate_id", "uuid", (col) => col.notNull())
    .addColumn("discourse_user_id", "uuid", (col) => col.notNull())
    .addColumn("period_start", "timestamp", (col) => col.notNull())
    .addColumn("period_end", "timestamp", (col) => col.notNull())
    .addColumn("proof", "jsonb")
    .addColumn("verified", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addForeignKeyConstraint(
      "fk_delegate_to_discourse_user_delegate_id",
      ["delegate_id"],
      "delegate",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_delegate_to_discourse_user_discourse_user_id",
      ["discourse_user_id"],
      "discourse_user",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  await db.schema
    .createIndex("idx_delegate_to_voter_delegate_id")
    .on("delegate_to_voter")
    .column("delegate_id")
    .execute();

  await db.schema
    .createIndex("idx_delegate_to_voter_voter_id")
    .on("delegate_to_voter")
    .column("voter_id")
    .execute();

  await db.schema
    .createIndex("idx_delegate_to_voter_period")
    .on("delegate_to_voter")
    .columns(["period_start", "period_end"])
    .execute();

  await db.schema
    .createIndex("idx_delegate_to_discourse_user_delegate_id")
    .on("delegate_to_discourse_user")
    .column("delegate_id")
    .execute();

  await db.schema
    .createIndex("idx_delegate_to_discourse_user_discourse_user_id")
    .on("delegate_to_discourse_user")
    .column("discourse_user_id")
    .execute();

  await db.schema
    .createIndex("idx_delegate_to_discourse_user_period")
    .on("delegate_to_discourse_user")
    .columns(["period_start", "period_end"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop tables in reverse order of creation

  await db.schema.dropTable("delegate_to_discourse_user").execute();
  await db.schema.dropTable("delegate_to_voter").execute();
  await db.schema.dropTable("delegate").execute();
}
