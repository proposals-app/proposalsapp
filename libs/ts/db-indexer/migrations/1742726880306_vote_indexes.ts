import { type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Composite index for vote(proposalExternalId, governorId)
  await db.schema
    .createIndex("idx_vote_external_id_governor_id")
    .on("vote")
    .columns(["proposal_external_id", "governor_id"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex("idx_vote_external_id_governor_id").execute();
}
