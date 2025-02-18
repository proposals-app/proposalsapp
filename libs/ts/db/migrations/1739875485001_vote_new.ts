import { sql, type Kysely } from "kysely";
import { DB } from "../src/kysely_db";

export async function up(db: Kysely<DB>): Promise<void> {
  await db.schema
    .createTable("vote_new")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("voter_address", "text", (col) => col.notNull())
    .addColumn("choice", "jsonb", (col) => col.defaultTo("[]").notNull())
    .addColumn("voting_power", "float8", (col) => col.notNull())
    .addColumn("reason", "text")
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .addColumn("block_created_at", "integer")
    .addColumn("txid", "text")
    .addColumn("proposal_external_id", "text", (col) => col.notNull())
    .addColumn("proposal_id", "uuid", (col) => col.notNull())
    .addColumn("dao_id", "uuid", (col) => col.notNull())
    .addColumn("indexer_id", "uuid", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_vote_new_voter_address",
      ["voter_address"],
      "voter",
      ["address"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_vote_new_proposal_id",
      ["proposal_id"],
      "proposal_new",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_vote_new_dao_id",
      ["dao_id"],
      "dao",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_vote_new_dao_indexer_id",
      ["indexer_id"],
      "dao_indexer",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addUniqueConstraint("unique_vote_new", ["proposal_id", "voter_address"])
    .execute();

  await db.schema
    .createIndex("idx_vote_new_proposal_id")
    .on("vote_new")
    .column("proposal_id")
    .execute();

  await db.schema
    .createIndex("idx_vote_new_dao_id")
    .on("vote_new")
    .column("dao_id")
    .execute();

  await db.schema
    .createIndex("idx_vote_new_voter_address")
    .on("vote_new")
    .column("voter_address")
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.schema.dropTable("vote_new").execute();
}
