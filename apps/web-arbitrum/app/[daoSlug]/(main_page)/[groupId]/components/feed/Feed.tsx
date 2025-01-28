import { VotesFilterEnum } from '@/app/searchParams';
import { DiscoursePost, Selectable, Vote } from '@proposalsapp/db';
import { notFound } from 'next/navigation';
import { PostItem } from './items/PostItem';
import { VoteItem } from './items/VoteItem';
import { GroupReturnType } from '../../actions';
import { getFeed_cached } from './actions';

export default async function Feed({
  group,
  commentsFilter,
  votesFilter,
}: {
  group: GroupReturnType;
  commentsFilter: boolean;
  votesFilter: VotesFilterEnum;
  page?: number;
}) {
  if (!group) {
    notFound();
  }

  const feed = await getFeed_cached(
    group.group.id,
    commentsFilter,
    votesFilter
  );

  const sortedItems = mergeAndSortFeedItems(feed.votes, feed.posts);

  // Filter out posts if comments is false
  const itemsToDisplay = sortedItems.filter(
    (item) =>
      (item.type == 'post' && commentsFilter && item.postNumber != 1) ||
      item.type == 'vote'
  );

  // Generate a list of posts with placeholders for missing post numbers
  const itemsWithPlaceholders = insertPlaceholderPosts(itemsToDisplay);

  let previousPostNumber: number | undefined;

  return (
    <div className='w-full'>
      {itemsWithPlaceholders.map((item, index) => {
        if (item.type === 'post') {
          const postItem = (
            <div key={index}>
              <div className='flex w-full flex-col p-4'>
                <PostItem item={item} previousPostNumber={previousPostNumber} />
              </div>
              {index < itemsWithPlaceholders.length - 1 && (
                <div className='border-b border-neutral-200 dark:border-neutral-800' />
              )}
            </div>
          );
          previousPostNumber = item.postNumber;
          return postItem;
        } else {
          return (
            <div key={index}>
              <div className='flex w-full flex-col p-4'>
                <VoteItem item={item} group={group} />
              </div>
              {index < itemsWithPlaceholders.length - 1 && (
                <div className='border-b border-neutral-200 dark:border-neutral-800' />
              )}
            </div>
          );
        }
      })}
    </div>
  );
}

function insertPlaceholderPosts(items: CombinedFeedItem[]): CombinedFeedItem[] {
  const posts = items.filter((item) => item.type === 'post') as PostFeedItem[];
  const votes = items.filter((item) => item.type === 'vote') as VoteFeedItem[];

  if (posts.length === 0) {
    return items; // No posts to process
  }

  // Sort posts by postNumber
  posts.sort((a, b) => a.postNumber - b.postNumber);

  const result: CombinedFeedItem[] = [];

  let previousPostNumber = posts[0].postNumber;
  let previousPostTimestamp = posts[0].timestamp;

  for (const post of posts) {
    // If there's a gap between the current post and the previous one, insert placeholders
    while (previousPostNumber < post.postNumber - 1) {
      const placeholderTimestamp = new Date(
        previousPostTimestamp.getTime() + 1
      );
      result.push({
        type: 'post',
        id: `placeholder-${previousPostNumber + 1}`, // Unique ID for the placeholder
        externalId: 0, // Placeholder external ID
        name: '', // Empty name
        username: 'deleted', // Placeholder username
        cooked: '', // No content
        postNumber: previousPostNumber + 1,
        postType: 1, // Default post type
        updatedAt: new Date(), // Use current time as a placeholder
        replyCount: 0, // No replies
        replyToPostNumber: null, // No reply to another post
        quoteCount: 0, // No quotes
        incomingLinkCount: 0, // No incoming links
        reads: 0, // No reads
        readersCount: 0, // No readers
        score: 0, // Default score
        topicId: post.topicId, // Use the same topicId as the next post
        topicSlug: post.topicSlug, // Use the same topicSlug as the next post
        displayUsername: '', // Empty display username
        primaryGroupName: null, // No primary group
        flairName: null, // No flair name
        flairUrl: null, // No flair URL
        flairBgColor: null, // No flair background color
        flairColor: null, // No flair color
        version: 1, // Default version
        userId: 0, // Placeholder user ID
        daoDiscourseId: post.daoDiscourseId, // Use the same DAO ID as the next post
        canViewEditHistory: false, // Cannot view edit history
        deleted: true, // Mark as deleted
        timestamp: placeholderTimestamp, // Use current time as a placeholder
      });
      previousPostNumber++;
      previousPostTimestamp = placeholderTimestamp;
    }

    result.push(post);
    previousPostNumber = post.postNumber;
    previousPostTimestamp = post.timestamp;
  }

  // Re-insert votes into the result array, maintaining their original order
  for (const vote of votes) {
    result.push(vote);
  }

  // Sort the final result by timestamp
  result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return result;
}

export function FeedLoading() {
  return (
    <div className='mt-6 w-full p-6'>
      <div className='space-y-4'>
        {[...Array(3)].map((_, i) => (
          <div key={i} className='flex items-center gap-4'>
            <div className='h-10 w-10 animate-pulse rounded-full bg-gray-200' />
            <div className='flex-1 space-y-2'>
              <div className='h-4 w-3/4 animate-pulse bg-gray-200' />
              <div className='h-4 w-1/2 animate-pulse bg-gray-200' />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export type VoteFeedItem = {
  type: 'vote';
  timestamp: Date;
} & Omit<Selectable<Vote>, 'timeCreated'>;

export type PostFeedItem = {
  type: 'post';
  timestamp: Date;
} & Omit<Selectable<DiscoursePost>, 'createdAt'>;

export type CombinedFeedItem = VoteFeedItem | PostFeedItem;

export function mergeAndSortFeedItems(
  votes: Selectable<Vote>[],
  posts: Selectable<DiscoursePost>[]
): CombinedFeedItem[] {
  const combinedItems = [
    ...votes.map((vote) => ({
      type: 'vote' as const,
      ...vote,
      timeCreated: undefined,
      timestamp: new Date(vote.timeCreated!),
    })),
    ...posts.map((post) => ({
      type: 'post' as const,
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
