import { VotesFilterEnum } from "@/app/searchParams";
import { AsyncReturnType } from "@/lib/utils";
import {
  db,
  DiscoursePost,
  DiscourseTopic,
  Proposal,
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
  proposalIds: string[],
  topicExternalIds: number[],
): Promise<{
  startTime: Date;
  endTime: Date;
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

    // Fetch the proposals
    let proposals: Selectable<Proposal>[] = [];
    if (proposalIds.length > 0) {
      proposals = await db
        .selectFrom("proposal")
        .selectAll()
        .where("id", "in", proposalIds)
        .execute();
    }

    // Fetch the topics
    let topics: Selectable<DiscourseTopic>[] = [];
    if (topicExternalIds.length > 0) {
      topics = await db
        .selectFrom("discourseTopic")
        .selectAll()
        .where("externalId", "in", topicExternalIds)
        .execute();
    }

    // Ensure there are either proposals or topics available
    if (!proposals.length && !topics.length) {
      throw new Error("No proposals or topics found");
    }

    // Fetch the DAO and its discourse to get the start time
    let daoId: string | undefined;
    if (proposals.length > 0) {
      const dao = await db
        .selectFrom("dao")
        .selectAll()
        .where("id", "=", proposals[0].daoId)
        .executeTakeFirst();
      daoId = dao?.id;
    } else {
      const topicDaoDiscourseId = topics[0].daoDiscourseId;
      const topicDao = await db
        .selectFrom("daoDiscourse")
        .innerJoin("dao", "dao.id", "daoDiscourse.daoId")
        .selectAll()
        .where("daoDiscourse.id", "=", topicDaoDiscourseId)
        .executeTakeFirst();
      daoId = topicDao?.daoId;
    }

    if (!daoId) {
      throw new Error("DAO not found");
    }

    // Determine the start time as the earliest creation time among proposals and topics
    const proposalStartTimes = proposals.map((proposal) =>
      proposal.timeStart.getTime(),
    );
    const topicStartTimes = topics.map((topic) => topic.createdAt.getTime());

    const proposalEndTimes = proposals.map((proposal) =>
      proposal.timeEnd.getTime(),
    );
    const topicEndTimes = topics.map((topic) => topic.lastPostedAt.getTime());

    const startTime = new Date(
      Math.min(...proposalStartTimes, ...topicStartTimes),
    );

    const endTime = new Date(Math.max(...proposalEndTimes, ...topicEndTimes));

    // Fetch the closest voting power record to the start time
    const initialVotingPowerRecord = await db
      .selectFrom("votingPower")
      .selectAll()
      .where("voter", "=", vote.voterAddress)
      .where("daoId", "=", daoId)
      .where("timestamp", "<=", startTime)
      .orderBy("timestamp", "desc")
      .limit(1)
      .executeTakeFirst();

    initialVotingPowerRecord?.timestamp;

    // Fetch the closest voting power record to the end time
    const finalVotingPowerRecord = await db
      .selectFrom("votingPower")
      .selectAll()
      .where("voter", "=", vote.voterAddress)
      .where("daoId", "=", daoId)
      .where("timestamp", "<=", endTime)
      .orderBy("timestamp", "desc")
      .limit(1)
      .executeTakeFirst();

    const initialVotingPower = initialVotingPowerRecord?.votingPower ?? 0;
    const finalVotingPower = finalVotingPowerRecord?.votingPower ?? 0;

    const initialVotingPowerTime = new Date(
      initialVotingPowerRecord?.timestamp ?? 0,
    );
    const finalVotingPowerTime = new Date(
      finalVotingPowerRecord?.timestamp ?? 0,
    );

    let change: number | null = null;
    if (initialVotingPower !== finalVotingPower) {
      change =
        ((finalVotingPower - initialVotingPower) / initialVotingPower) * 100;
    }

    return {
      startTime: initialVotingPowerTime,
      endTime: finalVotingPowerTime,
      initialVotingPower,
      finalVotingPower,
      change,
    };
  } catch (error) {
    console.error("Error fetching voting power:", error);
    throw error; // Re-throw the error after logging
  }
}

export async function getDelegate(
  voterAddress: string,
  daoSlug: string,
  topicExternalIds: number[],
  proposalIds?: string[],
) {
  const dao = await db
    .selectFrom("dao")
    .where("slug", "=", daoSlug)
    .selectAll()
    .executeTakeFirst();

  if (!dao) return null;

  const voter = await db
    .selectFrom("voter")
    .where("address", "=", voterAddress)
    .selectAll()
    .executeTakeFirst();

  if (!voter) return null;

  // Fetch the timestamps from proposals and topics
  let proposalStartTimes: number[] = [];
  let proposalEndTimes: number[] = [];

  if (proposalIds && proposalIds.length > 0) {
    const proposals = await db
      .selectFrom("proposal")
      .selectAll()
      .where("id", "in", proposalIds)
      .execute();

    proposalStartTimes = proposals.map((proposal) =>
      proposal.timeStart.getTime(),
    );
    proposalEndTimes = proposals.map((proposal) => proposal.timeEnd.getTime());
  }

  let topicStartTimes: number[] = [];
  let topicEndTimes: number[] = [];

  if (topicExternalIds.length > 0) {
    const topics = await db
      .selectFrom("discourseTopic")
      .selectAll()
      .where("externalId", "in", topicExternalIds)
      .execute();

    topicStartTimes = topics.map((topic) => topic.createdAt.getTime());
    topicEndTimes = topics.map((topic) => topic.lastPostedAt.getTime());
  }

  // Determine the start and end times based on proposals and topics
  const startTime = new Date(
    Math.min(...proposalStartTimes, ...topicStartTimes),
  );

  const endTime = new Date(Math.max(...proposalEndTimes, ...topicEndTimes));

  // Fetch the delegate data
  const delegateData = await db
    .selectFrom("delegate")
    .innerJoin("delegateToVoter", "delegate.id", "delegateToVoter.delegateId")
    .where("delegateToVoter.voterId", "=", voter.id)
    .where("delegate.daoId", "=", dao.id)
    .select("delegate.id")
    .executeTakeFirst();

  if (!delegateData) return null;

  // Fetch the DelegateToDiscourseUser data
  const delegateToDiscourseUserData = await db
    .selectFrom("delegateToDiscourseUser")
    .where("delegateId", "=", delegateData.id)
    .leftJoin(
      "discourseUser",
      "discourseUser.id",
      "delegateToDiscourseUser.discourseUserId",
    )
    .where("periodStart", "<=", startTime)
    .where("periodEnd", ">=", endTime)
    .selectAll()
    .executeTakeFirst();

  // Fetch the DelegateToVoter data
  const delegateToVoterData = await db
    .selectFrom("delegateToVoter")
    .where("delegateId", "=", delegateData.id)
    .leftJoin("voter", "voter.id", "delegateToVoter.voterId")
    .where("periodStart", "<=", startTime)
    .where("periodEnd", ">=", endTime)
    .selectAll()
    .executeTakeFirst();

  // Combine the results into a single object
  const result = {
    delegate: delegateData,
    delegatetodiscourseuser: delegateToDiscourseUserData,
    delegatetovoter: delegateToVoterData,
  };

  return result;
}

export type VotingPowerChangeType = AsyncReturnType<typeof getVotingPower>;
export type FeedDataType = AsyncReturnType<typeof getFeedForGroup>;
