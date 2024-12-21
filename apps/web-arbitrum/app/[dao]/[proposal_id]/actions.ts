import { AsyncReturnType } from "@/lib/utils";
import {
  db,
  DiscoursePost,
  DiscourseTopic,
  Proposal,
  ProposalGroup,
  Selectable,
  sql,
  Vote,
} from "@proposalsapp/db";

export async function getGroup(slug: string, proposalOrTopicId: string) {
  // Fetch the DAO based on the slug
  const dao = await db
    .selectFrom("dao")
    .where("slug", "=", slug)
    .selectAll()
    .executeTakeFirst();

  if (!dao) {
    return null;
  }

  let proposal: Selectable<Proposal> | null = null;
  let topic: Selectable<DiscourseTopic> | null = null;

  try {
    // Fetch the proposal based on externalId
    proposal = await db
      .selectFrom("proposal")
      .selectAll()
      .where("externalId", "=", proposalOrTopicId)
      .where("proposal.daoId", "=", dao.id)
      .executeTakeFirstOrThrow();
  } catch (error) {
    console.error("Error fetching proposal:", error);
  }

  try {
    if (!proposal)
      // Fetch the topic based on externalId
      topic = await db
        .selectFrom("discourseTopic")
        .selectAll()
        .where("externalId", "=", parseInt(proposalOrTopicId))
        .leftJoin(
          "daoDiscourse",
          "daoDiscourse.id",
          "discourseTopic.daoDiscourseId",
        )
        .where("daoDiscourse.daoId", "=", dao.id)
        .executeTakeFirstOrThrow();
  } catch (error) {
    console.error("Error fetching topic:", error);
  }

  if (!proposal && !topic) {
    return null;
  }

  // Find a proposal group containing this item
  let matchingGroup: Selectable<ProposalGroup> | null = null;

  const fetchMatchingGroup = async (
    id: string,
    type: "proposal" | "topic",
  ): Promise<Selectable<ProposalGroup> | null> => {
    const result = await db
      .selectFrom("proposalGroup")
      .where(
        sql<boolean>`exists (select 1 from jsonb_array_elements(proposal_group.items) as item where item->>'id' = ${id} and item->>'type' = ${type})`,
      )
      .selectAll()
      .executeTakeFirst();

    // Ensure the function returns null if no matching group is found
    return result ?? null;
  };

  if (proposal) {
    matchingGroup = await fetchMatchingGroup(proposal.id, "proposal");
  }

  if (!matchingGroup && topic) {
    matchingGroup = await fetchMatchingGroup(topic.id, "topic");
  }

  if (!matchingGroup) {
    return null;
  }

  return {
    dao,
    group: matchingGroup,
    daoSlug: slug,
    proposalOrTopicId: proposalOrTopicId,
  };
}

export async function getGroupData(slug: string, proposalOrTopicId: string) {
  // Fetch the DAO based on the slug
  const dao = await db
    .selectFrom("dao")
    .where("slug", "=", slug)
    .selectAll()
    .executeTakeFirst();

  if (!dao) {
    return null;
  }

  let proposal: Selectable<Proposal> | null = null;
  let topic: Selectable<DiscourseTopic> | null = null;

  try {
    // Fetch the proposal based on externalId
    proposal = await db
      .selectFrom("proposal")
      .selectAll()
      .where("externalId", "=", proposalOrTopicId)
      .where("proposal.daoId", "=", dao.id)
      .executeTakeFirstOrThrow();
  } catch (error) {
    console.error("Error fetching proposal:", error);
  }

  try {
    if (!proposal)
      // Fetch the topic based on externalId
      topic = await db
        .selectFrom("discourseTopic")
        .selectAll()
        .where("externalId", "=", parseInt(proposalOrTopicId))
        .leftJoin(
          "daoDiscourse",
          "daoDiscourse.id",
          "discourseTopic.daoDiscourseId",
        )
        .where("daoDiscourse.daoId", "=", dao.id)
        .executeTakeFirstOrThrow();
  } catch (error) {
    console.error("Error fetching topic:", error);
  }

  if (!proposal && !topic) {
    return null;
  }

  // Find a proposal group containing this item
  let matchingGroup: Selectable<ProposalGroup> | null = null;

  const fetchMatchingGroup = async (
    id: string,
    type: "proposal" | "topic",
  ): Promise<Selectable<ProposalGroup> | null> => {
    const result = await db
      .selectFrom("proposalGroup")
      .where(
        sql<boolean>`exists (select 1 from jsonb_array_elements(proposal_group.items) as item where item->>'id' = ${id} and item->>'type' = ${type})`,
      )
      .selectAll()
      .executeTakeFirst();

    // Ensure the function returns null if no matching group is found
    return result ?? null;
  };

  if (proposal) {
    matchingGroup = await fetchMatchingGroup(proposal.id, "proposal");
  }

  if (!matchingGroup && topic) {
    matchingGroup = await fetchMatchingGroup(topic.id, "topic");
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

  let fetchedProposals: Selectable<Proposal>[] = [];
  if (proposalIds.length > 0) {
    try {
      fetchedProposals = await db
        .selectFrom("proposal")
        .selectAll()
        .where("proposal.id", "in", proposalIds)
        .execute();
    } catch (error) {
      console.error("Error fetching proposals:", error);
    }
  }

  let fetchedTopics: Selectable<DiscourseTopic>[] = [];
  if (topicIds.length > 0) {
    try {
      fetchedTopics = await db
        .selectFrom("discourseTopic")
        .where("discourseTopic.id", "in", topicIds)
        .selectAll()
        .execute();
    } catch (error) {
      console.error("Error fetching topics:", error);
    }
  }

  return {
    dao,
    group: matchingGroup,
    proposals: fetchedProposals,
    topics: fetchedTopics,
    daoSlug: slug,
    proposalOrTopicId: proposalOrTopicId,
  };
}

export type Body = {
  title: string;
  content: string;
  author_name: string;
  author_picture: string;
  createdAt: Date;
  type: "proposal" | "topic";
};

export async function getBodiesForGroup(groupID: string) {
  let bodies: Body[] = [];

  const group = await db
    .selectFrom("proposalGroup")
    .selectAll()
    .where("id", "=", groupID)
    .executeTakeFirstOrThrow();

  if (!group) {
    return null;
  }

  const items = group.items as Array<{
    id: string;
    type: "proposal" | "topic";
  }>;

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
        .selectAll()
        .where("proposal.id", "in", proposalIds)
        .execute();
    } catch (error) {
      console.error("Error fetching proposals:", error);
    }
  }

  proposals.map((proposal) =>
    bodies.push({
      title: proposal.name,
      content: proposal.body,
      author_name: proposal.author ?? "Unknown",
      author_picture: `https://api.dicebear.com/9.x/pixel-art/svg?seed=${proposal.author}`,
      createdAt: proposal.timeCreated,
      type: "proposal",
    }),
  );

  let discourseTopics: Selectable<DiscourseTopic>[] = [];
  if (topicIds.length > 0) {
    try {
      discourseTopics = await db
        .selectFrom("discourseTopic")
        .selectAll()
        .where("discourseTopic.id", "in", topicIds)
        .execute();
    } catch (error) {
      console.error("Error fetching topics:", error);
    }
  }

  for (const discourseTopic of discourseTopics) {
    const discourseFirstPost = await db
      .selectFrom("discoursePost")
      .where("discoursePost.topicId", "=", discourseTopic.externalId)
      .where("daoDiscourseId", "=", discourseTopic.daoDiscourseId)
      .where("discoursePost.postNumber", "=", 1)
      .selectAll()
      .executeTakeFirstOrThrow();

    const discourseFirstPostAuthor = await db
      .selectFrom("discourseUser")
      .where("discourseUser.externalId", "=", discourseFirstPost.userId)
      .where("daoDiscourseId", "=", discourseTopic.daoDiscourseId)
      .selectAll()
      .executeTakeFirstOrThrow();

    bodies.push({
      title: discourseTopic.title,
      content: discourseFirstPost.cooked ?? "Unknown",
      author_name:
        discourseFirstPostAuthor.name ??
        discourseFirstPostAuthor.username ??
        "Unknown",
      author_picture: discourseFirstPostAuthor.avatarTemplate,
      createdAt: discourseFirstPost.createdAt,
      type: "topic",
    });

    const discourseFirstPostRevisions = await db
      .selectFrom("discoursePostRevision")
      .where(
        "discoursePostRevision.discoursePostId",
        "=",
        discourseFirstPost.id,
      )
      .selectAll()
      .execute();

    for (const discourseFirstPostRevision of discourseFirstPostRevisions) {
      bodies.push({
        title:
          discourseFirstPostRevision.cookedTitleAfter ?? discourseTopic.title,
        content:
          discourseFirstPostRevision.cookedBodyAfter ??
          discourseFirstPost.cooked,
        author_name:
          discourseFirstPostAuthor.name ??
          discourseFirstPostAuthor.username ??
          "Unknown",
        author_picture: discourseFirstPostAuthor.avatarTemplate,
        createdAt: discourseFirstPostRevision.createdAt,
        type: "topic",
      });
    }
  }

  bodies.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return bodies;
}

export async function getFeedForGroup(groupID: string) {
  let votes: Selectable<Vote>[] = [];
  let posts: Selectable<DiscoursePost>[] = [];

  try {
    const group = await db
      .selectFrom("proposalGroup")
      .selectAll()
      .where("id", "=", groupID)
      .executeTakeFirstOrThrow();

    if (!group) {
      return { votes, posts };
    }

    const items = group.items as Array<{
      id: string;
      type: "proposal" | "topic";
    }>;

    const proposalIds = items
      .filter((item) => item.type === "proposal")
      .map((item) => item.id);

    const topicIds = items
      .filter((item) => item.type === "topic")
      .map((item) => item.id);

    const topics = await db
      .selectFrom("discourseTopic")
      .selectAll()
      .where("discourseTopic.id", "in", topicIds)
      .execute();

    if (topics.length === 0) {
      return { votes, posts };
    }

    // Check if all topics have the same daoDiscourseId
    const firstDaoDiscourseId = topics[0].daoDiscourseId;
    for (const topic of topics) {
      if (topic.daoDiscourseId !== firstDaoDiscourseId) {
        console.error("Inconsistent daoDiscourseId across topics");
        return { votes, posts }; // or handle the error as needed
      }
    }

    const topicsExternalIds = topics.map((t) => t.externalId);

    // Fetch votes for proposals
    if (proposalIds.length > 0) {
      try {
        votes = await db
          .selectFrom("vote")
          .selectAll()
          .where("proposalId", "in", proposalIds)
          .execute();
      } catch (error) {
        console.error("Error fetching votes:", error);
      }
    }

    // Fetch posts for topics
    if (topics.length > 0) {
      try {
        const fetchedPosts = await db
          .selectFrom("discoursePost")
          .selectAll()
          .where("topicId", "in", topicsExternalIds)
          .where("discoursePost.daoDiscourseId", "=", firstDaoDiscourseId)
          .execute();

        posts = fetchedPosts;
      } catch (error) {
        console.error("Error fetching posts:", error);
      }
    }
  } catch (error) {
    console.error("Error fetching group or related data:", error);
  }

  votes.sort((a, b) => {
    if (a.timeCreated && b.timeCreated) {
      return a.timeCreated.getTime() - b.timeCreated.getTime();
    } else return 1;
  });

  posts.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return { votes, posts };
}

export async function getProposalsByIds(proposalIds: string[]) {
  const proposals = await db
    .selectFrom("proposal")
    .selectAll()
    .where("proposal.id", "in", proposalIds)
    .execute();

  return proposals;
}

export type FeedDataType = AsyncReturnType<typeof getFeedForGroup>;
export type GroupType = AsyncReturnType<typeof getGroup>;
export type GroupDataType = AsyncReturnType<typeof getGroupData>;
export type BodiesDataType = AsyncReturnType<typeof getBodiesForGroup>;
