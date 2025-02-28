import { type Kysely } from "kysely";
import { DB } from "../src/kysely_db";

export async function up(db: Kysely<DB>): Promise<void> {
  // First add the new columns to proposal_new table
  await db.schema
    .alterTable("proposal_new")
    .addColumn("governor_id", "uuid", (col) => col.notNull())
    .execute();

  // Create index for the new column
  await db.schema
    .createIndex("idx_proposal_new_governor_id")
    .on("proposal_new")
    .column("governor_id")
    .execute();

  // Add foreign key constraint
  await db.schema
    .alterTable("proposal_new")
    .addForeignKeyConstraint(
      "fk_proposal_new_governor_id",
      ["governor_id"],
      "governor_new",
      ["id"],
    )
    .execute();

  // Now add the new columns to vote_new table
  await db.schema
    .alterTable("vote_new")
    .addColumn("governor_id", "uuid", (col) => col.notNull())
    .execute();

  // Create index for the new column
  await db.schema
    .createIndex("idx_vote_new_governor_id")
    .on("vote_new")
    .column("governor_id")
    .execute();

  // Add foreign key constraint
  await db.schema
    .alterTable("vote_new")
    .addForeignKeyConstraint(
      "fk_vote_new_governor_id",
      ["governor_id"],
      "governor_new",
      ["id"],
    )
    .execute();

  // await db.schema.alterTable("vote_new").dropColumn("indexer_id").execute();
  // await db.schema
  //   .alterTable("proposal_new")
  //   .dropColumn("dao_indexer_id")
  //   .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  // Remove foreign key constraints first
  await db.schema
    .alterTable("vote_new")
    .dropConstraint("fk_vote_new_governor_id")
    .execute();

  await db.schema
    .alterTable("proposal_new")
    .dropConstraint("fk_proposal_new_governor_id")
    .execute();

  // Drop indexes
  await db.schema.dropIndex("idx_vote_new_governor_id").execute();
  await db.schema.dropIndex("idx_proposal_new_governor_id").execute();

  // Drop columns
  await db.schema.alterTable("vote_new").dropColumn("governor_id").execute();
  await db.schema
    .alterTable("proposal_new")
    .dropColumn("governor_id")
    .execute();
}
