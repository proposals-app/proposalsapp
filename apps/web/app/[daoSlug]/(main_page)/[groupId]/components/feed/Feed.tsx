import { notFound } from 'next/navigation';
import { PostItem } from './items/PostItem/PostItem';
import { VoteItem } from './items/VoteItem/VoteItem';
import { FeedReturnType, GroupReturnType } from '../../actions';
import { AggregateVoteItem } from './items/VoteItem/AggregateVoteItem';
import { VotesWithVoters } from '@/app/[daoSlug]/(results_page)/[groupId]/vote/[resultNumber]/components/actions';

export async function Feed({
  group,
  feed,
  allVotesWithVoters,
}: {
  group: GroupReturnType;
  feed: FeedReturnType;
  allVotesWithVoters: VotesWithVoters;
}) {
  if (!group) {
    notFound();
  }

  const combinedItems = [
    ...feed.votes.map((vote) => ({
      ...vote,
      type: 'vote' as const,
    })),
    ...feed.posts.map((post) => ({
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

  return (
    <div className='w-full'>
      {combinedItems.map((item, index) => {
        if (item.type === 'post') {
          return (
            <div key={index}>
              <div className='flex w-full flex-col p-4'>
                <PostItem item={item} group={group} />
              </div>
              {index < combinedItems.length - 1 && (
                <div className='border-b border-neutral-200 dark:border-neutral-800' />
              )}
            </div>
          );
        } else {
          const voteWithVoter = allVotesWithVoters.find(
            (vote) => vote.id === item.id
          );

          return (
            <div key={index}>
              <div className='flex w-full flex-col p-4'>
                {item.aggregate ? (
                  <AggregateVoteItem item={item} group={group} />
                ) : voteWithVoter ? (
                  <VoteItem
                    item={item}
                    group={group}
                    voteWithVoter={voteWithVoter}
                  />
                ) : null}
              </div>
              {index < combinedItems.length - 1 && (
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
    <div className='w-full'>
      {[...Array(3)].map((_, i) => (
        <div className='px-6 py-4' key={i}>
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
