import { type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // 1. Create composite index on vote (proposalId, voterAddress)
  await db.schema
    .createIndex("idx_vote_proposal_id_voter_address")
    .on("vote")
    .columns(["proposal_id", "voter_address"])
    .execute();

  // 2. Create crucial composite index on votingPower (daoId, voter, timestamp, votingPower)
  await db.schema
    .createIndex("idx_voting_power_dao_id_voter_timestamp_voting_power")
    .on("voting_power")
    .columns(["dao_id", "voter", "timestamp", "voting_power"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop the new indexes
  await db.schema
    .dropIndex("idx_vote_proposal_id_voter_address")
    .ifExists()
    .execute();
  await db.schema
    .dropIndex("idx_voting_power_dao_id_voter_timestamp_voting_power")
    .ifExists()
    .execute();
}
