import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Create voting_power table
  await db.schema
    .createTable("voting_power")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("voter", "text", (col) => col.notNull())
    .addColumn("voting_power", "float8", (col) => col.notNull())
    .addColumn("dao_id", "uuid", (col) => col.notNull())
    .addColumn("timestamp", "timestamp", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("block", "integer", (col) => col.notNull())
    .addColumn("txid", "text")
    .addForeignKeyConstraint(
      "fk_voting_power_dao_id",
      ["dao_id"],
      "dao",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  // Create delegation table
  await db.schema
    .createTable("delegation")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("delegator", "text", (col) => col.notNull())
    .addColumn("delegate", "text", (col) => col.notNull())
    .addColumn("dao_id", "uuid", (col) => col.notNull())
    .addColumn("timestamp", "timestamp", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("block", "integer", (col) => col.notNull())
    .addColumn("txid", "text")
    .addForeignKeyConstraint(
      "fk_delegation_dao_id",
      ["dao_id"],
      "dao",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  // Add indexes for voting_power table
  await db.schema
    .createIndex("idx_voting_power_voter")
    .on("voting_power")
    .column("voter")
    .execute();
  await db.schema
    .createIndex("idx_voting_power_timestamp")
    .on("voting_power")
    .column("timestamp")
    .execute();
  await db.schema
    .createIndex("idx_voting_power_block")
    .on("voting_power")
    .column("block")
    .execute();
  // New composite indexes for voting_power
  await db.schema
    .createIndex("idx_voting_power_voter_block")
    .on("voting_power")
    .columns(["voter", "block"])
    .execute();
  await db.schema
    .createIndex("idx_voting_power_voter_timestamp")
    .on("voting_power")
    .columns(["voter", "timestamp"])
    .execute();

  // Add indexes for delegation table
  await db.schema
    .createIndex("idx_delegation_delegate")
    .on("delegation")
    .column("delegate")
    .execute();
  await db.schema
    .createIndex("idx_delegation_delegator")
    .on("delegation")
    .column("delegator")
    .execute();
  await db.schema
    .createIndex("idx_delegation_timestamp")
    .on("delegation")
    .column("timestamp")
    .execute();
  await db.schema
    .createIndex("idx_delegation_block")
    .on("delegation")
    .column("block")
    .execute();
  // New composite indexes for delegation
  await db.schema
    .createIndex("idx_delegation_delegate_block")
    .on("delegation")
    .columns(["delegate", "block"])
    .execute();
  await db.schema
    .createIndex("idx_delegation_delegate_timestamp")
    .on("delegation")
    .columns(["delegate", "timestamp"])
    .execute();

  await sql`alter type indexer_type add value 'VOTING_POWER'`.execute(db);
  await sql`alter type indexer_type add value 'DELEGATION'`.execute(db);
  await sql`alter type indexer_variant add value 'ARB_ARBITRUM_VOTING_POWER'`.execute(
    db,
  );
  await sql`alter type indexer_variant add value 'ARB_ARBITRUM_DELEGATION'`.execute(
    db,
  );
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop tables
  await db.schema.dropTable("voting_power").execute();
  await db.schema.dropTable("delegation").execute();
}
