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

      if (new Date() > endedAt) {
        events.push({
          content: `${offchain ? "Offchain" : "Onchain"} vote ended ${formatDaysAgo(endedAt)}`,
          type: TimelineEventType.ResultEnded,
          timestamp: endedAt,
        });
      } else {
        events.push({
          content: `${offchain ? "Offchain" : "Onchain"} vote ends ${formatRelativeTime(endedAt)}`,
          type: TimelineEventType.ResultOngoing,
          timestamp: endedAt,
        });
      }
    }
  }

  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return events;
}
