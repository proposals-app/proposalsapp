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
  content: string;
  volume: number;
  volumeType: 'comments';
}

interface VotesVolumeEvent extends BaseEvent {
  type: TimelineEventType.VotesVolume;
  content: string;
  volume: number;
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

// const MIN_TIME_BETWEEN_EVENTS = 1000 * 60 * 60 * 24; // 1 day in milliseconds

// const MAX_HEIGHT = 800;
// const EVENT_HEIGHT_UNITS = {
//   [TimelineEventType.Basic]: 40,
//   [TimelineEventType.ResultEndedBasicVote]: 136,
//   [TimelineEventType.ResultEndedOtherVotes]: 88,
//   [TimelineEventType.ResultOngoingBasicVote]: 136,
//   [TimelineEventType.ResultOngoingOtherVotes]: 88,
//   [TimelineEventType.CommentsVolume]: 4,
//   [TimelineEventType.VotesVolume]: 4,
//   [TimelineEventType.Gap]: 20,
// } as const;

// Helper function to aggregate volume events
// function aggregateVolumeEvents(
//   events: Event[],
//   type: TimelineEventType.CommentsVolume | TimelineEventType.VotesVolume,
//   timeWindow: number
// ): Event[] {
//   const volumeEvents = events.filter((e) => e.type === type) as
//     | CommentsVolumeEvent[]
//     | VotesVolumeEvent[];

//   if (volumeEvents.length <= 1) return volumeEvents;

//   const aggregatedEvents: Event[] = [];
//   let currentWindow: (CommentsVolumeEvent | VotesVolumeEvent)[] = [];
//   let windowStart = volumeEvents[0].timestamp;

//   const createAggregatedEvent = (
//     windowEvents: (CommentsVolumeEvent | VotesVolumeEvent)[],
//     lastTimestamp: Date
//   ): CommentsVolumeEvent | VotesVolumeEvent => {
//     const totalVolume = windowEvents.reduce((sum, e) => sum + e.volume, 0);
//     const isComments = type === TimelineEventType.CommentsVolume;

//     if (isComments) {
//       return {
//         type: TimelineEventType.CommentsVolume,
//         timestamp: lastTimestamp,
//         content: `${windowEvents.length} comments in this period`,
//         volume: totalVolume / windowEvents.length,
//         volumeType: 'comments',
//       };
//     } else {
//       const totalVotingPower = windowEvents.reduce(
//         (sum, e) => sum + (e.metadata?.votingPower || 0),
//         0
//       );

//       return {
//         type: TimelineEventType.VotesVolume,
//         timestamp: lastTimestamp,
//         content: `${windowEvents.length} votes in this period`,
//         volume: totalVolume / windowEvents.length,
//         volumeType: 'votes',
//         metadata: {
//           votingPower: totalVotingPower,
//         },
//       };
//     }
//   };

//   volumeEvents.forEach((event) => {
//     if (event.timestamp.getTime() - windowStart.getTime() <= timeWindow) {
//       currentWindow.push(event);
//     } else {
//       if (currentWindow.length > 0) {
//         const lastTimestamp = currentWindow[currentWindow.length - 1].timestamp;
//         aggregatedEvents.push(
//           createAggregatedEvent(currentWindow, lastTimestamp)
//         );
//       }
//       currentWindow = [event];
//       windowStart = event.timestamp;
//     }
//   });

//   if (currentWindow.length > 0) {
//     const lastTimestamp = currentWindow[currentWindow.length - 1].timestamp;
//     aggregatedEvents.push(createAggregatedEvent(currentWindow, lastTimestamp));
//   }

//   return aggregatedEvents;
// }

// Helper function to calculate total height units
// function calculateTotalHeightUnits(events: Event[]): number {
//   return events.reduce((sum, event) => sum + EVENT_HEIGHT_UNITS[event.type], 0);
// }

// Helper function to add gap events
// function addGapEvents(events: Event[], totalTimeSpan: number): Event[] {
//   const dynamicMinGapDays = (totalTimeSpan / (1000 * 60 * 60 * 24)) * 0.1;

//   return events.reduce<Event[]>((acc, event, index) => {
//     acc.push(event);

//     const nextEvent = events[index + 1];
//     if (nextEvent) {
//       const timeDiff =
//         event.timestamp.getTime() - nextEvent.timestamp.getTime();
//       const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

//       if (daysDiff > dynamicMinGapDays) {
//         acc.push({
//           type: TimelineEventType.Gap,
//           timestamp: new Date(nextEvent.timestamp.getTime() + timeDiff / 2),
//           content: `${Math.floor(daysDiff)} days`,
//           gapSize: Math.min(daysDiff * 2, 10),
//         });
//       }
//     }

//     return acc;
//   }, []);
// }

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
    events.unshift({
      content: `${totalComments} comments and ${totalVotes} votes`,
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
async function getEvents(group: GroupReturnType): Promise<Event[]> {
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
              sql<number>`SUM("voting_power")`.as('totalVotingPower'),
              sql<Date>`MAX("created_at")`.as('lastVoteTime'),
            ])
            .where('proposalId', '=', proposal.id)
            .groupBy(sql`DATE_TRUNC('day', "created_at")`)
            .execute();

          const maxVotes = Math.max(
            ...dailyVotes.map((dv) => Number(dv.totalVotingPower))
          );

          dailyVotes.forEach((dailyVote) => {
            const timestamp = new Date(dailyVote.lastVoteTime);
            const normalizedVolume =
              Number(dailyVote.totalVotingPower) / maxVotes;
            events.push({
              content: `${Number(dailyVote.totalVotingPower).toFixed(2)} voting power on ${format(
                timestamp,
                'MMM d'
              )}`,
              type: TimelineEventType.VotesVolume,
              timestamp,
              volume: normalizedVolume,
              volumeType: 'votes',
              metadata: {
                votingPower: Number(dailyVote.totalVotingPower),
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
          const normalizedVolume = Number(dailyPost.count) / maxComments;
          events.push({
            content: `${dailyPost.count} post(s) on ${format(timestamp, 'MMM d')}`,
            type: TimelineEventType.CommentsVolume,
            timestamp,
            volume: normalizedVolume,
            volumeType: 'comments',
          });
        });
      }
    }

    // Sort events by timestamp in descending order
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // // Aggregate events if necessary
    // const totalHeightUnits = calculateTotalHeightUnits(events);

    // const maxHeightUnits = MAX_HEIGHT;

    // if (totalHeightUnits > maxHeightUnits) {
    //   const commentEvents = aggregateVolumeEvents(
    //     events,
    //     TimelineEventType.CommentsVolume,
    //     MIN_TIME_BETWEEN_EVENTS
    //   );
    //   const voteEvents = aggregateVolumeEvents(
    //     events,
    //     TimelineEventType.VotesVolume,
    //     MIN_TIME_BETWEEN_EVENTS
    //   );

    //   const importantEvents = events.filter(
    //     (e) =>
    //       e.type === TimelineEventType.Basic ||
    //       e.type === TimelineEventType.ResultOngoingBasicVote ||
    //       e.type === TimelineEventType.ResultOngoingOtherVotes ||
    //       e.type === TimelineEventType.ResultEndedBasicVote ||
    //       e.type === TimelineEventType.ResultEndedOtherVotes
    //   );

    //   events = [...importantEvents, ...commentEvents, ...voteEvents].sort(
    //     (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    //   );

    //   while (calculateTotalHeightUnits(events) > maxHeightUnits) {
    //     const volumeEventIndex = events.findIndex(
    //       (e) =>
    //         e.type === TimelineEventType.CommentsVolume ||
    //         e.type === TimelineEventType.VotesVolume
    //     );
    //     if (volumeEventIndex === -1) break;
    //     events.splice(volumeEventIndex, 1);
    //   }
    // }

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

    // Add gap events
    // const firstEventTimestamp = events[0].timestamp.getTime();
    // const lastEventTimestamp = events[events.length - 1].timestamp.getTime();
    // const totalTimeSpan = firstEventTimestamp - lastEventTimestamp;
    // let eventsWithGaps = addGapEvents(events, totalTimeSpan);

    // Add summary event if necessary
    const finalEvents = addSummaryEvent(events, totalComments, totalVotes);

    return finalEvents;
  });
}

export const getEvents_cached = superjson_cache(
  async (group: GroupReturnType) => {
    return await getEvents(group);
  },
  ['get-events'],
  { revalidate: 60 * 5, tags: ['get-events'] }
);
