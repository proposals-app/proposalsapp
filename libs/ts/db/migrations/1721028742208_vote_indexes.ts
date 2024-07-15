import { type Kysely } from "kysely";
import { DB } from "../src/kysely_db";

export async function up(db: Kysely<DB>): Promise<void> {
  await db.schema
    .createIndex("idx_vote_proposal_id")
    .on("vote")
    .column("proposal_id")
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.schema.dropIndex("idx_vote_proposal_id").execute();
}
