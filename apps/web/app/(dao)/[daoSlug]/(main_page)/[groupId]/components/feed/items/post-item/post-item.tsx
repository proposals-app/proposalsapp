import { formatDistanceToNowStrict } from 'date-fns';
import { markdownToHtml } from '@/lib/markdown-converter';
import {
  getDelegateByDiscourseUser,
  getDiscourseUser,
  getPostLikesCount,
} from '../../actions';
import type { FeedReturnType, GroupReturnType } from '../../../../actions';
import { connection } from 'next/server';
import { SkeletonPostItem } from '@/app/components/ui/skeleton';
import { PostContent } from './post-item-content';

export async function PostItem({
  item,
  group,
}: {
  item: FeedReturnType['posts'][0];
  group: GroupReturnType;
}) {
  await connection();

  if (!group) {
    return null;
  }

  // Validate userId is within acceptable range before querying (negative values are system users)
  const isValidUserId =
    (item.userId >= 1 && item.userId <= 2147483647) || item.userId < 0;

  const author = isValidUserId
    ? await getDiscourseUser(item.userId, item.daoDiscourseId)
    : undefined;

  const likesCount = await getPostLikesCount(
    item.externalId,
    item.daoDiscourseId
  );

  const proposalIds = Array.from(new Set(group.proposals.map((p) => p.id)));
  const topicIds = Array.from(new Set(group.topics.map((t) => t.id)));

  const delegate = isValidUserId
    ? await getDelegateByDiscourseUser(
        item.userId,
        group.daoSlug,
        false,
        topicIds,
        proposalIds
      )
    : null;

  const currentVotingPower =
    delegate?.delegatetovoter?.latestVotingPower?.votingPower;

  const processedContent = markdownToHtml(item.cooked ?? 'Unknown', 'post');
  const postAnchorId = `post-${item.postNumber}-${item.topicId}`;
  const relativeCreateTime = formatDistanceToNowStrict(
    new Date(item.createdAt),
    {
      addSuffix: true,
    }
  );

  const updatedAt =
    item.updatedAt instanceof Date ? item.updatedAt : new Date(item.updatedAt);
  const relativeUpdateTime = formatDistanceToNowStrict(
    new Date(item.updatedAt),
    {
      addSuffix: true,
    }
  );

  const isPostDeleted = item.deleted;

  return (
    <div id={postAnchorId} className='w-full scroll-mt-36 py-4'>
      {isPostDeleted ? (
        // Show the full details/summary UI for deleted posts
        <details className='w-full'>
          <summary className='flex h-12 cursor-default list-none items-center justify-center border-neutral-400 text-neutral-500 [&::-webkit-details-marker]:hidden'>
            <div className='grow border-t border-neutral-300 dark:border-neutral-700'></div>
            <span className='relative bg-neutral-50 px-4 text-sm text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400'>
              Deleted Post
            </span>
            <div className='grow border-t border-neutral-300 dark:border-neutral-700'></div>
          </summary>
        </details>
      ) : (
        <PostContent
          author={author}
          ens={delegate?.delegatetovoter?.ens}
          relativeCreateTime={relativeCreateTime}
          relativeUpdateTime={relativeUpdateTime}
          updatedAt={updatedAt}
          likesCount={likesCount}
          processedContent={processedContent}
          contentLength={item.cooked?.length || 0}
          currentVotingPower={currentVotingPower}
          item={item}
          discourseBaseUrl={group.daoDiscourse?.discourseBaseUrl || ''}
        />
      )}
    </div>
  );
}

export function PostItemLoading() {
  return <SkeletonPostItem />;
}

// Processing functions moved to @/lib/markdown-converter for unified processing

// markdownToHtml function moved to @/lib/markdown-converter for unified processing
