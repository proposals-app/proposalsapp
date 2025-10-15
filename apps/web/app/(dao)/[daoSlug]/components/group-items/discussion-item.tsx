import { formatDistance } from 'date-fns';
import Link from 'next/link';
import Image from 'next/image';
import CommentsIcon from '@/public/assets/web/icons/discussion.svg';
import VotesIcon from '@/public/assets/web/icons/vote.svg';

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
  currentTime: Date;
}

export function DiscussionGroupItem({
  group,
  currentTime,
}: DiscussionGroupItemProps) {
  const relativeTime = formatDistance(group.latestActivityAt, currentTime, {
    addSuffix: true,
  });

  return (
    <Link
      href={`/${group.slug}`}
      className='rounded-xs hover:bg-neutral-200/50 dark:bg-neutral-800/50 group block border border-neutral-200 bg-white p-2 dark:border-neutral-700 dark:hover:bg-neutral-800 sm:p-3'
    >
      <div className='flex flex-col gap-1 sm:gap-2'>
        <div className='flex items-start justify-between'>
          <div className='sm:max-w-3/4 flex max-w-[60%] items-start gap-2'>
            <div className='relative flex min-h-[32px] min-w-[32px] items-center justify-center overflow-hidden rounded-full border-2 border-neutral-700 dark:border-neutral-300 sm:min-h-[40px] sm:min-w-[40px]'>
              <Image
                src={group.authorAvatarUrl}
                alt={group.authorName}
                className='h-full w-full object-cover'
                fill
                sizes='(min-width: 640px) 40px, 32px'
              />
            </div>
            <div>
              <h2 className='line-clamp-2 text-sm font-bold text-neutral-800 group-hover:text-neutral-900 dark:text-neutral-200 dark:group-hover:text-neutral-50 sm:text-lg'>
                {group.name}
              </h2>
              <p className='text-xs text-neutral-600 dark:text-neutral-400 sm:text-sm'>
                By {group.authorName}
              </p>
            </div>
          </div>
          <div className='flex items-center gap-1'>
            <span className='select-none text-end text-xs font-bold text-neutral-600 dark:text-neutral-350 sm:text-sm'>
              {relativeTime}
            </span>
            {group.hasNewActivity && (
              <div className='relative flex min-h-5 min-w-5 items-center justify-center sm:min-h-6 sm:min-w-6'>
                <span className='absolute inline-flex h-3 w-3 animate-ping rounded-full bg-for-400 opacity-75 dark:bg-for-600'></span>
                <span className='relative inline-flex h-2 w-2 rounded-full bg-for-400 dark:bg-for-600'></span>
              </div>
            )}
          </div>
        </div>

        <div className='flex select-none flex-col justify-end gap-2 self-end text-xs font-bold text-neutral-600 dark:text-neutral-350'>
          {group.postsCount > 0 && group.votesCount == 0 && (
            <span className='flex items-center gap-1'>
              <CommentsIcon className='h-6 w-6' />
              {group.postsCount} comments
            </span>
          )}
          {group.postsCount == 0 && group.votesCount > 0 && (
            <span className='flex items-center gap-1'>
              <VotesIcon className='h-6 w-6' />
              {group.votesCount} votes
            </span>
          )}
          {group.postsCount > 0 && group.votesCount > 0 && (
            <span className='flex items-center gap-4'>
              <span className='flex items-center gap-1'>
                <CommentsIcon className='h-6 w-6' />
                {group.postsCount} comments
              </span>
              <span className='flex items-center gap-1'>
                <VotesIcon className='h-6 w-6' />
                {group.votesCount} votes
              </span>
            </span>
          )}
          {group.postsCount == 0 && group.votesCount == 0 && (
            <span>No activity</span>
          )}
        </div>
      </div>
    </Link>
  );
}
