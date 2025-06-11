import { notFound } from 'next/navigation';
import { PostItem } from './items/post-item/post-item';
import { VoteItem } from './items/vote-item/vote-item';
import type { FeedReturnType, GroupReturnType } from '../../actions';
import { AggregateVoteItem } from './items/vote-item/aggregate-vote-item';
import type { VotesWithVoters } from '@/app/(dao)/[daoSlug]/(results_page)/[groupId]/vote/[resultNumber]/components/actions';
import { SkeletonFeed } from '@/app/components/ui/skeleton';

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
    <div className='flex w-full flex-col'>
      {combinedItems.map((item, index) => {
        if (item.type === 'post') {
          return (
            <div
              key={index}
              className='border-b border-neutral-200 py-4 dark:border-neutral-800'
            >
              <div className='flex w-full flex-col'>
                <PostItem item={item} group={group} />
              </div>
            </div>
          );
        } else {
          const voteWithVoter = allVotesWithVoters.find(
            (vote) => vote.id === item.id
          );

          return (
            <div
              key={index}
              className='border-b border-neutral-200 dark:border-neutral-800'
            >
              <div className='flex w-full flex-col'>
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
            </div>
          );
        }
      })}
    </div>
  );
}

export function FeedLoading() {
  return <SkeletonFeed />;
}
