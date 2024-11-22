"use server";

import {
  db,
  DiscoursePost,
  DiscourseTopic,
  Proposal,
  ProposalGroup,
  Selectable,
  Vote,
} from "@proposalsapp/db";

type ExtendedProposal = Selectable<Proposal> & {
  indexerVariant: string | null;
  votes?: Array<Omit<Selectable<Vote>, "proposalId" | "daoIndexerId">>;
};

type ExtendedDiscourseTopic = Selectable<DiscourseTopic> & {
  discourseBaseUrl: string | null;
  enabled?: boolean;
  posts?: Array<Omit<Selectable<DiscoursePost>, "topicSlug">>;
};

export async function getGroupData(slug: string, proposalOrTopicId: string) {
  // Get the DAO first
  const dao = await db
    .selectFrom("dao")
    .where("slug", "=", slug)
    .selectAll()
    .executeTakeFirst();

  if (!dao) {
    return null;
  }

  // Initialize variables as optional or with default values
  let proposal: ExtendedProposal | undefined;
  let topic: ExtendedDiscourseTopic | undefined;

  try {
    proposal = await db
      .selectFrom("proposal")
      .where("proposal.daoId", "=", dao.id)
      .where("externalId", "=", proposalOrTopicId)
      .leftJoin("daoIndexer", "daoIndexer.id", "proposal.daoIndexerId")
      .selectAll("proposal")
      .select("daoIndexer.indexerVariant")
      .executeTakeFirst();
  } catch (error) {
    console.error("Error fetching proposal:", error);
  }

  // If no proposal, try to find discourse topic
  if (!proposal) {
    try {
      topic = await db
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
        .executeTakeFirst();
    } catch (error) {
      console.error("Error fetching topic:", error);
    }
  }

  if (!proposal && !topic) {
    return null;
  }

  // Find a proposal group containing this item
  const groups = await db.selectFrom("proposalGroup").selectAll().execute();

  let matchingGroup: Selectable<ProposalGroup> | null = null;
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

  if (!matchingGroup) {
    return null;
  }

  const items = matchingGroup.items as any[];

  const proposalIds = items
    .filter((item) => item.type === "proposal")
    .map((item) => item.id);

  const topicIds = items
    .filter((item) => item.type === "topic")
    .map((item) => item.id);

  let proposals: Selectable<Proposal>[] = [];
  if (proposalIds.length > 0) {
    try {
      proposals = await db
        .selectFrom("proposal")
        .where("proposal.id", "in", proposalIds)
        .leftJoin("vote", "vote.proposalId", "proposal.id")
        .leftJoin("daoIndexer", "daoIndexer.id", "proposal.daoIndexerId")
        .selectAll("proposal")
        .select("daoIndexer.indexerVariant")
        .select(db.fn.jsonAgg("vote").as("votes"))
        .groupBy(["proposal.id", "daoIndexer.indexerVariant"])
        .execute();
    } catch (error) {
      console.error("Error fetching proposals:", error);
    }
  }

  let topics: Selectable<DiscourseTopic>[] = [];
  if (topicIds.length > 0) {
    try {
      topics = await db
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
        .execute();
    } catch (error) {
      console.error("Error fetching topics:", error);
    }
  }

  console.log({
    dao,
    group: matchingGroup,
    proposals,
    topics,
  });

  return {
    dao,
    group: matchingGroup,
    proposals,
    topics,
  };
}
