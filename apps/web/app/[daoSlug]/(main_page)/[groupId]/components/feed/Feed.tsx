import { notFound } from 'next/navigation';
import { PostItem } from './items/PostItem/PostItem';
import { VoteItem } from './items/VoteItem/VoteItem';
import { FeedReturnType, GroupReturnType } from '../../actions';
import { AggregateVoteItem } from './items/VoteItem/AggregateVoteItem';

export default async function Feed({
  group,
  feed,
}: {
  group: GroupReturnType;
  feed: FeedReturnType;
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
          const postItem = (
            <div key={index}>
              <div className='flex w-full flex-col p-4'>
                <PostItem item={item} group={group} />
              </div>
              {index < combinedItems.length - 1 && (
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
