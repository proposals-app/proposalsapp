import { FeedFilterEnum, VotesFilterEnum } from '@/app/searchParams';
import { DiscoursePost, Selectable, Vote } from '@proposalsapp/db-indexer';
import { notFound } from 'next/navigation';
import { PostItem } from './items/PostItem/PostItem';
import { VoteItem } from './items/VoteItem/VoteItem';
import { GroupReturnType } from '../../actions';
import { FeedReturnType, getFeed_cached } from './actions';
import { ProcessedVote } from '@/lib/results_processing';
import { AggregateVoteItem } from './items/VoteItem/AggregateVoteItem';

export default async function Feed({
  group,
  feedFilter,
  votesFilter,
  feed,
}: {
  group: GroupReturnType;
  feedFilter: FeedFilterEnum;
  votesFilter: VotesFilterEnum;
  feed: FeedReturnType;
}) {
  if (!group) {
    notFound();
  }

  const sortedItems = mergeAndSortFeedItems(feed.votes, feed.posts);

  // Filter out posts if comments is false
  const itemsToDisplay = sortedItems.filter(
    (item) =>
      (item.type == 'post' &&
        feedFilter != FeedFilterEnum.VOTES &&
        item.postNumber != 1) ||
      item.type == 'vote'
  );

  return (
    <div className='w-full'>
      {itemsToDisplay.map((item, index) => {
        if (item.type === 'post') {
          const postItem = (
            <div key={index}>
              <div className='flex w-full flex-col p-4'>
                <PostItem item={item} group={group} />
              </div>
              {index < itemsToDisplay.length - 1 && (
                <div className='border-b border-neutral-200 dark:border-neutral-800' />
              )}
            </div>
          );

          return postItem;
        } else {
          return (
            <div key={index}>
              <div className='flex w-full flex-col p-4'>
                {item.aggregate ? (
                  <AggregateVoteItem item={item} group={group} />
                ) : (
                  <VoteItem item={item} group={group} />
                )}
              </div>
              {index < itemsToDisplay.length - 1 && (
                <div className='border-b border-neutral-200 dark:border-neutral-800' />
              )}
            </div>
          );
        }
      })}
    </div>
  );
}

export function FeedLoading() {
  return (
    <div className='mt-6 w-full space-y-6'>
      {[...Array(3)].map((_, i) => (
        <div key={i} className='px-6 py-4'>
          <div className='flex animate-pulse items-center justify-between'>
            <div className='flex items-center gap-4'>
              <div className='h-10 w-10 rounded-full bg-neutral-200 dark:bg-neutral-800'></div>
              <div className='space-y-2'>
                <div className='h-4 w-32 rounded bg-neutral-200 dark:bg-neutral-800'></div>
                <div className='h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-800'></div>
              </div>
            </div>
            <div className='h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-800'></div>
          </div>

          <div className='mt-4 space-y-2'>
            <div className='h-4 w-3/4 rounded bg-neutral-200 dark:bg-neutral-800'></div>
            <div className='h-4 w-1/2 rounded bg-neutral-200 dark:bg-neutral-800'></div>
          </div>
        </div>
      ))}
    </div>
  );
}

export type VoteFeedItem = {
  type: 'vote';
} & ProcessedVote;

export type PostFeedItem = {
  type: 'post';
} & Selectable<DiscoursePost>;

export type CombinedFeedItem = VoteFeedItem | PostFeedItem;

export function mergeAndSortFeedItems(
  votes: Pick<
    Selectable<Vote>,
    | 'choice'
    | 'createdAt'
    | 'proposalId'
    | 'reason'
    | 'voterAddress'
    | 'votingPower'
    | 'id'
  >[],
  posts: Selectable<DiscoursePost>[]
) {
  const combinedItems = [
    ...votes.map((vote) => ({
      ...vote,
      type: 'vote' as const,
    })),
    ...posts.map((post) => ({
      ...post,
      type: 'post' as const,
    })),
  ];

  // Sort the combined items by timestamp in descending order
  combinedItems.sort((a, b) => {
    if (a.createdAt && b.createdAt) {
      return b.createdAt.getTime() - a.createdAt.getTime();
    } else if (a.createdAt) {
      return -1;
    } else if (b.createdAt) {
      return 1;
    } else {
      return 0;
    }
  });

  // Ensure the types are correct
  return combinedItems as CombinedFeedItem[];
}
