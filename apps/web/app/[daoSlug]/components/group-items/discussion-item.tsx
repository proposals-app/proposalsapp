import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
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
    commentsCount: number;
    proposalsCount: number;
  };
}

export function DiscussionGroupItem({ group }: DiscussionGroupItemProps) {
  const relativeTime = formatDistanceToNow(new Date(group.latestActivityAt), {
    addSuffix: true,
  });

  return (
    <Link
      href={`/${group.slug}`}
      className='dark:hover:bg-neutral-750 block border border-neutral-200 bg-white p-4 transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800'
      prefetch={true}
    >
      <div className='flex flex-col gap-4'>
        <div className='flex items-start justify-between'>
          <div className='flex items-center gap-3'>
            <div className='flex min-h-10 min-w-10 items-center justify-center overflow-hidden border-2 border-neutral-700 sm:min-h-12 sm:min-w-12 dark:border-neutral-300'>
              <Image
                src={group.authorAvatarUrl}
                alt={group.authorName}
                width={48}
                height={48}
                className='h-full w-full object-cover'
              />
            </div>
            <div>
              <h2 className='text-lg font-bold text-neutral-800 sm:text-xl dark:text-neutral-200'>
                {group.name}
              </h2>
              <p className='text-sm text-neutral-600 dark:text-neutral-400'>
                By {group.authorName}
              </p>
            </div>
          </div>
          {group.hasNewActivity && <NewBadge />}
        </div>

        <div className='flex flex-wrap gap-3 text-xs sm:text-sm'>
          <span className='bg-neutral-200 px-2 py-1 dark:bg-neutral-700'>
            Last activity {relativeTime}
          </span>
          <span className='bg-neutral-200 px-2 py-1 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300'>
            {group.commentsCount} discussions
          </span>
        </div>

        <div className='flex justify-end'>
          <div className='flex items-center gap-1 text-sm font-medium text-neutral-500 dark:text-neutral-400'>
            View discussions <ArrowRight className='h-4 w-4' />
          </div>
        </div>
      </div>
    </Link>
  );
}

const NewBadge = () => (
  <div className='bg-neutral-700 px-3 py-1 text-xs font-medium text-white sm:text-sm dark:bg-neutral-300 dark:text-neutral-800'>
    New activity
  </div>
);
