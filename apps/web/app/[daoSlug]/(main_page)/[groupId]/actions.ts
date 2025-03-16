import { FeedFilterEnum, VotesFilterEnum } from '@/app/searchParams';

import {
  ProcessedResults,
  ProcessedVote,
  processResultsAction,
} from '@/lib/results_processing';
import { ProposalGroupItem } from '@/lib/types';
import { AsyncReturnType, formatNumberWithSuffix } from '@/lib/utils';
import {
  db,
  DiscoursePost,
  DiscourseTopic,
  Proposal,
  ProposalGroup,
  Selectable,
  Vote,
} from '@proposalsapp/db-indexer';
import { validate } from 'uuid';
import { getDelegateByDiscourseUser } from './components/feed/actions';
import { format } from 'date-fns-tz';
import { formatDistanceToNow } from 'date-fns';
import { ProposalMetadata } from '@/app/types';

export async function getGroup(daoSlug: string, groupId: string) {
  'use server';

  if (daoSlug == 'favicon.ico') return null;

  // Fetch the DAO based on the slug
  const dao = await db
    .selectFrom('dao')
    .where('slug', '=', daoSlug)
    .selectAll()
    .executeTakeFirst();

  if (!dao) {
    return null;
  }

  let group: Selectable<ProposalGroup> | null = null;

  // Check if proposalOrGroupId is a UUIDv4
  if (validate(groupId)) {
    try {
      // Fetch the group based on ID
      group =
        (await db
          .selectFrom('proposalGroup')
          .where('id', '=', groupId)
          .selectAll()
          .executeTakeFirst()) ?? null;
    } catch (error) {
      console.error('Error fetching group:', error);
    }
  }

  if (group) {
    const items = group.items as ProposalGroupItem[];

    const proposalItems = items.filter((item) => item.type === 'proposal');
    const topicItems = items.filter((item) => item.type === 'topic');

    const proposals: Selectable<Proposal>[] = [];
    if (proposalItems.length > 0) {
      for (const proposalItem of proposalItems) {
        try {
          const p = await db
            .selectFrom('proposal')
            .selectAll()
            .where('externalId', '=', proposalItem.externalId)
            .where('governorId', '=', proposalItem.governorId)
            .executeTakeFirstOrThrow();

          proposals.push(p);
        } catch (error) {
          console.error('Error fetching:', proposalItem, error);
        }
      }
    }

    const topics: Selectable<DiscourseTopic>[] = [];
    if (topicItems.length > 0) {
      for (const topicItem of topicItems) {
        try {
          const t = await db
            .selectFrom('discourseTopic')
            .where('externalId', '=', parseInt(topicItem.externalId, 10))
            .where('daoDiscourseId', '=', topicItem.daoDiscourseId)
            .selectAll()
            .executeTakeFirstOrThrow();

          topics.push(t);
        } catch (error) {
          console.error('Error fetching:', topicItem, error);
        }
      }
    }

    return {
      dao,
      group,
      proposals,
      topics,
      daoSlug,
      groupId,
    };
  }
}

export type BodyVersionType = {
  title: string;
  content: string;
  author_name: string;
  author_picture: string;
  createdAt: Date;
  type: VersionType;
};

export type VersionType = 'topic' | 'onchain' | 'offchain';

export async function getBodyVersions(groupID: string, withContent: boolean) {
  'use server';

  const bodies: BodyVersionType[] = [];

  const group = await db
    .selectFrom('proposalGroup')
    .selectAll()
    .where('id', '=', groupID)
    .executeTakeFirstOrThrow();

  if (!group) {
    return null;
  }

  const items = group.items as ProposalGroupItem[];

  const proposalItems = items.filter((item) => item.type === 'proposal');
  const topicItems = items.filter((item) => item.type === 'topic');

  const proposals: Selectable<Proposal>[] = [];
  if (proposalItems.length > 0) {
    for (const proposalItem of proposalItems) {
      try {
        const p = await db
          .selectFrom('proposal')
          .selectAll()
          .where('externalId', '=', proposalItem.externalId)
          .where('governorId', '=', proposalItem.governorId)
          .executeTakeFirstOrThrow();

        proposals.push(p);
      } catch (error) {
        console.error('Error fetching:', proposalItem, error);
      }
    }
  }

  proposals.map((proposal) =>
    bodies.push({
      title: proposal.name,
      content: withContent ? proposal.body : '', // Conditionally include content
      author_name: proposal.author ?? 'Unknown',
      author_picture: `https://api.dicebear.com/9.x/pixel-art/png?seed=${proposal.author}`,
      createdAt: proposal.createdAt,
      type: proposal.blockCreatedAt ? 'onchain' : 'offchain',
    })
  );

  const discourseTopics: Selectable<DiscourseTopic>[] = [];
  if (topicItems.length > 0) {
    for (const topicItem of topicItems) {
      try {
        const t = await db
          .selectFrom('discourseTopic')
          .where('externalId', '=', parseInt(topicItem.externalId, 10))
          .where('daoDiscourseId', '=', topicItem.daoDiscourseId)
          .selectAll()
          .executeTakeFirstOrThrow();

        discourseTopics.push(t);
      } catch (error) {
        console.error('Error fetching:', topicItem, error);
      }
    }
  }

  for (const discourseTopic of discourseTopics) {
    const discourseFirstPost = await db
      .selectFrom('discoursePost')
      .where('discoursePost.topicId', '=', discourseTopic.externalId)
      .where('daoDiscourseId', '=', discourseTopic.daoDiscourseId)
      .where('discoursePost.postNumber', '=', 1)
      .selectAll()
      .executeTakeFirstOrThrow();

    const discourseFirstPostAuthor = await db
      .selectFrom('discourseUser')
      .where('discourseUser.externalId', '=', discourseFirstPost.userId)
      .where('daoDiscourseId', '=', discourseTopic.daoDiscourseId)
      .selectAll()
      .executeTakeFirstOrThrow();

    const discourseFirstPostRevisions = await db
      .selectFrom('discoursePostRevision')
      .where(
        'discoursePostRevision.discoursePostId',
        '=',
        discourseFirstPost.id
      )
      .selectAll()
      .execute();

    // If there are no revisions, use the post itself
    if (!discourseFirstPostRevisions.length)
      bodies.push({
        title: discourseTopic.title,
        content: withContent ? (discourseFirstPost.cooked ?? 'Unknown') : '', // Conditionally include content
        author_name:
          discourseFirstPostAuthor.name?.trim() ||
          discourseFirstPostAuthor.username ||
          'Unknown',
        author_picture: discourseFirstPostAuthor.avatarTemplate,
        createdAt: discourseFirstPost.createdAt,
        type: 'topic',
      });

    for (const discourseFirstPostRevision of discourseFirstPostRevisions) {
      // If there are revisions, the initial post is in fact the before of version 2
      if (discourseFirstPostRevision.version == 2)
        bodies.push({
          title:
            discourseFirstPostRevision.cookedTitleBefore ??
            discourseTopic.title,
          content: withContent
            ? (discourseFirstPostRevision.cookedBodyBefore ??
              discourseFirstPost.cooked ??
              'Unknown')
            : '', // Conditionally include content
          author_name:
            discourseFirstPostAuthor.name?.trim() ||
            discourseFirstPostAuthor.username ||
            'Unknown',
          author_picture: discourseFirstPostAuthor.avatarTemplate,
          createdAt: discourseFirstPost.createdAt,
          type: 'topic',
        });

      bodies.push({
        title:
          discourseFirstPostRevision.cookedTitleAfter ?? discourseTopic.title,
        content: withContent
          ? (discourseFirstPostRevision.cookedBodyAfter ??
            discourseFirstPost.cooked ??
            'Unknown')
          : '', // Conditionally include content
        author_name:
          discourseFirstPostAuthor.name?.trim() ||
          discourseFirstPostAuthor.username ||
          'Unknown',
        author_picture: discourseFirstPostAuthor.avatarTemplate,
        createdAt: discourseFirstPostRevision.createdAt,
        type: 'topic',
      });
    }
  }

  bodies.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return bodies;
}

enum TimelineEventType {
  ResultOngoingBasicVote = 'ResultOngoingBasicVote',
  ResultOngoingOtherVotes = 'ResultOngoingOtherVotes',
  ResultEndedBasicVote = 'ResultEndedBasicVote',
  ResultEndedOtherVotes = 'ResultEndedOtherVotes',
  Basic = 'Basic',
  CommentsVolume = 'CommentsVolume',
  VotesVolume = 'VotesVolume',
}

interface BaseEvent {
  type: TimelineEventType;
  timestamp: Date;
  metadata?: {
    votingPower?: number;
    commentCount?: number;
  };
}

interface BasicEvent extends BaseEvent {
  type: TimelineEventType.Basic;
  content: string;
  url: string;
}

interface CommentsVolumeEvent extends BaseEvent {
  type: TimelineEventType.CommentsVolume;
  volume: number;
  maxVolume: number;
  volumeType: 'comments';
}

interface VotesVolumeEvent extends BaseEvent {
  type: TimelineEventType.VotesVolume;
  volumes: number[];
  colors: string[];
  maxVolume: number;
  volumeType: 'votes';
  metadata: {
    votingPower: number;
  };
}

export interface VoteSegmentData {
  votingPower: number;
  tooltip: string;
  isAggregated?: boolean;
}

interface ResultEvent extends BaseEvent {
  type:
    | TimelineEventType.ResultOngoingBasicVote
    | TimelineEventType.ResultOngoingOtherVotes
    | TimelineEventType.ResultEndedBasicVote
    | TimelineEventType.ResultEndedOtherVotes;
  content: string;
  proposal: Selectable<Proposal>;
  result: Omit<ProcessedResults, 'votes' | 'timeSeriesData'> & {
    voteSegments: { [key: string]: VoteSegmentData[] };
  };
}

export type FeedEvent =
  | BasicEvent
  | CommentsVolumeEvent
  | VotesVolumeEvent
  | ResultEvent;

const MIN_VISIBLE_WIDTH_PERCENT = 1;

function calculateVoteSegments(processedResults: ProcessedResults): {
  [key: string]: VoteSegmentData[];
} {
  const { totalVotingPower, choices, votes } = processedResults;

  const sortedVotes =
    votes
      ?.filter((vote) => !vote.aggregate)
      .sort((a, b) => b.votingPower - a.votingPower) || [];

  const voteSegments: { [key: string]: VoteSegmentData[] } = {};
  const aggregatedVotes: { [key: number]: { count: number; power: number } } =
    {};

  // Initialize voteSegments and aggregatedVotes for each choice
  choices.forEach((_, index) => {
    voteSegments[index.toString()] = [];
    aggregatedVotes[index] = { count: 0, power: 0 };
  });

  // Process each vote and distribute its voting power according to the choices
  sortedVotes.forEach((vote) => {
    // Each vote can have multiple choices now
    vote.choice.forEach((choiceItem) => {
      const choiceIndex = choiceItem.choiceIndex;

      // Ensure the choice is a valid index in the choices array
      if (choiceIndex >= 0 && choiceIndex < choices.length) {
        // Calculate the proportional voting power based on the weight
        const proportionalVotingPower =
          (vote.votingPower * choiceItem.weight) / 100;
        const percentage = (proportionalVotingPower / totalVotingPower) * 100;

        if (percentage >= MIN_VISIBLE_WIDTH_PERCENT) {
          voteSegments[choiceIndex.toString()].push({
            votingPower: proportionalVotingPower,
            tooltip: `${formatNumberWithSuffix(proportionalVotingPower)} vote "${choices[choiceIndex]}"`,
          });
        } else {
          aggregatedVotes[choiceIndex].count += 1;
          aggregatedVotes[choiceIndex].power += proportionalVotingPower;
        }
      } else {
        console.warn(
          `Invalid choice index: ${choiceIndex}. Skipping this choice.`
        );
      }
    });
  });

  // Process aggregated votes
  Object.entries(aggregatedVotes).forEach(([choice, data]) => {
    if (data.power > 0) {
      voteSegments[choice].push({
        votingPower: data.power,
        tooltip: `${data.count} votes with ${formatNumberWithSuffix(
          data.power
        )} total voting power for "${choices[parseInt(choice)]}"`,
        isAggregated: true,
      });
    }
  });

  return voteSegments;
}

export async function getFeed(
  groupID: string,
  feedFilter: FeedFilterEnum,
  votesFilter: VotesFilterEnum
): Promise<{
  votes: ProcessedVote[];
  posts: Selectable<DiscoursePost>[];
  events: FeedEvent[];
}> {
  'use server';

  // Fetch the proposal group
  const group = await db
    .selectFrom('proposalGroup')
    .selectAll()
    .where('id', '=', groupID)
    .executeTakeFirstOrThrow();

  const dao = await db
    .selectFrom('dao')
    .selectAll()
    .where('dao.id', '=', group.daoId)
    .executeTakeFirstOrThrow();

  const daoDiscourse = await db
    .selectFrom('daoDiscourse')
    .selectAll()
    .where('daoId', '=', group.daoId)
    .executeTakeFirstOrThrow();

  if (!group) {
    return { votes: [], posts: [], events: [] };
  }

  let allPosts: Selectable<DiscoursePost>[] = [];
  let posts: Selectable<DiscoursePost>[] = [];

  const allVotes: Selectable<Vote>[] = [];
  const processedVotes: ProcessedVote[] = [];
  const filteredProcessedVotes: ProcessedVote[] = [];

  const events: FeedEvent[] = [];

  // Extract proposal and topic IDs from group items
  const items = group.items as ProposalGroupItem[];

  const proposalItems = items.filter((item) => item.type === 'proposal');
  const topicItems = items.filter((item) => item.type === 'topic');

  const proposals: Selectable<Proposal>[] = [];
  const topics: Selectable<DiscourseTopic>[] = [];

  if (proposalItems.length > 0) {
    for (const proposalItem of proposalItems) {
      try {
        const proposal = await db
          .selectFrom('proposal')
          .selectAll()
          .where('externalId', '=', proposalItem.externalId)
          .where('governorId', '=', proposalItem.governorId)
          .executeTakeFirstOrThrow();

        const allVotesForProposal = await db
          .selectFrom('vote')
          .selectAll()
          .where('proposalId', '=', proposal.id)
          .execute();

        const filteredVotesForTimeline = allVotesForProposal.filter((vote) => {
          if (votesFilter === VotesFilterEnum.FIFTY_THOUSAND) {
            return vote.votingPower > 50000;
          } else if (votesFilter === VotesFilterEnum.FIVE_HUNDRED_THOUSAND) {
            return vote.votingPower > 500000;
          } else if (votesFilter === VotesFilterEnum.FIVE_MILLION) {
            return vote.votingPower > 5000000;
          }
          return true;
        });

        proposals.push(proposal);
        allVotes.push(...allVotesForProposal);

        const filteredProcessedResults = await processResultsAction(
          proposal,
          filteredVotesForTimeline,
          {
            withVotes: true,
            withTimeseries: false,
            aggregatedVotes: true,
          }
        );

        if (filteredProcessedResults.votes)
          filteredProcessedVotes.push(...filteredProcessedResults.votes);

        const dailyFilteredVotesMap = new Map<
          string,
          {
            totalVotingPower: number;
            lastVoteTime: Date;
            choiceVotingPower: { [choice: number]: number };
          }
        >();

        filteredProcessedVotes.forEach((vote) => {
          // Get the date in locale format to use as key
          const date = vote.createdAt.toLocaleDateString();
          const votingPower = vote.votingPower;

          if (dailyFilteredVotesMap.has(date)) {
            const dailyData = dailyFilteredVotesMap.get(date)!;
            dailyData.totalVotingPower += votingPower;
            dailyData.lastVoteTime = vote.createdAt; // Update last vote time to the latest vote in the day

            // Add voting power to each choice based on weight
            vote.choice.forEach((choiceItem) => {
              const choiceIndex = choiceItem.choiceIndex;
              const proportionalVotingPower =
                (votingPower * choiceItem.weight) / 100;

              if (!dailyData.choiceVotingPower[choiceIndex]) {
                dailyData.choiceVotingPower[choiceIndex] = 0;
              }
              dailyData.choiceVotingPower[choiceIndex] +=
                proportionalVotingPower;
            });
          } else {
            // Initialize a new entry
            const choiceVotingPower: { [choice: number]: number } = {};

            // Initialize voting power for each choice
            vote.choice.forEach((choiceItem) => {
              const choiceIndex = choiceItem.choiceIndex;
              const proportionalVotingPower =
                (votingPower * choiceItem.weight) / 100;
              choiceVotingPower[choiceIndex] = proportionalVotingPower;
            });

            dailyFilteredVotesMap.set(date, {
              totalVotingPower: votingPower,
              lastVoteTime: vote.createdAt,
              choiceVotingPower,
            });
          }
        });

        const dailyFilteredVotes = Array.from(dailyFilteredVotesMap.values());

        const maxVotes = Math.max(
          ...dailyFilteredVotes.map((dv) => Number(dv.totalVotingPower)),
          0 // Ensure maxVotes is at least 0 if there are no votes
        );

        // Create volumes entry from the daily votes
        dailyFilteredVotes.forEach((dailyVote) => {
          const dailyVotingPower = Number(dailyVote.totalVotingPower);
          const timestamp = new Date(dailyVote.lastVoteTime);

          // Get choices from the proposal
          const choices = proposal.choices as string[];

          // Initialize volumes array with one element per choice, all set to 0
          const volumes: number[] = Array(choices.length).fill(0);
          const colors: string[] = [];

          // Fill the volumes array with voting power by choice
          Object.entries(dailyVote.choiceVotingPower).forEach(
            ([choiceIndex, votingPower]) => {
              const index = parseInt(choiceIndex);
              if (index >= 0 && index < volumes.length) {
                volumes[index] = votingPower;
              }
            }
          );

          colors.push(...filteredProcessedResults.choiceColors);

          events.push({
            type: TimelineEventType.VotesVolume,
            timestamp,
            volumes: volumes,
            colors: colors,
            maxVolume: maxVotes,
            volumeType: 'votes',
            metadata: {
              votingPower: dailyVotingPower,
            },
          });
        });
        const startedAt = new Date(proposal.startAt);
        const endedAt = new Date(proposal.endAt);

        const daoGovernor = await db
          .selectFrom('daoGovernor')
          .selectAll()
          .where('id', '=', proposal.governorId)
          .executeTakeFirstOrThrow();

        const offchain = daoGovernor.type.includes('SNAPSHOT');

        const currentTimestamp = new Date();

        events.push({
          content: `${offchain ? 'Offchain' : 'Onchain'} vote ${currentTimestamp > startedAt ? 'started' : 'starts'} on ${format(
            startedAt,
            'MMM d'
          )}`,
          type: TimelineEventType.Basic,
          timestamp: startedAt,
          url: proposal.url,
        });

        if (currentTimestamp >= startedAt) {
          const processedResults = await processResultsAction(
            proposal,
            allVotesForProposal,
            {
              withVotes: true,
              withTimeseries: false,
              aggregatedVotes: true,
            }
          );

          if (
            processedResults.votes &&
            (feedFilter == FeedFilterEnum.COMMENTS_AND_VOTES ||
              feedFilter == FeedFilterEnum.VOTES)
          ) {
            processedVotes.push(
              ...processedResults.votes.filter((vote) => {
                if (votesFilter === VotesFilterEnum.FIFTY_THOUSAND) {
                  return vote.votingPower > 50000;
                } else if (
                  votesFilter === VotesFilterEnum.FIVE_HUNDRED_THOUSAND
                ) {
                  return vote.votingPower > 500000;
                } else if (votesFilter === VotesFilterEnum.FIVE_MILLION) {
                  return vote.votingPower > 5000000;
                }
                return true;
              })
            );
          }

          const voteSegments = calculateVoteSegments(processedResults);

          const metadata =
            typeof proposal.metadata === 'string'
              ? (JSON.parse(proposal.metadata) as ProposalMetadata)
              : (proposal.metadata as ProposalMetadata);

          const voteType = metadata?.voteType;

          if (currentTimestamp > endedAt) {
            events.push({
              content: `${offchain ? 'Offchain' : 'Onchain'} vote ended ${formatDistanceToNow(
                endedAt,
                { addSuffix: true }
              )}`,
              type:
                voteType === 'basic'
                  ? TimelineEventType.ResultEndedBasicVote
                  : TimelineEventType.ResultEndedOtherVotes,
              timestamp: endedAt,
              result: { ...processedResults, voteSegments },
              proposal,
            });
          } else {
            events.push({
              content: `${offchain ? 'Offchain' : 'Onchain'} vote ends ${formatDistanceToNow(
                endedAt,
                { addSuffix: true }
              )}`,
              type:
                voteType === 'basic'
                  ? TimelineEventType.ResultOngoingBasicVote
                  : TimelineEventType.ResultOngoingOtherVotes,
              timestamp: endedAt,
              result: { ...processedResults, voteSegments },
              proposal,
            });
          }
        }
      } catch (error) {
        console.error('Error fetching:', proposalItem, error);
      }
    }
  }

  if (topicItems.length > 0) {
    for (const topicItem of topicItems) {
      try {
        const t = await db
          .selectFrom('discourseTopic')
          .where('externalId', '=', parseInt(topicItem.externalId, 10))
          .where('daoDiscourseId', '=', topicItem.daoDiscourseId)
          .selectAll()
          .executeTakeFirstOrThrow();

        topics.push(t);
      } catch (error) {
        console.error('Error fetching:', topicItem, error);
      }
    }
  }

  const createdAt = new Date(topics[0].createdAt);
  events.push({
    content: `Proposal initially posted on ${format(createdAt, 'MMM d')}`,
    type: TimelineEventType.Basic,
    timestamp: createdAt,
    url: `${daoDiscourse.discourseBaseUrl}/t/${topics[0].externalId}`,
  });

  if (topics.length > 0) {
    allPosts = await db
      .selectFrom('discoursePost')
      .where(
        'topicId',
        'in',
        topics.map((t) => t.externalId)
      )
      .where('daoDiscourseId', '=', daoDiscourse.id)
      .where('postNumber', '!=', 1)
      .selectAll()
      .orderBy('createdAt', 'desc')
      .execute();

    const filteredPosts = await Promise.all(
      allPosts.map(async (post) => {
        const delegate = await getDelegateByDiscourseUser(
          post.userId,
          dao.slug,
          false,
          topics.map((t) => t.id.toString()),
          proposals.map((p) => p.id)
        );

        const authorVotingPower =
          delegate?.delegatetovoter?.latestVotingPower?.votingPower || 0;

        if (votesFilter === VotesFilterEnum.ALL) {
          return post;
        } else if (
          votesFilter === VotesFilterEnum.FIFTY_THOUSAND &&
          authorVotingPower > 50000
        ) {
          return post;
        } else if (
          votesFilter === VotesFilterEnum.FIVE_HUNDRED_THOUSAND &&
          authorVotingPower > 500000
        ) {
          return post;
        } else if (
          votesFilter === VotesFilterEnum.FIVE_MILLION &&
          authorVotingPower > 5000000
        ) {
          return post;
        }
        return null;
      })
    );

    if (
      feedFilter == FeedFilterEnum.COMMENTS_AND_VOTES ||
      feedFilter == FeedFilterEnum.COMMENTS
    )
      posts = filteredPosts.filter(Boolean) as Selectable<DiscoursePost>[];

    const dailyPostsMap = new Map<
      string,
      { count: number; lastPostTime: Date }
    >();
    posts.forEach((post) => {
      // Get the date in locale format (e.g., "MM/DD/YYYY" or "DD/MM/YYYY") to use as key
      const date = post.createdAt.toLocaleDateString();

      if (dailyPostsMap.has(date)) {
        const dailyData = dailyPostsMap.get(date)!;
        dailyData.count += 1;
        dailyData.lastPostTime = post.createdAt; // Update last post time to the latest post in the day
      } else {
        dailyPostsMap.set(date, {
          count: 1,
          lastPostTime: post.createdAt,
        });
      }
    });
    const dailyPosts = Array.from(dailyPostsMap.values());

    const maxComments = Math.max(
      ...dailyPosts.map((dp) => Number(dp.count)),
      0 // Ensure maxComments is at least 0 if there are no posts
    );

    dailyPosts.forEach((dailyPost) => {
      const timestamp = new Date(dailyPost.lastPostTime);
      events.push({
        type: TimelineEventType.CommentsVolume,
        timestamp,
        volume: Number(dailyPost.count),
        maxVolume: maxComments,
        volumeType: 'comments',
      });
    });
  }

  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  if (
    events[0] &&
    (events[0].type === TimelineEventType.CommentsVolume ||
      events[0].type === TimelineEventType.VotesVolume)
  ) {
    const currentTimestamp = new Date();
    let summaryContent = '';
    if (allPosts.length > 0 && allVotes.length > 0) {
      summaryContent = `${allPosts.length} comments and ${allVotes.length} votes`;
    } else if (allPosts.length > 0) {
      summaryContent = `${allPosts.length} comments`;
    } else if (allVotes.length > 0) {
      summaryContent = `${allVotes.length} votes`;
    } else {
      summaryContent = 'No activity';
    }
    events.unshift({
      content: summaryContent,
      type: TimelineEventType.Basic,
      timestamp: currentTimestamp,
      url: '',
    });
  }

  return {
    votes: processedVotes,
    posts,
    events,
  };
}

export type GroupReturnType = AsyncReturnType<typeof getGroup>;
export type BodyVersionsReturnType = AsyncReturnType<typeof getBodyVersions>;
export type FeedReturnType = AsyncReturnType<typeof getFeed>;
