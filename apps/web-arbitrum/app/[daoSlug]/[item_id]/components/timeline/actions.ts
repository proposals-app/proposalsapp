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

export async function extractEvents(
  group: GroupWithDataType,
): Promise<Event[]> {
  interface DailyVoteResult {
    date: Date;
    totalVotingPower: number;
  }

  interface DailyPostResult {
    date: Date;
    count: number;
  }

  if (!group) return [];

  const formatDate = (date: Date): string => {
    return format(date, "MMM d"); // e.g., "Nov 12"
  };

  const formatRelativeTime = (date: Date): string => {
    return formatDistanceToNow(date, { addSuffix: true }); // e.g., "in 4 hours" or "in 2 days"
  };

  const formatDaysAgo = (date: Date): string => {
    return formatDistanceToNow(date, { addSuffix: true }); // e.g., "21 days ago"
  };

  const events: Event[] = [];

  if (group.topics && group.topics.length > 0) {
    const createdAt = new Date(group.topics[0].createdAt);
    events.push({
      content: `Proposal initially posted on ${formatDate(createdAt)}`,
      type: TimelineEventType.Basic,
      timestamp: createdAt,
    });
  }

  if (group.proposals && group.proposals.length > 0) {
    for (const proposal of group.proposals) {
      const createdAt = new Date(proposal.timeCreated);
      const endedAt = new Date(proposal.timeEnd);

      const daoIndexer = await db
        .selectFrom("daoIndexer")
        .selectAll()
        .where("id", "=", proposal.daoIndexerId)
        .executeTakeFirstOrThrow();

      const offchain =
        daoIndexer.indexerVariant == IndexerVariant.SNAPSHOT_PROPOSALS;

      events.push({
        content: `${offchain ? "Offchain" : "Onchain"} vote started on ${formatDate(createdAt)}`,
        type: TimelineEventType.Basic,
        timestamp: createdAt,
      });

      const votes = await db
        .selectFrom("vote")
        .selectAll()
        .where("proposalId", "=", proposal.id)
        .execute();

      if (new Date() > endedAt) {
        events.push({
          content: `${offchain ? "Offchain" : "Onchain"} vote ended ${formatDaysAgo(endedAt)}`,
          type: TimelineEventType.ResultEnded,
          timestamp: endedAt,
          proposal: proposal,
          votes: votes,
        });
      } else {
        events.push({
          content: `${offchain ? "Offchain" : "Onchain"} vote ends ${formatRelativeTime(endedAt)}`,
          type: TimelineEventType.ResultOngoing,
          timestamp: endedAt,
          proposal: proposal,
          votes: votes,
        });
      }

      // Calculate daily votes volume for the proposal based on total voting power
      const dailyVotes = (await db
        .selectFrom("vote")
        .select([
          sql<Date>`DATE_TRUNC('day', "time_created")`.as("date"),
          sql<number>`SUM("voting_power")`.as("totalVotingPower"),
        ])
        .where("proposalId", "=", proposal.id)
        .groupBy(sql`DATE_TRUNC('day', "time_created")`)
        .execute()) as DailyVoteResult[];

      // Find the maximum total voting power in a single day
      const maxVotes = Math.max(
        ...dailyVotes.map((dv) => Number(dv.totalVotingPower)),
      );

      dailyVotes.forEach((dailyVote) => {
        const timestamp = endOfDay(new Date(dailyVote.date));
        const normalizedVolume = Number(dailyVote.totalVotingPower) / maxVotes; // Normalize to 0-1
        events.push({
          content: `${Number(dailyVote.totalVotingPower).toFixed(2)} voting power on ${formatDate(timestamp)}`,
          type: TimelineEventType.VotesVolume,
          timestamp,
          volume: normalizedVolume, // Add normalized volume
          volumeType: "votes",
        });
      });
    }
  }

  if (group.topics && group.topics.length > 0) {
    for (const topic of group.topics) {
      // Calculate daily comments volume for the topic
      const dailyPosts = (await db
        .selectFrom("discoursePost")
        .select([
          sql<Date>`DATE_TRUNC('day', "created_at")`.as("date"),
          sql<number>`COUNT(id)`.as("count"),
        ])
        .where("postNumber", "!=", 1)
        .where("topicId", "=", topic.externalId)
        .groupBy(sql`DATE_TRUNC('day', "created_at")`)
        .execute()) as DailyPostResult[];

      // Find the maximum number of comments in a single day
      const maxComments = Math.max(...dailyPosts.map((dp) => Number(dp.count)));

      dailyPosts.forEach((dailyPost) => {
        const timestamp = endOfDay(new Date(dailyPost.date));
        const normalizedVolume = Number(dailyPost.count) / maxComments; // Normalize to 0-1
        events.push({
          content: `${dailyPost.count} post(s) on ${formatDate(timestamp)}`,
          type: TimelineEventType.CommentsVolume,
          timestamp,
          volume: normalizedVolume, // Add normalized volume
          volumeType: "comments",
        });
      });
    }
  }

  // Sort events by timestamp in descending order (newest to oldest)
  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Calculate total time span
  const newest = events[0].timestamp.getTime();
  const oldest = events[events.length - 1].timestamp.getTime();
  const totalTimeSpan = newest - oldest;

  // Insert gaps and calculate relative positions
  const finalEvents: Event[] = [];
  const MIN_GAP = 0.02; // Minimum 2% gap
  const SIGNIFICANT_GAP = 24 * 60 * 60 * 1000; // 1 day in milliseconds

  for (let i = 0; i < events.length; i++) {
    const currentEvent = events[i];
    const nextEvent = events[i + 1];

    // Add the current event
    finalEvents.push(currentEvent);

    if (nextEvent) {
      const timeDifference =
        currentEvent.timestamp.getTime() - nextEvent.timestamp.getTime();
      const relativeGap = timeDifference / totalTimeSpan;

      if (timeDifference > SIGNIFICANT_GAP) {
        // Add a gap event with calculated size
        const gapSize = Math.max(relativeGap * 100, MIN_GAP * 100); // Convert to percentage
        finalEvents.push({
          content: `Gap of ${formatDistanceToNow(nextEvent.timestamp, { addSuffix: false })}`,
          type: TimelineEventType.Gap,
          timestamp: new Date(
            nextEvent.timestamp.getTime() + timeDifference / 2,
          ),
          gapSize,
        });
      }
    }
  }

  return finalEvents;
}
