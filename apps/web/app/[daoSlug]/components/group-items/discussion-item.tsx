import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { ArrowRight, Activity } from 'lucide-react';
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
      className={`group dark:hover:bg-neutral-850 block border-2 border-neutral-200 bg-neutral-100 p-4 transition-colors hover:border-neutral-300 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-950 dark:hover:border-neutral-600 dark:hover:bg-neutral-800`}
      prefetch={true}
    >
      <div className='flex flex-col gap-2 sm:gap-3'>
        <div className='flex items-start justify-between'>
          <div className='flex max-w-3/4 items-center gap-2'>
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
              <h2 className='text-lg font-bold text-neutral-800 group-hover:text-neutral-900 sm:text-xl dark:text-neutral-200 dark:group-hover:text-neutral-50'>
                {group.name}
              </h2>
              <p className='text-sm text-neutral-600 dark:text-neutral-400'>
                By {group.authorName}
              </p>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            {group.hasNewActivity && (
              <div className='flex min-h-6 min-w-6 animate-pulse items-center justify-center rounded-full bg-green-200 text-green-700 dark:bg-green-800 dark:text-green-200'>
                <Activity className='h-3 w-3' />
              </div>
            )}

            <span className='dark:text-neutral-350 text-sm font-bold text-neutral-600 select-none'>
              {relativeTime}
            </span>
          </div>
        </div>

        <div className='dark:text-neutral-350 mt-1 flex items-end justify-between text-sm font-bold text-neutral-600 select-none sm:mt-2'>
          <div className='flex'>
            <span>{group.postsCount} comments</span>&nbsp;
            {group.votesCount > 0 && <span>and {group.votesCount} votes</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}
