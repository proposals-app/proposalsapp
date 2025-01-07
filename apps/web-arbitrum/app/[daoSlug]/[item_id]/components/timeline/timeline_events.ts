import { GroupWithDataType } from "../../actions";
import { db, IndexerVariant } from "@proposalsapp/db";
import { format, formatDistanceToNow } from "date-fns";

export enum TimelineEventType {
  ResultOngoing = "ResultOngoing",
  ResultEnded = "ResultEnded",
  Basic = "Basic",
}

interface Event {
  content: string;
  type: TimelineEventType;
  timestamp: Date;
  position: number; // Position in the range from 0 to 1
}

export async function extractEvents(
  group: GroupWithDataType,
): Promise<Event[]> {
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
      position: -1, // Initial placeholder
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
        position: -1, // Initial placeholder
      });

      if (new Date() > endedAt) {
        events.push({
          content: `${offchain ? "Offchain" : "Onchain"} vote ended ${formatDaysAgo(endedAt)}`,
          type: TimelineEventType.ResultEnded,
          timestamp: endedAt,
          position: -1, // Initial placeholder
        });
      } else {
        events.push({
          content: `${offchain ? "Offchain" : "Onchain"} vote ends ${formatRelativeTime(endedAt)}`,
          type: TimelineEventType.ResultOngoing,
          timestamp: endedAt,
          position: -1, // Initial placeholder
        });
      }
    }
  }

  // Sort events by timestamp in descending order (newest to oldest)
  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  if (events.length > 0) {
    const startTime = events[events.length - 1].timestamp; // Oldest event
    const endTime = events[0].timestamp; // Newest event

    // Calculate position for each event
    events.forEach((event) => {
      const timeDiff = Math.abs(event.timestamp.getTime() - endTime.getTime());
      const totalTimeRange = endTime.getTime() - startTime.getTime();

      if (totalTimeRange > 0) {
        event.position = timeDiff / totalTimeRange;
      } else {
        event.position = 0; // All timestamps are the same
      }
    });
  }

  events[0].position = 0;

  return events;
}
