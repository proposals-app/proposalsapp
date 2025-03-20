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
      className='block border border-neutral-200 bg-white p-4 dark:border-neutral-700
        dark:bg-neutral-800'
      prefetch={true}
    >
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-xl font-bold text-neutral-800 dark:text-neutral-200'>
            {group.name}
          </h2>
          <div
            className='mt-2 flex flex-wrap items-center gap-4 text-sm text-neutral-600
              dark:text-neutral-400'
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
        <div className='flex flex-row gap-2'>
          {group.hasNewActivity && <NewBadge />}
          <ArrowRight className='h-6 w-6 text-neutral-400 dark:text-neutral-500' />
        </div>
      </div>
    </Link>
  );
}

const NewBadge = () => (
  <div
    className='border-neutral-350 dark:border-neutral-650 border bg-neutral-200 px-2 py-1
      text-sm text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200'
  >
    New activity
  </div>
);
