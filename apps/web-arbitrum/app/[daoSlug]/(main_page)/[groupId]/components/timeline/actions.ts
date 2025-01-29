import { otel } from '@/lib/otel';
import { db, IndexerVariant, Selectable, sql, Vote } from '@proposalsapp/db';
import { format, formatDistanceToNow } from 'date-fns';
import { GroupReturnType } from '../../actions';
import { ProposalMetadata, ProposalWithMetadata } from '@/app/types';

export type VoteType =
  | 'single-choice'
  | 'weighted'
  | 'approval'
  | 'basic'
  | 'quadratic'
  | 'ranked-choice';

export enum TimelineEventType {
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

interface ResultEvent extends BaseEvent {
  type:
    | TimelineEventType.ResultOngoingBasicVote
    | TimelineEventType.ResultOngoingOtherVotes
    | TimelineEventType.ResultEndedBasicVote
    | TimelineEventType.ResultEndedOtherVotes;
  content: string;
  proposal: ProposalWithMetadata;
  votes: Selectable<Vote>[];
}

type Event =
  | BasicEvent
  | CommentsVolumeEvent
  | VotesVolumeEvent
  | GapEvent
  | ResultEvent;

const MAX_EVENTS = 20;
const MIN_TIME_BETWEEN_EVENTS = 1000 * 60 * 60 * 24; // 1 day in milliseconds

const MAX_HEIGHT = 800;
const EVENT_HEIGHT_UNITS = {
  [TimelineEventType.Basic]: 32,
  [TimelineEventType.ResultEndedBasicVote]: 118,
  [TimelineEventType.ResultEndedOtherVotes]: 94,
  [TimelineEventType.ResultOngoingBasicVote]: 120,
  [TimelineEventType.ResultOngoingOtherVotes]: 95,
  [TimelineEventType.CommentsVolume]: 3,
  [TimelineEventType.VotesVolume]: 3,
  [TimelineEventType.Gap]: 20,
} as const;

// Helper function to aggregate volume events
function aggregateVolumeEvents(
  events: Event[],
  type: TimelineEventType.CommentsVolume | TimelineEventType.VotesVolume,
  timeWindow: number
): Event[] {
  const volumeEvents = events.filter((e) => e.type === type) as
    | CommentsVolumeEvent[]
    | VotesVolumeEvent[];

  if (volumeEvents.length <= 1) return volumeEvents;

  const aggregatedEvents: Event[] = [];
  let currentWindow: (CommentsVolumeEvent | VotesVolumeEvent)[] = [];
  let windowStart = volumeEvents[0].timestamp;

  const createAggregatedEvent = (
    windowEvents: (CommentsVolumeEvent | VotesVolumeEvent)[],
    lastTimestamp: Date
  ): CommentsVolumeEvent | VotesVolumeEvent => {
    const totalVolume = windowEvents.reduce((sum, e) => sum + e.volume, 0);
    const isComments = type === TimelineEventType.CommentsVolume;

    if (isComments) {
      return {
        type: TimelineEventType.CommentsVolume,
        timestamp: lastTimestamp,
        content: `${windowEvents.length} comments in this period`,
        volume: totalVolume / windowEvents.length,
        volumeType: 'comments',
      };
    } else {
      const totalVotingPower = windowEvents.reduce(
        (sum, e) => sum + (e.metadata?.votingPower || 0),
        0
      );

      return {
        type: TimelineEventType.VotesVolume,
        timestamp: lastTimestamp,
        content: `${windowEvents.length} votes in this period`,
        volume: totalVolume / windowEvents.length,
        volumeType: 'votes',
        metadata: {
          votingPower: totalVotingPower,
        },
      };
    }
  };

  volumeEvents.forEach((event) => {
    if (event.timestamp.getTime() - windowStart.getTime() <= timeWindow) {
      currentWindow.push(event);
    } else {
      if (currentWindow.length > 0) {
        const lastTimestamp = currentWindow[currentWindow.length - 1].timestamp;
        aggregatedEvents.push(
          createAggregatedEvent(currentWindow, lastTimestamp)
        );
      }
      currentWindow = [event];
      windowStart = event.timestamp;
    }
  });

  if (currentWindow.length > 0) {
    const lastTimestamp = currentWindow[currentWindow.length - 1].timestamp;
    aggregatedEvents.push(createAggregatedEvent(currentWindow, lastTimestamp));
  }

  return aggregatedEvents;
}

// Helper function to calculate total height units
function calculateTotalHeightUnits(events: Event[]): number {
  return events.reduce((sum, event) => sum + EVENT_HEIGHT_UNITS[event.type], 0);
}

// Helper function to add gap events
function addGapEvents(events: Event[], totalTimeSpan: number): Event[] {
  const dynamicMinGapDays = (totalTimeSpan / (1000 * 60 * 60 * 24)) * 0.1;

  return events.reduce<Event[]>((acc, event, index) => {
    acc.push(event);

    const nextEvent = events[index + 1];
    if (nextEvent) {
      const timeDiff =
        event.timestamp.getTime() - nextEvent.timestamp.getTime();
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

      if (daysDiff > dynamicMinGapDays) {
        acc.push({
          type: TimelineEventType.Gap,
          timestamp: new Date(nextEvent.timestamp.getTime() + timeDiff / 2),
          content: `${Math.floor(daysDiff)} days`,
          gapSize: Math.min(daysDiff * 2, 10),
        });
      }
    }

    return acc;
  }, []);
}

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

// Main function to extract events
export async function getEvents(group: GroupReturnType): Promise<Event[]> {
  return otel('get-events', async () => {
    if (!group) return [];

    let events: Event[] = [];

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

        const daoIndexer = await db
          .selectFrom('daoIndexer')
          .selectAll()
          .where('id', '=', proposal.daoIndexerId)
          .executeTakeFirstOrThrow();

        const offchain =
          daoIndexer.indexerVariant == IndexerVariant.SNAPSHOT_PROPOSALS;

        events.push({
          content: `${offchain ? 'Offchain' : 'Onchain'} vote started on ${format(
            startedAt,
            'MMM d'
          )}`,
          type: TimelineEventType.Basic,
          timestamp: startedAt,
          url: proposal.url,
        });

        const votes = await db
          .selectFrom('vote')
          .selectAll()
          .where('proposalId', '=', proposal.id)
          .execute();

        const metadata =
          typeof proposal.metadata === 'string'
            ? (JSON.parse(proposal.metadata) as ProposalMetadata)
            : (proposal.metadata as ProposalMetadata);

        const voteType = metadata?.voteType;

        if (new Date() > endedAt) {
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
            proposal: proposal as ProposalWithMetadata,
            votes: votes,
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
            proposal: proposal as ProposalWithMetadata,
            votes: votes,
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

    // Aggregate events if necessary
    const totalHeightUnits = calculateTotalHeightUnits(events);
    const maxHeightUnits = MAX_HEIGHT;

    if (totalHeightUnits > maxHeightUnits) {
      const timeSpan =
        events[0].timestamp.getTime() -
        events[events.length - 1].timestamp.getTime();
      const aggregationWindow = Math.max(
        timeSpan / MAX_EVENTS,
        MIN_TIME_BETWEEN_EVENTS
      );

      const commentEvents = aggregateVolumeEvents(
        events,
        TimelineEventType.CommentsVolume,
        aggregationWindow
      );
      const voteEvents = aggregateVolumeEvents(
        events,
        TimelineEventType.VotesVolume,
        aggregationWindow
      );

      const importantEvents = events.filter(
        (e) =>
          e.type === TimelineEventType.Basic ||
          e.type === TimelineEventType.ResultOngoingBasicVote ||
          e.type === TimelineEventType.ResultOngoingOtherVotes ||
          e.type === TimelineEventType.ResultEndedBasicVote ||
          e.type === TimelineEventType.ResultEndedOtherVotes
      );

      events = [...importantEvents, ...commentEvents, ...voteEvents].sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );

      while (calculateTotalHeightUnits(events) > maxHeightUnits) {
        const volumeEventIndex = events.findIndex(
          (e) =>
            e.type === TimelineEventType.CommentsVolume ||
            e.type === TimelineEventType.VotesVolume
        );
        if (volumeEventIndex === -1) break;
        events.splice(volumeEventIndex, 1);
      }
    }

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
    const firstEventTimestamp = events[0].timestamp.getTime();
    const lastEventTimestamp = events[events.length - 1].timestamp.getTime();
    const totalTimeSpan = firstEventTimestamp - lastEventTimestamp;
    let eventsWithGaps = addGapEvents(events, totalTimeSpan);

    // Add summary event if necessary
    eventsWithGaps = addSummaryEvent(eventsWithGaps, totalComments, totalVotes);

    return eventsWithGaps;
  });
}
