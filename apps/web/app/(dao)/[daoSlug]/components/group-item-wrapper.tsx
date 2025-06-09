import { Suspense } from 'react';
import { ActiveGroupItem } from './group-items/active-item';
import { InactiveGroupItem } from './group-items/inactive-item';
import { DiscussionGroupItem } from './group-items/discussion-item';
import type { FeedData } from '../actions';

interface GroupItemWrapperProps {
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
    activeFeedData: FeedData | null;
  };
}

// Loading skeleton for individual group items
function GroupItemSkeleton() {
  return (
    <div className='rounded-xs border border-neutral-200 bg-white p-2 sm:p-3 dark:border-neutral-700 dark:bg-neutral-950'>
      <div className='relative flex flex-col gap-1 sm:gap-2'>
        <div className='flex flex-col items-start justify-between gap-2 sm:flex-row sm:gap-0'>
          <div className='flex max-w-[60%] items-start gap-2 sm:max-w-3/4'>
            <div className='min-h-[32px] min-w-[32px] animate-pulse rounded-full bg-neutral-200 sm:min-h-[40px] sm:min-w-[40px] dark:bg-neutral-700' />
            <div>
              <div className='mb-1 h-5 w-32 animate-pulse rounded-xs bg-neutral-200 dark:bg-neutral-700' />
              <div className='h-4 w-20 animate-pulse rounded-xs bg-neutral-200 dark:bg-neutral-700' />
            </div>
          </div>
          <div className='h-16 w-32 animate-pulse rounded-xs bg-neutral-200 dark:bg-neutral-700' />
        </div>
      </div>
    </div>
  );
}

// Wrapper component that handles rendering logic
export function GroupItemWrapper({ group }: GroupItemWrapperProps) {
  return (
    <Suspense fallback={<GroupItemSkeleton />}>
      {group.hasActiveProposal ? (
        <ActiveGroupItem group={group} feedData={group.activeFeedData} />
      ) : group.proposalsCount > 0 ? (
        <InactiveGroupItem group={group} />
      ) : (
        <DiscussionGroupItem group={group} />
      )}
    </Suspense>
  );
}
