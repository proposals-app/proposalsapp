import { unstable_cache } from "next/cache";
import { DiscoursePost, Selectable, Vote } from "@proposalsapp/db";
import { GroupWithDataType } from "../../actions";
import { VoteItem } from "./items/VoteItem";
import { PostItem } from "./items/PostItem";
import { notFound } from "next/navigation";
import { getFeedForGroup } from "./actions";
import { VotesFilterEnum } from "@/app/searchParams";
import { LazyLoadTrigger } from "./LazyLoadTrigger";
import { Card } from "@/shadcn/ui/card";
import { Skeleton } from "@/shadcn/ui/skeleton";

// Cached version of getFeedForGroup
const getCachedFeedForGroup = unstable_cache(
  async (
    groupId: string,
    commentsFilter: boolean,
    votesFilter: VotesFilterEnum,
    page: number,
  ) => {
    return await getFeedForGroup(groupId, commentsFilter, votesFilter, page);
  },
  ["feed-for-group"],
  { revalidate: 60 * 5, tags: ["feed"] },
);

export default async function Feed({
  group,
  commentsFilter,
  votesFilter,
  page = 1,
}: {
  group: GroupWithDataType;
  commentsFilter: boolean;
  votesFilter: VotesFilterEnum;
  page?: number;
}) {
  if (!group) {
    notFound();
  }

  const feed = await getCachedFeedForGroup(
    group.group.id,
    commentsFilter,
    votesFilter,
    page,
  );

  const sortedItems = mergeAndSortFeedItems(feed.votes, feed.posts);

  // Filter out posts if comments is false
  const itemsToDisplay = sortedItems.filter(
    (item) =>
      (item.type == "post" && commentsFilter && item.postNumber != 1) ||
      item.type == "vote",
  );

  return (
    <div className="mt-6 w-full p-6">
      {itemsToDisplay.map((item, index) => (
        <div key={index} className="flex w-full flex-col p-4">
          {item.type === "vote" && <VoteItem item={item} group={group} />}
          {item.type === "post" && <PostItem item={item} />}
        </div>
      ))}
      {feed.hasMore && <LazyLoadTrigger />}
    </div>
  );
}

export function FeedLoading() {
  return (
    <div className="mt-6 w-full p-6">
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
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
