import type { DiscourseUser, Selectable } from '@proposalsapp/db';
import { formatDistanceToNowStrict } from 'date-fns';
import { markdownToHtml } from '@/lib/markdown-converter';
import {
  getDelegateByDiscourseUser,
  getDiscourseUser,
  getPostLikesCount,
} from '../../actions';
import type { FeedReturnType, GroupReturnType } from '../../../../actions';
import { DiscourseAuthor } from '@/app/(dao)/[daoSlug]/components/author/author-discourse';
import HeartIcon from '@/public/assets/web/icons/like.svg';
import SeenIcon from '@/public/assets/web/icons/views.svg';
import { connection } from 'next/server';
import { SkeletonPostItem } from '@/app/components/ui/skeleton';

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

  const author = await getDiscourseUser(item.userId, item.daoDiscourseId);

  const likesCount = await getPostLikesCount(
    item.externalId,
    item.daoDiscourseId
  );

  const proposalIds = Array.from(new Set(group.proposals.map((p) => p.id)));
  const topicIds = Array.from(new Set(group.topics.map((t) => t.id)));

  const delegate = await getDelegateByDiscourseUser(
    item.userId,
    group.daoSlug,
    false,
    topicIds,
    proposalIds
  );

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
          discourseBaseUrl={group.daoDiscourse.discourseBaseUrl}
        />
      )}
    </div>
  );
}

const PostContent = ({
  author,
  ens,
  relativeCreateTime,
  relativeUpdateTime,
  updatedAt,
  likesCount,
  processedContent,
  contentLength,
  item,
  currentVotingPower,
  discourseBaseUrl,
}: {
  author: Selectable<DiscourseUser> | undefined;
  ens: string | null | undefined;
  relativeCreateTime: string;
  relativeUpdateTime: string;
  updatedAt: Date;
  likesCount: number;
  processedContent: string;
  contentLength: number;
  item: FeedReturnType['posts'][0];
  currentVotingPower?: number;
  discourseBaseUrl: string;
}) => {
  const CONTENT_THRESHOLD = 400;

  // Extract a safe preview of the content
  const extractPreview = (
    content: string
  ): { preview: string; hasMore: boolean } => {
    // Match paragraphs, lists, blockquotes, and other block-level elements
    const blocks = content.match(
      /<(p|div|ul|ol|blockquote|h[1-6]|pre)[^>]*>.*?<\/\1>/gs
    );

    if (!blocks) return { preview: content, hasMore: false };

    let preview = '';
    let textLength = 0;
    let blockCount = 0;

    for (const block of blocks) {
      // Calculate the approximate text length by removing HTML tags
      const textOnlyLength = block.replace(/<[^>]*>/g, '').length;

      if (textLength + textOnlyLength > CONTENT_THRESHOLD && blockCount >= 2) {
        // We have enough content for the preview
        return { preview, hasMore: true };
      }

      preview += block;
      textLength += textOnlyLength;
      blockCount++;
    }

    return { preview: content, hasMore: false }; // All content fits in the preview
  };

  const { preview, hasMore } = extractPreview(processedContent);
  const shouldCollapse = hasMore && contentLength > CONTENT_THRESHOLD;

  return (
    <>
      <div className='flex cursor-default flex-row justify-between select-none'>
        {author ? (
          <DiscourseAuthor
            username={author.username}
            ens={ens}
            avatar={author.avatarTemplate}
            currentVotingPower={currentVotingPower}
            eventVotingPower={null}
            discourseBaseUrl={discourseBaseUrl}
          />
        ) : null}

        <div className='dark:text-neutral-350 flex cursor-default flex-col items-end text-sm text-neutral-600 select-none'>
          <div className='flex flex-col items-end'>
            <div>
              posted <span className='font-bold'>{relativeCreateTime}</span>
            </div>
          </div>
          {item.createdAt.getTime() !== updatedAt.getTime() && (
            <div>
              <span>edited {relativeUpdateTime}</span>
            </div>
          )}
        </div>
      </div>

      {shouldCollapse ? (
        <details className='group relative mt-6'>
          <summary className='cursor-pointer list-none [&::-webkit-details-marker]:hidden'>
            <div className='prose prose-lg relative max-w-none'>
              <div
                dangerouslySetInnerHTML={{ __html: preview }}
                className='break-words group-open:hidden'
              />
              <div className='absolute right-0 bottom-0 left-0 h-36 bg-gradient-to-t from-neutral-50 to-transparent group-open:hidden dark:from-neutral-900' />
              <div className='relative my-4 flex items-end justify-end group-open:hidden'>
                <div className='absolute w-full border-t border-neutral-300 dark:border-neutral-700' />
                <span className='relative flex flex-row gap-4 bg-neutral-200 px-4 text-sm text-neutral-600 dark:bg-neutral-600 dark:text-neutral-300'>
                  <div className='flex flex-row items-center gap-2 self-end justify-self-end'>
                    {likesCount > 0 ? (
                      <div className='flex items-center gap-1 text-sm'>
                        <span>{likesCount}</span>
                        <HeartIcon className='h-3 w-3 self-center' />
                      </div>
                    ) : null}

                    <div className='flex items-center gap-1 text-sm'>
                      <span>{item.reads}</span>
                      <SeenIcon className='h-3 w-3 self-center' />
                    </div>
                  </div>
                  <span> Read More</span>
                </span>
              </div>
            </div>
          </summary>
          <div className='w-full'>
            <div
              dangerouslySetInnerHTML={{ __html: processedContent }}
              className='prose prose-lg mt-4 max-w-none break-words text-ellipsis'
            />

            <div className='flex flex-row items-center gap-4 self-end justify-self-end'>
              <div className='ml-auto flex flex-row items-center gap-2'>
                {likesCount > 0 ? (
                  <div className='flex items-center gap-1 text-sm'>
                    <span>{likesCount}</span>
                    <HeartIcon className='h-3 w-3 self-center' />
                  </div>
                ) : null}

                <div className='flex items-center gap-1 text-sm'>
                  <span>{item.reads}</span>
                  <SeenIcon className='h-3 w-3 self-center' />
                </div>
              </div>
            </div>
          </div>
        </details>
      ) : (
        <div className='w-full'>
          <div
            dangerouslySetInnerHTML={{ __html: processedContent }}
            className='prose prose-lg mt-4 max-w-none break-words text-ellipsis'
          />

          <div className='flex flex-row items-center gap-4 self-end justify-self-end'>
            <div className='ml-auto flex flex-row items-center gap-2'>
              {likesCount > 0 ? (
                <div className='flex items-center gap-1 text-sm'>
                  <span>{likesCount}</span>
                  <HeartIcon className='h-3 w-3 self-center' />
                </div>
              ) : null}

              <div className='flex items-center gap-1 text-sm'>
                <span>{item.reads}</span>
                <SeenIcon className='h-3 w-3 self-center' />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export function PostItemLoading() {
  return <SkeletonPostItem />;
}

// Processing functions moved to @/lib/markdown-converter for unified processing

// markdownToHtml function moved to @/lib/markdown-converter for unified processing
