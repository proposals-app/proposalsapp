import { AsyncReturnType } from "@/lib/utils";
import { db, DiscoursePost, Selectable, Vote } from "@proposalsapp/db";

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
          .where("postNumber", "!=", 1)
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

export async function getDiscourseUser(userId: number, daoDiscourseId: string) {
  const discourseUser = await db
    .selectFrom("discourseUser")
    .selectAll()
    .where("daoDiscourseId", "=", daoDiscourseId)
    .where("externalId", "=", userId)
    .executeTakeFirst();

  return discourseUser;
}

export type FeedDataType = AsyncReturnType<typeof getFeedForGroup>;
