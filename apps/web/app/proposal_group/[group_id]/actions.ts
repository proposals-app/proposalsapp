"use server";

import {
  DaoDiscourse,
  db,
  DiscoursePost,
  DiscourseTopic,
  IndexerVariant,
  JsonArray,
  Proposal,
  Selectable,
  Vote,
} from "@proposalsapp/db";

export async function getGroupDetails(groupId: string) {
  const group = await db
    .selectFrom("proposalGroup")
    .where("id", "=", groupId)
    .selectAll()
    .executeTakeFirst();

  if (!group) {
    return null;
  }

  const items = group.items as JsonArray;

  const proposalIds = items
    .filter(
      (item: any): item is { type: "proposal"; id: string } =>
        item.type === "proposal",
    )
    .map((item) => item.id);
  const topicIds = items
    .filter(
      (item: any): item is { type: "topic"; id: string } =>
        item.type === "topic",
    )
    .map((item) => item.id);

  const proposals: (Selectable<Proposal> & {
    votes: Selectable<Vote>[];
    indexerVariant: IndexerVariant | null;
  })[] =
    proposalIds.length > 0
      ? await db
          .selectFrom("proposal")
          .where("proposal.id", "in", proposalIds)
          .leftJoin("vote", "vote.proposalId", "proposal.id")
          .leftJoin("daoIndexer", "daoIndexer.id", "proposal.daoIndexerId")
          .selectAll("proposal")
          .select("daoIndexer.indexerVariant")
          .select(db.fn.jsonAgg("vote").as("votes"))
          .groupBy(["proposal.id", "daoIndexer.indexerVariant"])
          .execute()
      : [];

  type TopicWithPosts = Selectable<DiscourseTopic> & {
    daoDiscourseId: string;
    discourseBaseUrl: string | null;
    enabled: boolean | null;
    posts: Selectable<DiscoursePost>[];
  };

  const topics: TopicWithPosts[] =
    topicIds.length > 0
      ? await db
          .selectFrom("discourseTopic")
          .where("discourseTopic.id", "in", topicIds)
          .leftJoin(
            "daoDiscourse",
            "discourseTopic.daoDiscourseId",
            "daoDiscourse.id",
          )
          .leftJoin(
            "discoursePost",
            "discoursePost.topicId",
            "discourseTopic.externalId",
          )
          .selectAll("discourseTopic")
          .select(["daoDiscourse.discourseBaseUrl", "daoDiscourse.enabled"])
          .select(db.fn.jsonAgg("discoursePost").as("posts"))
          .groupBy([
            "discourseTopic.id",
            "daoDiscourse.id",
            "daoDiscourse.discourseBaseUrl",
            "daoDiscourse.enabled",
          ])
          .execute()
      : [];

  return {
    ...group,
    proposals,
    topics,
  };
}
