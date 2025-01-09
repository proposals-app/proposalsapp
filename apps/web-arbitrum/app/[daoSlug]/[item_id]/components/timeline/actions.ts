import { GroupWithDataType } from "../../actions";
import {
  db,
  IndexerVariant,
  Proposal,
  Selectable,
  sql,
  Vote,
} from "@proposalsapp/db";
import { format, formatDistanceToNow, endOfDay } from "date-fns";

export enum TimelineEventType {
  ResultOngoing = "ResultOngoing",
  ResultEnded = "ResultEnded",
  Basic = "Basic",
  CommentsVolume = "CommentsVolume",
  VotesVolume = "VotesVolume",
  Gap = "Gap",
}

interface BaseEvent {
  type: TimelineEventType;
  timestamp: Date;
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
  volumeType: "comments";
}

interface VotesVolumeEvent extends BaseEvent {
  type: TimelineEventType.VotesVolume;
  content: string;
  volume: number;
  volumeType: "votes";
}

interface GapEvent extends BaseEvent {
  type: TimelineEventType.Gap;
  content: string;
  gapSize: number;
}

interface ResultEvent extends BaseEvent {
  type: TimelineEventType.ResultOngoing | TimelineEventType.ResultEnded;
  content: string;
  proposal: Selectable<Proposal>;
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

const DEFAULT_MIN_GAP_DAYS = 1;

const EVENT_HEIGHT_UNITS = {
  [TimelineEventType.Basic]: 30,
  [TimelineEventType.ResultEnded]: 110,
  [TimelineEventType.ResultOngoing]: 110,
  [TimelineEventType.CommentsVolume]: 3,
  [TimelineEventType.VotesVolume]: 3,
  [TimelineEventType.Gap]: 10, // Increased from 5
} as const;

function aggregateVolumeEvents(
  events: Event[],
  type: TimelineEventType.CommentsVolume | TimelineEventType.VotesVolume,
  timeWindow: number,
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
    avgTime: Date,
  ): CommentsVolumeEvent | VotesVolumeEvent => {
    const totalVolume = windowEvents.reduce((sum, e) => sum + e.volume, 0);
    const isComments = type === TimelineEventType.CommentsVolume;

    return {
      type, // This is now strictly typed
      timestamp: avgTime,
      content: `${windowEvents.length} ${isComments ? "comments" : "votes"} in this period`,
      volume: totalVolume / windowEvents.length,
      volumeType: isComments ? "comments" : "votes",
    } as CommentsVolumeEvent | VotesVolumeEvent; // Type assertion to help TypeScript
  };

  volumeEvents.forEach((event) => {
    if (event.timestamp.getTime() - windowStart.getTime() <= timeWindow) {
      currentWindow.push(event);
    } else {
      if (currentWindow.length > 0) {
        const avgTimestamp = new Date(
          currentWindow.reduce((sum, e) => sum + e.timestamp.getTime(), 0) /
            currentWindow.length,
        );
        aggregatedEvents.push(
          createAggregatedEvent(currentWindow, avgTimestamp),
        );
      }
      currentWindow = [event];
      windowStart = event.timestamp;
    }
  });

  if (currentWindow.length > 0) {
    const avgTimestamp = new Date(
      currentWindow.reduce((sum, e) => sum + e.timestamp.getTime(), 0) /
        currentWindow.length,
    );
    aggregatedEvents.push(createAggregatedEvent(currentWindow, avgTimestamp));
  }

  return aggregatedEvents;
}

function calculateTotalHeightUnits(events: Event[]): number {
  return events.reduce((sum, event) => sum + EVENT_HEIGHT_UNITS[event.type], 0);
}

export async function extractEvents(
  group: GroupWithDataType,
): Promise<Event[]> {
  let events: Event[] = [];
  if (!group) {
    return [];
  }

  if (group.topics && group.topics.length > 0) {
    const discourse = await db
      .selectFrom("daoDiscourse")
      .where("daoDiscourse.id", "=", group.topics[0].daoDiscourseId)
      .selectAll()
      .executeTakeFirstOrThrow();

    const createdAt = new Date(group.topics[0].createdAt);
    events.push({
      content: `Proposal initially posted on ${format(createdAt, "MMM d")}`,
      type: TimelineEventType.Basic,
      timestamp: createdAt,
      url: `${discourse.discourseBaseUrl}/t/${group.topics[0].externalId}`,
    });
  }

  if (group.proposals && group.proposals.length > 0) {
    for (const proposal of group.proposals) {
      const startedAt = new Date(proposal.timeStart);
      const endedAt = new Date(proposal.timeEnd);

      const daoIndexer = await db
        .selectFrom("daoIndexer")
        .selectAll()
        .where("id", "=", proposal.daoIndexerId)
        .executeTakeFirstOrThrow();

      const offchain =
        daoIndexer.indexerVariant == IndexerVariant.SNAPSHOT_PROPOSALS;

      events.push({
        content: `${offchain ? "Offchain" : "Onchain"} vote started on ${format(
          startedAt,
          "MMM d",
        )}`,
        type: TimelineEventType.Basic,
        timestamp: startedAt,
        url: proposal.url,
      });

      const votes = await db
        .selectFrom("vote")
        .selectAll()
        .where("proposalId", "=", proposal.id)
        .execute();

      if (new Date() > endedAt) {
        events.push({
          content: `${offchain ? "Offchain" : "Onchain"} vote ended ${formatDistanceToNow(
            endedAt,
            { addSuffix: true },
          )}`,
          type: TimelineEventType.ResultEnded,
          timestamp: endedAt,
          proposal: proposal,
          votes: votes,
        });
      } else {
        events.push({
          content: `${offchain ? "Offchain" : "Onchain"} vote ends ${formatDistanceToNow(
            endedAt,
            { addSuffix: true },
          )}`,
          type: TimelineEventType.ResultOngoing,
          timestamp: endedAt,
          proposal: proposal,
          votes: votes,
        });
      }

      const dailyVotes = (await db
        .selectFrom("vote")
        .select([
          sql<Date>`DATE_TRUNC('day', "time_created")`.as("date"),
          sql<number>`SUM("voting_power")`.as("totalVotingPower"),
          sql<Date>`MIN("time_created")`.as("firstVoteTime"),
        ])
        .where("proposalId", "=", proposal.id)
        .groupBy(sql`DATE_TRUNC('day', "time_created")`)
        .execute()) as {
        date: Date;
        totalVotingPower: number;
        firstVoteTime: Date;
      }[];

      const maxVotes = Math.max(
        ...dailyVotes.map((dv) => Number(dv.totalVotingPower)),
      );

      dailyVotes.forEach((dailyVote) => {
        const timestamp = new Date(dailyVote.firstVoteTime);
        const normalizedVolume = Number(dailyVote.totalVotingPower) / maxVotes;
        events.push({
          content: `${Number(dailyVote.totalVotingPower).toFixed(2)} voting power on ${format(
            timestamp,
            "MMM d",
          )}`,
          type: TimelineEventType.VotesVolume,
          timestamp,
          volume: normalizedVolume,
          volumeType: "votes",
        });
      });
    }
  }

  if (group.topics && group.topics.length > 0) {
    for (const topic of group.topics) {
      const dailyPosts = (await db
        .selectFrom("discoursePost")
        .select([
          sql<Date>`DATE_TRUNC('day', "created_at")`.as("date"),
          sql<number>`COUNT(id)`.as("count"),
        ])
        .where("postNumber", "!=", 1)
        .where("topicId", "=", topic.externalId)
        .groupBy(sql`DATE_TRUNC('day', "created_at")`)
        .execute()) as { date: Date; count: number }[];

      const maxComments = Math.max(...dailyPosts.map((dp) => Number(dp.count)));

      dailyPosts.forEach((dailyPost) => {
        const timestamp = endOfDay(new Date(dailyPost.date));
        const normalizedVolume = Number(dailyPost.count) / maxComments;
        events.push({
          content: `${dailyPost.count} post(s) on ${format(timestamp, "MMM d")}`,
          type: TimelineEventType.CommentsVolume,
          timestamp,
          volume: normalizedVolume,
          volumeType: "comments",
        });
      });
    }
  }

  // Sort events by timestamp in descending order
  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const totalHeightUnits = calculateTotalHeightUnits(events);
  const maxHeightUnits =
    MAX_EVENTS * EVENT_HEIGHT_UNITS[TimelineEventType.Basic];

  if (totalHeightUnits > maxHeightUnits) {
    const timeSpan =
      events[0].timestamp.getTime() -
      events[events.length - 1].timestamp.getTime();
    const aggregationWindow = Math.max(
      timeSpan / MAX_EVENTS,
      MIN_TIME_BETWEEN_EVENTS,
    );

    const commentEvents = aggregateVolumeEvents(
      events,
      TimelineEventType.CommentsVolume,
      aggregationWindow,
    );
    const voteEvents = aggregateVolumeEvents(
      events,
      TimelineEventType.VotesVolume,
      aggregationWindow,
    );

    const importantEvents = events.filter(
      (e) =>
        e.type === TimelineEventType.Basic ||
        e.type === TimelineEventType.ResultOngoing ||
        e.type === TimelineEventType.ResultEnded,
    );

    events = [...importantEvents, ...commentEvents, ...voteEvents].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );

    while (calculateTotalHeightUnits(events) > maxHeightUnits) {
      const volumeEventIndex = events.findIndex(
        (e) =>
          e.type === TimelineEventType.CommentsVolume ||
          e.type === TimelineEventType.VotesVolume,
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
        .selectFrom("discoursePost")
        .select([sql<number>`COUNT(id)`.as("count")])
        .where("postNumber", "!=", 1)
        .where("topicId", "=", topic.externalId)
        .executeTakeFirstOrThrow();

      totalComments += Number(commentsCount.count);
    }
  }

  if (group.proposals && group.proposals.length > 0) {
    for (const proposal of group.proposals) {
      const votesCount = await db
        .selectFrom("vote")
        .select([sql<number>`COUNT(id)`.as("count")])
        .where("proposalId", "=", proposal.id)
        .executeTakeFirstOrThrow();

      totalVotes += Number(votesCount.count);
    }
  }

  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Calculate the total time span between the first and last event
  const firstEventTimestamp = events[0].timestamp.getTime();
  const lastEventTimestamp = events[events.length - 1].timestamp.getTime();
  const totalTimeSpan = firstEventTimestamp - lastEventTimestamp;

  // Determine the minimum gap size as 10% of the total time span
  const dynamicMinGapDays = (totalTimeSpan / (1000 * 60 * 60 * 24)) * 0.1;

  // Calculate time spans and insert gaps
  const eventsWithGaps = events.reduce<Event[]>((acc, event, index) => {
    acc.push(event);

    const nextEvent = events[index + 1];
    if (nextEvent) {
      const timeDiff =
        event.timestamp.getTime() - nextEvent.timestamp.getTime();
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

      // Add a gap if events are more than the dynamic minimum gap size apart
      if (daysDiff > dynamicMinGapDays) {
        acc.push({
          type: TimelineEventType.Gap,
          timestamp: new Date(nextEvent.timestamp.getTime() + timeDiff / 2),
          content: `${Math.floor(daysDiff)} days`,
          gapSize: Math.min(daysDiff * 2, 10), // Scale gap size with days, but cap it
        });
      }
    }

    return acc;
  }, []);

  // Check if the last event is a volume type event
  const lastEvent = eventsWithGaps[0];
  if (
    lastEvent &&
    (lastEvent.type === TimelineEventType.CommentsVolume ||
      lastEvent.type === TimelineEventType.VotesVolume)
  ) {
    // Create a new basic event with the current timestamp and total comments and votes
    const currentTimestamp = new Date();
    eventsWithGaps.unshift({
      content: `${totalComments} comments and ${totalVotes} votes`,
      type: TimelineEventType.Basic,
      timestamp: currentTimestamp,
      url: "",
    });
  }

  return eventsWithGaps;
}
