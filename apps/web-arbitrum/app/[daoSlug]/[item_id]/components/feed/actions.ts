import { VotesFilterEnum } from "@/app/searchParams";
import { AsyncReturnType } from "@/lib/utils";
import {
  db,
  DiscoursePost,
  Selectable,
  Vote,
  VotingPower,
} from "@proposalsapp/db";

export async function getFeedForGroup(
  groupID: string,
  commentsFilter: boolean,
  votesFilter: VotesFilterEnum,
) {
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
        let voteQuery = db
          .selectFrom("vote")
          .selectAll()
          .where("proposalId", "in", proposalIds);

        // Apply vote filter based on the votesFilter parameter
        switch (votesFilter) {
          case VotesFilterEnum.FIFTY_THOUSAND:
            voteQuery = voteQuery.where("votingPower", ">", 50000);
            break;
          case VotesFilterEnum.FIVE_HUNDRED_THOUSAND:
            voteQuery = voteQuery.where("votingPower", ">", 500000);
            break;
          case VotesFilterEnum.FIVE_MILLION:
            voteQuery = voteQuery.where("votingPower", ">", 5000000);
            break;
        }

        votes = await voteQuery.execute();
      } catch (error) {
        console.error("Error fetching votes:", error);
      }
    }

    // Fetch posts for topics
    if (topics.length > 0 && commentsFilter) {
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
  if (!proposalIds || proposalIds.length === 0) {
    return [];
  }

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

export async function getVotingPower(
  voteId: string,
  proposalId: string,
  topicExternalIds: number[],
): Promise<{
  initialVotingPower: number;
  finalVotingPower: number;
  change: number | null;
}> {
  try {
    // Fetch the vote to get voter address and timestamps
    const vote = await db
      .selectFrom("vote")
      .selectAll()
      .where("id", "=", voteId)
      .executeTakeFirstOrThrow();

    // Fetch the proposal to get creation time and end time
    const proposal = await db
      .selectFrom("proposal")
      .selectAll()
      .where("id", "=", proposalId)
      .executeTakeFirstOrThrow();

    if (!vote || !proposal) {
      throw new Error("Vote or Proposal not found");
    }

    // Fetch the DAO and its discourse to get the start time
    const dao = await db
      .selectFrom("dao")
      .selectAll()
      .where("id", "=", proposal.daoId)
      .executeTakeFirstOrThrow();

    const daoDiscourse = await db
      .selectFrom("daoDiscourse")
      .selectAll()
      .where("daoDiscourse.daoId", "=", dao.id)
      .executeTakeFirstOrThrow();

    // Fetch topics related to the proposal (if any)
    let topics: { createdAt: Date }[] = [];
    if (topicExternalIds.length) {
      topics = await db
        .selectFrom("discourseTopic")
        .selectAll()
        .where("discourseTopic.daoDiscourseId", "=", daoDiscourse.id)
        .where("externalId", "in", topicExternalIds)
        .execute();
    }

    // Determine the start time as the earliest creation time among proposals and topics
    const proposalStartTime = new Date(proposal.timeCreated);
    const topicStartTimes = topics.map((topic) => topic.createdAt);
    const startTime = new Date(
      Math.min(
        proposalStartTime.getTime(),
        ...topicStartTimes.map((time) => time.getTime()),
      ),
    );

    const endTime = proposal.timeEnd;

    // Fetch the closest voting power record to the start time
    const initialVotingPowerRecord = await db
      .selectFrom("votingPower")
      .selectAll()
      .where("voter", "=", vote.voterAddress)
      .where("timestamp", "<=", startTime)
      .orderBy("timestamp", "desc")
      .limit(1)
      .executeTakeFirst();

    // Fetch the closest voting power record to the end time
    const finalVotingPowerRecord = await db
      .selectFrom("votingPower")
      .selectAll()
      .where("voter", "=", vote.voterAddress)
      .where("timestamp", "<=", endTime)
      .orderBy("timestamp", "desc")
      .limit(1)
      .executeTakeFirst();

    const initialVotingPower = initialVotingPowerRecord?.votingPower ?? 0;
    const finalVotingPower = finalVotingPowerRecord?.votingPower ?? 0;

    let change: number | null = null;
    if (initialVotingPower !== finalVotingPower) {
      change =
        ((finalVotingPower - initialVotingPower) / initialVotingPower) * 100;
    }

    return { initialVotingPower, finalVotingPower, change };
  } catch (error) {
    console.error("Error fetching voting power:", error);
    throw error; // Re-throw the error after logging
  }
}

export type VotingPowerChangeType = AsyncReturnType<typeof getVotingPower>;

export type FeedDataType = AsyncReturnType<typeof getFeedForGroup>;
