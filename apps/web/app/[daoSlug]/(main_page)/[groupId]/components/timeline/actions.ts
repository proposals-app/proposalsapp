'use server';

import { otel } from '@/lib/otel';
import { db, Proposal, Selectable, sql } from '@proposalsapp/db-indexer';
import { format, formatDistanceToNow } from 'date-fns';
import { GroupReturnType } from '../../actions';
import { ProposalMetadata } from '@/app/types';
import {
  ProcessedResults,
  processResultsAction,
} from '@/lib/results_processing';
import { formatNumberWithSuffix, superjson_cache } from '@/lib/utils';
import { FeedFilterEnum, VotesFilterEnum } from '@/app/searchParams';

enum TimelineEventType {
  ResultOngoingBasicVote = 'ResultOngoingBasicVote',
  ResultOngoingOtherVotes = 'ResultOngoingOtherVotes',
  ResultEndedBasicVote = 'ResultEndedBasicVote',
  ResultEndedOtherVotes = 'ResultEndedOtherVotes',
  Basic = 'Basic',
  CommentsVolume = 'CommentsVolume',
  VotesVolume = 'VotesVolume',
  Gap = 'Gap',
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
  volume: number;
  maxVolume: number;
  volumeType: 'votes';
  metadata: {
    votingPower: number;
  };
}

interface GapEvent extends BaseEvent {
  type: TimelineEventType.Gap;
  content: string;
  gapSize: number;
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

export type Event =
  | BasicEvent
  | CommentsVolumeEvent
  | VotesVolumeEvent
  | GapEvent
  | ResultEvent;

// Helper function to add summary event
function addSummaryEvent(
  events: Event[],
  totalComments: number,
  totalVotes: number
): Event[] {
  const lastEvent = events[0];
  if (
    lastEvent &&
    (lastEvent.type === TimelineEventType.CommentsVolume ||
      lastEvent.type === TimelineEventType.VotesVolume)
  ) {
    const currentTimestamp = new Date();
    let summaryContent = '';
    if (totalComments > 0 && totalVotes > 0) {
      summaryContent = `${totalComments} comments and ${totalVotes} votes`;
    } else if (totalComments > 0) {
      summaryContent = `${totalComments} comments`;
    } else if (totalVotes > 0) {
      summaryContent = `${totalVotes} votes`;
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
  return events;
}

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

  choices.forEach((_, index) => {
    voteSegments[index.toString()] = [];
    aggregatedVotes[index] = { count: 0, power: 0 };
  });

  sortedVotes.forEach((vote) => {
    const choice = vote.choice as number;

    // Ensure the choice is a valid index in the choices array
    if (choice >= 0 && choice < choices.length) {
      const percentage = (vote.votingPower / totalVotingPower) * 100;

      if (percentage >= MIN_VISIBLE_WIDTH_PERCENT) {
        voteSegments[choice.toString()].push({
          votingPower: vote.votingPower,
          tooltip: `${formatNumberWithSuffix(vote.votingPower)} vote "${
            choices[choice]
          }"`,
        });
      } else {
        aggregatedVotes[choice].count += 1;
        aggregatedVotes[choice].power += vote.votingPower;
      }
    } else {
      console.warn(`Invalid choice index: ${choice}. Skipping this vote.`);
    }
  });

  Object.entries(aggregatedVotes).forEach(([choice, data]) => {
    if (data.power > 0) {
      voteSegments[choice.toString()].push({
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

// Main function to extract events
async function getEvents(
  group: GroupReturnType,
  feedFilter: FeedFilterEnum,
  votesFilter: VotesFilterEnum
): Promise<Event[]> {
  return otel('get-events', async () => {
    if (!group) return [];

    const events: Event[] = [];

    // Add initial proposal post event
    if (group.topics && group.topics.length > 0) {
      const discourse = await db
        .selectFrom('daoDiscourse')
        .where('daoDiscourse.id', '=', group.topics[0].daoDiscourseId)
        .selectAll()
        .executeTakeFirstOrThrow();

      const createdAt = new Date(group.topics[0].createdAt);
      events.push({
        content: `Proposal initially posted on ${format(createdAt, 'MMM d')}`,
        type: TimelineEventType.Basic,
        timestamp: createdAt,
        url: `${discourse.discourseBaseUrl}/t/${group.topics[0].externalId}`,
      });
    }

    // Add proposal and vote events
    if (group.proposals && group.proposals.length > 0) {
      for (const proposal of group.proposals) {
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

        // Fetch votes only if the vote has started
        if (currentTimestamp >= startedAt) {
          const votes = await db
            .selectFrom('vote')
            .selectAll()
            .where('proposalId', '=', proposal.id)
            .execute();

          const processedResults = await processResultsAction(proposal, votes, {
            withVotes: true,
            withTimeseries: false,
            aggregatedVotes: false,
          });

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

          const dailyVotes = await db
            .selectFrom('vote')
            .select([
              sql<Date>`DATE_TRUNC('day', "created_at")`.as('date'),
              sql<number>`COALESCE(SUM(CASE WHEN "voting_power" > ${
                votesFilter === VotesFilterEnum.FIFTY_THOUSAND
                  ? 50000
                  : votesFilter === VotesFilterEnum.FIVE_HUNDRED_THOUSAND
                    ? 500000
                    : votesFilter === VotesFilterEnum.FIVE_MILLION
                      ? 5000000
                      : 0
              } OR ${votesFilter === VotesFilterEnum.ALL} THEN "voting_power" ELSE 0 END), 0)`.as(
                'totalVotingPower'
              ),
              sql<Date>`MAX("created_at")`.as('lastVoteTime'),
            ])
            .where('proposalId', '=', proposal.id)
            .groupBy(sql`DATE_TRUNC('day', "created_at")`)
            .execute();

          const maxVotes = Math.max(
            ...dailyVotes.map((dv) => Number(dv.totalVotingPower))
          );

          dailyVotes.forEach((dailyVote) => {
            const dailyVotingPower = Number(dailyVote.totalVotingPower);

            const timestamp = new Date(dailyVote.lastVoteTime);
            events.push({
              type: TimelineEventType.VotesVolume,
              timestamp,
              volume: dailyVotingPower,
              maxVolume: maxVotes,
              volumeType: 'votes',
              metadata: {
                votingPower: dailyVotingPower,
              },
            });
          });
        }
      }
    }

    // Add comment events
    if (group.topics && group.topics.length > 0) {
      for (const topic of group.topics) {
        const dailyPosts = await db
          .selectFrom('discoursePost')
          .select([
            sql<Date>`DATE_TRUNC('day', "created_at")`.as('date'),
            sql<number>`COUNT(id)`.as('count'),
            sql<Date>`MAX("created_at")`.as('lastPostTime'),
          ])
          .where('postNumber', '!=', 1)
          .where('topicId', '=', topic.externalId)
          .groupBy(sql`DATE_TRUNC('day', "created_at")`)
          .execute();

        const maxComments = Math.max(
          ...dailyPosts.map((dp) => Number(dp.count))
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
    }

    // Sort events by timestamp in descending order
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Calculate total comments and votes
    let totalComments = 0;
    let totalVotes = 0;

    if (group.topics && group.topics.length > 0) {
      for (const topic of group.topics) {
        const commentsCount = await db
          .selectFrom('discoursePost')
          .select([sql<number>`COUNT(id)`.as('count')])
          .where('postNumber', '!=', 1)
          .where('topicId', '=', topic.externalId)
          .executeTakeFirstOrThrow();

        totalComments += Number(commentsCount.count);
      }
    }

    if (group.proposals && group.proposals.length > 0) {
      for (const proposal of group.proposals) {
        const votesCount = await db
          .selectFrom('vote')
          .select([sql<number>`COUNT(id)`.as('count')])
          .where('proposalId', '=', proposal.id)
          .executeTakeFirstOrThrow();

        totalVotes += Number(votesCount.count);
      }
    }

    // Add summary event if necessary
    const finalEvents = addSummaryEvent(events, totalComments, totalVotes);

    return finalEvents;
  });
}

export const getEvents_cached = superjson_cache(
  async (
    group: GroupReturnType,
    feedFilter: FeedFilterEnum,
    votesFilter: VotesFilterEnum
  ) => {
    return await getEvents(group, feedFilter, votesFilter);
  },
  ['get-events'],
  { revalidate: 60 * 5, tags: ['get-events'] }
);
