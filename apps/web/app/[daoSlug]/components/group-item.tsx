import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface GroupItemProps {
  group: {
    id: string;
    name: string;
    slug: string;
    authorName: string;
    authorAvatarUrl: string;
    latestActivityAt: Date;
    hasNewActivity: boolean;
    commentsCount: number;
    proposalsCount: number;
  };
}

export function GroupItem({ group }: GroupItemProps) {
  const relativeTime = formatDistanceToNow(new Date(group.latestActivityAt), {
    addSuffix: true,
  });

  return (
    <Link
      href={`/${group.slug}`}
      className='block border border-neutral-200 bg-white p-3 sm:p-4 dark:border-neutral-700
        dark:bg-neutral-800'
      prefetch={true}
    >
      <div className='flex flex-row justify-between gap-3 sm:items-center sm:gap-0'>
        <div>
          <h2 className='text-lg font-bold text-neutral-800 sm:text-xl dark:text-neutral-200'>
            {group.name}
          </h2>
          <div
            className='mt-2 flex flex-col gap-1 text-xs text-neutral-600 sm:flex-row sm:flex-wrap
              sm:items-center sm:gap-4 sm:text-sm dark:text-neutral-400'
          >
            <span>By {group.authorName}</span>
            <span>Last activity {relativeTime}</span>
            <div className='flex items-center gap-2'>
              <span>{group.commentsCount} discussions</span>
              {group.proposalsCount > 0 && (
                <span>{group.proposalsCount} proposals</span>
              )}
            </div>
          </div>
        </div>
        <div className='flex items-center justify-between sm:flex-row sm:gap-2'>
          {group.hasNewActivity && <NewBadge />}
          <ArrowRight className='h-5 w-5 text-neutral-400 sm:h-6 sm:w-6 dark:text-neutral-500' />
        </div>
      </div>
    </Link>
  );
}

const NewBadge = () => (
  <div
    className='border-neutral-350 dark:border-neutral-650 border bg-neutral-200 px-2 py-1
      text-xs text-neutral-700 sm:text-sm dark:bg-neutral-700 dark:text-neutral-200'
  >
    New activity
  </div>
);
