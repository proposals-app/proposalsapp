import { type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createIndex("idx_user_proposal_group_last_read_proposal_group_id")
    .on("user_proposal_group_last_read")
    .column("proposal_group_id")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .dropIndex("idx_user_proposal_group_last_read_proposal_group_id")
    .ifExists()
    .execute();
}
