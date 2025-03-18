import { type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Index for proposalGroup.daoId
  await db.schema
    .createIndex("idx_proposal_group_dao_id")
    .on("proposal_group")
    .column("dao_id")
    .execute();

  // Composite index for proposal(externalId, governorId)
  await db.schema
    .createIndex("idx_proposal_external_id_governor_id")
    .on("proposal")
    .columns(["external_id", "governor_id"])
    .execute();

  // Composite index for discourseTopic(externalId, daoDiscourseId)
  await db.schema
    .createIndex("idx_discourse_topic_external_id_dao_discourse_id")
    .on("discourse_topic")
    .columns(["external_id", "dao_discourse_id"])
    .execute();

  // Composite index for discoursePost(topicId, daoDiscourseId, postNumber)
  await db.schema
    .createIndex("idx_discourse_post_topic_dao_discourse_post_number")
    .on("discourse_post")
    .columns(["topic_id", "dao_discourse_id", "post_number"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex("idx_proposal_group_dao_id").execute();
  await db.schema.dropIndex("idx_proposal_external_id_governor_id").execute();
  await db.schema
    .dropIndex("idx_discourse_topic_external_id_dao_discourse_id")
    .execute();
  await db.schema
    .dropIndex("idx_discourse_post_topic_dao_discourse_post_number")
    .execute();
}
