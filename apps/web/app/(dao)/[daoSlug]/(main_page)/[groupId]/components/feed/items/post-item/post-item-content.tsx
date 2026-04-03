import type { DiscourseUser, Selectable } from '@proposalsapp/db';
import { DiscourseAuthor } from '@/app/(dao)/[daoSlug]/components/author/author-discourse';
import HeartIcon from '@/public/assets/web/icons/like.svg';
import SeenIcon from '@/public/assets/web/icons/views.svg';
import type { FeedReturnType } from '../../../../actions';

interface PostContentProps {
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
}

export function PostContent({
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
}: PostContentProps) {
  const contentThreshold = 400;

  const extractPreview = (
    content: string
  ): { preview: string; hasMore: boolean } => {
    const blocks = content.match(
      /<(p|div|ul|ol|blockquote|h[1-6]|pre)[^>]*>.*?<\/\1>/gs
    );

    if (!blocks) return { preview: content, hasMore: false };

    let preview = '';
    let textLength = 0;
    let blockCount = 0;

    for (const block of blocks) {
      const textOnlyLength = block.replace(/<[^>]*>/g, '').length;

      if (textLength + textOnlyLength > contentThreshold && blockCount >= 2) {
        return { preview, hasMore: true };
      }

      preview += block;
      textLength += textOnlyLength;
      blockCount++;
    }

    return { preview: content, hasMore: false };
  };

  const { preview, hasMore } = extractPreview(processedContent);
  const shouldCollapse = hasMore && contentLength > contentThreshold;

  return (
    <>
      <div className='flex cursor-default select-none flex-row justify-between'>
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

        <div className='flex cursor-default select-none flex-col items-end text-sm text-neutral-600 dark:text-neutral-350'>
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
              <div className='absolute bottom-0 left-0 right-0 h-36 bg-gradient-to-t from-neutral-50 to-transparent group-open:hidden dark:from-neutral-900' />
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
              className='prose prose-lg mt-4 max-w-none text-ellipsis break-words'
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
            className='prose prose-lg mt-4 max-w-none text-ellipsis break-words'
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
}
