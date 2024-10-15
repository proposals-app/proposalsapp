import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Remove the unique constraint on the txid column for votes
  await db.schema.alterTable("vote").dropConstraint("vote_txid_key").execute();

  // Remove the unique constraint on the txid column for proposals
  await db.schema
    .alterTable("proposal")
    .dropConstraint("proposal_txid_key")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Re-add the unique constraint for votes
  await db.schema
    .alterTable("vote")
    .addUniqueConstraint("vote_txid_key", ["txid"])
    .execute();

  // Remove the non-unique index for proposals
  await db.schema.dropIndex("idx_proposal_txid").execute();
}
