import { AsyncReturnType } from "@/lib/utils";
import {
  db,
  DiscourseTopic,
  Proposal,
  ProposalGroup,
  Selectable,
  sql,
} from "@proposalsapp/db";

export async function getGroupWithData(
  daoSlug: string,
  proposalOrGroupId: string,
) {
  // Fetch the DAO based on the slug
  const dao = await db
    .selectFrom("dao")
    .where("slug", "=", daoSlug)
    .selectAll()
    .executeTakeFirst();

  if (!dao) {
    return null;
  }

  let group: Selectable<ProposalGroup> | null = null;

  try {
    // Fetch the group based on ID
    group =
      (await db
        .selectFrom("proposalGroup")
        .where("id", "=", proposalOrGroupId)
        .selectAll()
        .executeTakeFirst()) ?? null;
  } catch (error) {
    // console.error("Error fetching group:", error);
  }

  if (group) {
    const items = group.items as any[];

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
      group: group,
      proposals: fetchedProposals,
      topics: fetchedTopics,
      daoSlug: daoSlug,
      proposalOrTopicId: proposalOrGroupId,
    };
  }

  let proposal: Selectable<Proposal> | null = null;
  try {
    // Fetch the proposal based on externalId
    proposal =
      (await db
        .selectFrom("proposal")
        .selectAll()
        .where("externalId", "=", proposalOrGroupId)
        .where("proposal.daoId", "=", dao.id)
        .executeTakeFirst()) ?? null;
  } catch (error) {
    console.error("Error fetching proposal:", error);
  }

  let topic: Selectable<DiscourseTopic> | null = null;
  if (!proposal) {
    try {
      // Fetch the topic based on externalId
      topic =
        (await db
          .selectFrom("discourseTopic")
          .selectAll()
          .where("externalId", "=", parseInt(proposalOrGroupId, 10))
          .leftJoin(
            "daoDiscourse",
            "daoDiscourse.id",
            "discourseTopic.daoDiscourseId",
          )
          .where("daoDiscourse.daoId", "=", dao.id)
          .executeTakeFirst()) ?? null;
    } catch (error) {
      console.error("Error fetching topic:", error);
    }
  }

  if (!proposal && !topic) {
    return null;
  }

  // Find a proposal group containing this item
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

  let matchingGroup: Selectable<ProposalGroup> | null = null;

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
    daoSlug: daoSlug,
    proposalOrTopicId: proposalOrGroupId,
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

    const discourseFirstPostRevisions = await db
      .selectFrom("discoursePostRevision")
      .where(
        "discoursePostRevision.discoursePostId",
        "=",
        discourseFirstPost.id,
      )
      .selectAll()
      .execute();

    if (!discourseFirstPostRevisions.length)
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

    for (const discourseFirstPostRevision of discourseFirstPostRevisions) {
      if (discourseFirstPostRevision.version == 2)
        bodies.push({
          title:
            discourseFirstPostRevision.cookedTitleBefore ??
            discourseTopic.title,
          content:
            discourseFirstPostRevision.cookedBodyBefore ??
            discourseFirstPost.cooked,
          author_name:
            discourseFirstPostAuthor.name ??
            discourseFirstPostAuthor.username ??
            "Unknown",
          author_picture: discourseFirstPostAuthor.avatarTemplate,
          createdAt: discourseFirstPost.createdAt,
          type: "topic",
        });

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

export async function getTotalVersions(groupID: string) {
  let totalVersions = 0;

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

  totalVersions += proposals.length;

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

    totalVersions++;

    const discourseFirstPostRevisions = await db
      .selectFrom("discoursePostRevision")
      .where(
        "discoursePostRevision.discoursePostId",
        "=",
        discourseFirstPost.id,
      )
      .selectAll()
      .execute();

    totalVersions += discourseFirstPostRevisions.length;
  }

  return totalVersions;
}

export type GroupWithDataType = AsyncReturnType<typeof getGroupWithData>;
export type BodiesDataType = AsyncReturnType<typeof getBodiesForGroup>;
