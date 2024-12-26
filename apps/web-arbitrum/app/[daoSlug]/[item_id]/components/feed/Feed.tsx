import { DiscoursePost, Selectable, Vote } from "@proposalsapp/db";
import { GroupWithDataType } from "../../actions";
import { VoteItem } from "./VoteItem";
import { PostItem } from "./PostItem";
import { notFound } from "next/navigation";
import { getFeedForGroup, getProposalsByIds } from "./actions";
import { VotesFilterEnum } from "@/app/searchParams";

export default async function Feed({
  group,
  commentsFilter,
  votesFilter,
}: {
  group: GroupWithDataType;
  commentsFilter: boolean;
  votesFilter: VotesFilterEnum;
}) {
  if (!group) {
    notFound();
  }
  const feed = await getFeedForGroup(
    group.group.id,
    commentsFilter,
    votesFilter,
  );

  const sortedItems = mergeAndSortFeedItems(feed.votes, feed.posts);

  // Filter out posts if comments is false
  const itemsToDisplay = sortedItems.filter(
    (item) =>
      (item.type == "post" && commentsFilter && item.postNumber != 1) ||
      item.type == "vote",
  );

  return (
    <div className="flex w-full flex-col items-center divide-y">
      {itemsToDisplay.map((item, index) => (
        <div key={index} className="flex w-full flex-col p-4">
          {item.type === "vote" && <VoteItem item={item} group={group} />}
          {item.type === "post" && <PostItem item={item} />}
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
