// migrations/YYYYMMDDHHMMSS_add_voting_power_dao_voter_ts_index.ts
import { Kysely, sql } from "kysely";

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export async function up(db: Kysely<any>): Promise<void> {
  // Index to optimize fetching the latest voting power record per voter within a DAO
  // covering the common query pattern used in getNonVoters and similar functions.
  await db.schema
    .createIndex("idx_voting_power_dao_voter_ts_desc")
    .on("voting_power") // Use the actual table name in your DB
    // Order by timestamp DESC is crucial for efficient DISTINCT ON
    .columns(["dao_id", "voter", "timestamp desc"]) // Use actual column names
    .execute();
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex("idx_voting_power_dao_voter_ts_desc").execute();
}
