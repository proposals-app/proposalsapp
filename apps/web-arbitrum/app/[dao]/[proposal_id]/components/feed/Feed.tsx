import { DiscoursePost, Selectable, Vote } from "@proposalsapp/db";
import { GroupType } from "../../actions";
import { VoteItem } from "./VoteItem";
import { PostItem } from "./PostItem";
import { notFound } from "next/navigation";
import { getFeedForGroup, getProposalsByIds } from "./actions";
import { Suspense } from "react";

export default async function Feed({ group }: { group: GroupType }) {
  if (!group) {
    notFound();
  }
  const feed = await getFeedForGroup(group.group.id);

  const proposalsIds = Array.from(new Set(feed.votes.map((v) => v.proposalId)));
  const proposals = await getProposalsByIds(proposalsIds);

  const sortedItems = mergeAndSortFeedItems(feed.votes, feed.posts);
  return (
    <div className="space-y-4 divide-y">
      {sortedItems
        .filter(
          (item) =>
            (item.type == "post" && item.postNumber != 1) ||
            item.type == "vote",
        )
        .map((item, index) => (
          <div key={index}>
            {item.type === "vote" && (
              <VoteItem
                item={item}
                proposal={proposals.find((p) => p.id == item.proposalId)}
              />
            )}
            {item.type === "post" && (
              <Suspense fallback={<div>Loading post</div>}>
                <PostItem item={item} />
              </Suspense>
            )}
          </div>
        ))}
    </div>
  );
}

export type VoteFeedItem = {
  type: "vote";
  timestamp: Date;
} & Omit<Selectable<Vote>, "timeCreated">;

export type PostFeedItem = {
  type: "post";
  timestamp: Date;
} & Omit<Selectable<DiscoursePost>, "createdAt">;

export type CombinedFeedItem = VoteFeedItem | PostFeedItem;

export function mergeAndSortFeedItems(
  votes: Selectable<Vote>[],
  posts: Selectable<DiscoursePost>[],
): CombinedFeedItem[] {
  const combinedItems = [
    ...votes.map((vote) => ({
      type: "vote" as const,
      ...vote,
      timeCreated: undefined,
      timestamp: new Date(vote.timeCreated!),
    })),
    ...posts.map((post) => ({
      type: "post" as const,
      ...post,
      createdAt: undefined,
      timestamp: new Date(post.createdAt),
    })),
  ];

  // Sort the combined items by timestamp in descending order
  combinedItems.sort((a, b) => {
    if (a.timestamp && b.timestamp) {
      return b.timestamp.getTime() - a.timestamp.getTime();
    } else if (a.timestamp) {
      return -1;
    } else if (b.timestamp) {
      return 1;
    } else {
      return 0;
    }
  });

  // Ensure the types are correct
  return combinedItems as CombinedFeedItem[];
}
