import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import Image from 'next/image';

interface DiscussionGroupItemProps {
  group: {
    id: string;
    name: string;
    slug: string;
    authorName: string;
    authorAvatarUrl: string;
    latestActivityAt: Date;
    hasNewActivity: boolean;
    hasActiveProposal: boolean;
    topicsCount: number;
    proposalsCount: number;
    votesCount: number;
    postsCount: number;
  };
}

export function DiscussionGroupItem({ group }: DiscussionGroupItemProps) {
  const relativeTime = formatDistanceToNow(new Date(group.latestActivityAt), {
    addSuffix: true,
  });

  return (
    <Link
      href={`/${group.slug}`}
      className='group block rounded-xs border border-neutral-200 bg-white p-4 hover:bg-neutral-200/50 dark:border-neutral-700 dark:bg-neutral-800/50 dark:hover:bg-neutral-800'
      prefetch={true}
    >
      <div className='flex flex-col gap-1 sm:gap-2'>
        <div className='flex items-start justify-between'>
          <div className='flex max-w-[60%] items-start gap-2 sm:max-w-3/4'>
            <div className='relative flex min-h-[32px] min-w-[32px] items-center justify-center overflow-hidden rounded-full border-2 border-neutral-700 sm:min-h-[40px] sm:min-w-[40px] dark:border-neutral-300'>
              <Image
                src={group.authorAvatarUrl}
                alt={group.authorName}
                className='h-full w-full object-cover'
                fill
                sizes='(min-width: 640px) 40px, 32px'
              />
            </div>
            <div>
              <h2 className='line-clamp-2 text-sm font-bold text-neutral-800 group-hover:text-neutral-900 sm:text-lg dark:text-neutral-200 dark:group-hover:text-neutral-50'>
                {group.name}
              </h2>
              <p className='text-xs text-neutral-600 sm:text-sm dark:text-neutral-400'>
                By {group.authorName}
              </p>
            </div>
          </div>
          <div className='flex items-center gap-1'>
            {group.hasNewActivity && (
              <div className='relative flex min-h-5 min-w-5 items-center justify-center sm:min-h-6 sm:min-w-6'>
                <span className='absolute inline-flex h-3 w-3 animate-ping rounded-full bg-green-400 opacity-75'></span>
                <span className='relative inline-flex h-2 w-2 rounded-full bg-green-500'></span>
              </div>
            )}
            <span className='dark:text-neutral-350 text-end text-xs font-bold text-neutral-600 select-none sm:text-sm'>
              {relativeTime}
            </span>
          </div>
        </div>

        <div className='dark:text-neutral-350 mt-1 flex flex-col-reverse justify-between gap-2 text-xs font-bold text-neutral-600 select-none sm:mt-2 sm:flex-row sm:items-end sm:gap-0 sm:text-sm'>
          <div className='flex'>
            {group.postsCount > 0 && group.votesCount == 0 && (
              <span>{group.postsCount} comments</span>
            )}
            {group.postsCount == 0 && group.votesCount > 0 && (
              <span>{group.postsCount} votes</span>
            )}
            {group.postsCount > 0 && group.votesCount > 0 && (
              <span>
                {group.postsCount} comments and {group.postsCount} votes
              </span>
            )}
            {group.postsCount == 0 && group.votesCount == 0 && (
              <span>No activity</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
