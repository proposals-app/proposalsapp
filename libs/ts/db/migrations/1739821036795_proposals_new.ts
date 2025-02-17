import { sql, type Kysely } from "kysely";
import { DB } from "../src/kysely_db";

export async function up(db: Kysely<DB>): Promise<void> {
  await db.schema
    .createTable("proposal_new")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("external_id", "text", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("body", "text", (col) => col.notNull())
    .addColumn("url", "text", (col) => col.notNull())
    .addColumn("discussion_url", "text")
    .addColumn("choices", "jsonb", (col) => col.defaultTo("[]").notNull())
    .addColumn("quorum", "float8", (col) => col.notNull())
    .addColumn("proposal_state", sql`proposal_state`, (col) => col.notNull())
    .addColumn("marked_spam", "boolean", (col) =>
      col.defaultTo(false).notNull(),
    )
    .addColumn("created_at", "timestamp", (col) => col.notNull())
    .addColumn("start_at", "timestamp", (col) => col.notNull())
    .addColumn("end_at", "timestamp", (col) => col.notNull())
    .addColumn("block_created_at", "integer")
    .addColumn("txid", "text", (col) => col.unique())
    .addColumn("metadata", "jsonb")
    .addColumn("dao_indexer_id", "uuid", (col) => col.notNull())
    .addColumn("dao_id", "uuid", (col) => col.notNull())
    .addColumn("author", "text")
    .addForeignKeyConstraint(
      "fk_proposal_new_dao_indexer_id",
      ["dao_indexer_id"],
      "dao_indexer",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_proposal_new_dao_id",
      ["dao_id"],
      "dao",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addUniqueConstraint("unique_proposal_new", [
      "external_id",
      "dao_indexer_id",
    ])
    .execute();

  await db.schema
    .createIndex("idx_proposal_new_dao_id")
    .on("proposal_new")
    .column("dao_id")
    .execute();

  await db.schema
    .createIndex("idx_proposal_new_time_start")
    .on("proposal_new")
    .column("start_at")
    .execute();

  await db.schema
    .createIndex("idx_proposal_new_time_end")
    .on("proposal_new")
    .column("end_at")
    .execute();

  await db.schema
    .createIndex("idx_proposal_new_proposal_state")
    .on("proposal_new")
    .column("proposal_state")
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.schema.dropTable("proposal_new").execute();
}
