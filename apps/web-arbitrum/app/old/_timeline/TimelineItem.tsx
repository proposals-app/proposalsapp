import { AggregatedVoteItem } from "./items/AggregatedVoteItem";
import { DiscussionItem } from "./items/DiscussionItem";
import { PostItem } from "./items/PostItem";
import { ProposalItem } from "./items/ProposalItem";
import { VoteItem } from "./items/VoteItem";
import {
  AggregatedVotesContent,
  DiscussionContent,
  PostContent,
  ProcessedTimelineItem,
  ProposalContent,
  VoteContent,
} from "./types";

export function TimelineItem({ item }: { item: ProcessedTimelineItem }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm transition-colors hover:bg-gray-50">
      {item.type === "proposal" && (
        <ProposalItem
          content={item.content as ProposalContent}
          timestamp={item.timestamp}
        />
      )}
      {item.type === "discussion" && (
        <DiscussionItem
          content={item.content as DiscussionContent}
          timestamp={item.timestamp}
        />
      )}
      {item.type === "post" && (
        <PostItem
          content={item.content as PostContent}
          timestamp={item.timestamp}
        />
      )}
      {item.type === "vote" && (
        <VoteItem
          content={item.content as VoteContent}
          timestamp={item.timestamp}
        />
      )}
      {item.type === "aggregated_votes" && (
        <AggregatedVoteItem
          content={item.content as AggregatedVotesContent}
          timestamp={item.timestamp}
        />
      )}
    </div>
  );
}
