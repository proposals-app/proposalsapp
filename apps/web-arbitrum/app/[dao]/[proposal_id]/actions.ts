"use server";

import { db } from "@proposalsapp/db";
import { otel } from "@/lib/otel";

export async function getProposalAndGroup(
  slug: string,
  proposalOrTopicId: string,
) {
  // Get the DAO first
  const dao = await db
    .selectFrom("dao")
    .where("slug", "=", slug)
    .selectAll()
    .executeTakeFirst();

  if (!dao) {
    return null;
  }

  // Try to find proposal first
  const proposal = await db
    .selectFrom("proposal")
    .where("proposal.daoId", "=", dao.id)
    .where("externalId", "=", proposalOrTopicId)
    .leftJoin("daoIndexer", "daoIndexer.id", "proposal.daoIndexerId")
    .selectAll("proposal")
    .select("daoIndexer.indexerVariant")
    .executeTakeFirst();

  // If no proposal, try to find discourse topic
  const topic = !proposal
    ? await db
        .selectFrom("discourseTopic")
        .where("externalId", "=", parseInt(proposalOrTopicId))
        .leftJoin(
          "daoDiscourse",
          "daoDiscourse.id",
          "discourseTopic.daoDiscourseId",
        )
        .where("daoDiscourse.daoId", "=", dao.id)
        .selectAll("discourseTopic")
        .select("daoDiscourse.discourseBaseUrl")
        .executeTakeFirst()
    : null;

  if (!proposal && !topic) {
    return null;
  }

  // Find a proposal group containing this item
  const groups = await db.selectFrom("proposalGroup").selectAll().execute();

  let matchingGroup = null;
  for (const group of groups) {
    const items = group.items as any[];
    const hasItem = items.some(
      (item) =>
        (item.type === "proposal" && proposal && item.id === proposal.id) ||
        (item.type === "topic" && topic && item.id === topic.id),
    );
    if (hasItem) {
      matchingGroup = group;
      break;
    }
  }

  return {
    dao,
    group: matchingGroup,
  };
}

export async function getGroupDetails(groupId: string | null) {
  if (!groupId) return null;

  const group = await db
    .selectFrom("proposalGroup")
    .where("id", "=", groupId)
    .selectAll()
    .executeTakeFirst();

  if (!group) {
    return null;
  }

  const items = group.items as any[];

  const proposalIds = items
    .filter((item) => item.type === "proposal")
    .map((item) => item.id);

  const topicIds = items
    .filter((item) => item.type === "topic")
    .map((item) => item.id);

  const proposals =
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

  const topics =
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
