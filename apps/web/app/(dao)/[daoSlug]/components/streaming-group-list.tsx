'use client';

import { Suspense, useMemo, useState } from 'react';
import { Filter, Search } from 'lucide-react';
import { GroupItemWrapper } from './group-item-wrapper';
import type { FeedData } from '../actions';

interface Group {
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
}

interface StreamingGroupListProps {
  initialGroups: Group[];
  signedIn: boolean;
}

// Individual group item with its own Suspense boundary for progressive loading
function StreamingGroupItem({ group }: { group: Group }) {
  return (
    <Suspense fallback={<GroupItemSkeleton />}>
      <GroupItemWrapper group={group} />
    </Suspense>
  );
}

// Skeleton for individual group items
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

export function StreamingGroupList({
  initialGroups,
  signedIn,
}: StreamingGroupListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'unread'>('all');

  // Sort groups to prioritize active proposals for better perceived performance
  const sortedGroups = useMemo(() => {
    return [...initialGroups].sort((a, b) => {
      // Active proposals first
      if (a.hasActiveProposal && !b.hasActiveProposal) return -1;
      if (!a.hasActiveProposal && b.hasActiveProposal) return 1;
      // Then by activity
      return b.latestActivityAt.getTime() - a.latestActivityAt.getTime();
    });
  }, [initialGroups]);

  const filteredGroups = useMemo(() => {
    let filtered = sortedGroups;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((group) => {
        const nameMatch = group.name.toLowerCase().includes(query);
        const authorMatch = group.authorName.toLowerCase().includes(query);
        return nameMatch || authorMatch;
      });
    }

    // Apply category filter
    switch (filter) {
      case 'active':
        filtered = filtered.filter((group) => group.hasActiveProposal);
        break;

      case 'unread':
        filtered = filtered.filter((group) => group.hasNewActivity);
        break;
    }

    return filtered;
  }, [sortedGroups, searchQuery, filter]);

  // Split groups into batches for progressive rendering
  const priorityGroups = filteredGroups.filter((g) => g.hasActiveProposal);
  const regularGroups = filteredGroups.filter((g) => !g.hasActiveProposal);

  return (
    <div className='flex flex-col gap-6'>
      {/* Search and Filter Bar */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='relative w-full sm:w-1/2'>
          <div className='relative flex items-center'>
            <Search className='absolute left-3 h-5 w-5 text-neutral-400' />
            <input
              type='text'
              placeholder='Search by name or author...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='w-full rounded-xs border border-neutral-200 bg-white py-2 pr-4 pl-10 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-neutral-600'
            />
          </div>
        </div>

        <div className='flex flex-wrap gap-2 self-end'>
          <button
            onClick={() => setFilter('all')}
            className={`cursor-pointer rounded-xs px-4 py-1.5 text-sm font-medium ${
              filter === 'all'
                ? `border border-neutral-200 bg-neutral-300 px-2 py-1 text-sm font-medium text-neutral-700 disabled:opacity-70 dark:border-neutral-600 dark:bg-neutral-600 dark:text-neutral-200`
                : `border border-neutral-200 bg-white px-2 py-1 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-70 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-600`
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`cursor-pointer rounded-xs px-4 py-1.5 text-sm font-medium ${
              filter === 'active'
                ? `border border-neutral-200 bg-neutral-300 px-2 py-1 text-sm font-medium text-neutral-700 disabled:opacity-70 dark:border-neutral-600 dark:bg-neutral-600 dark:text-neutral-200`
                : `border border-neutral-200 bg-white px-2 py-1 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-70 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-600`
            }`}
          >
            Active
          </button>

          {signedIn && (
            <button
              onClick={() => setFilter('unread')}
              className={`cursor-pointer rounded-xs px-4 py-1.5 text-sm font-medium ${
                filter === 'unread'
                  ? `border border-neutral-200 bg-neutral-300 px-2 py-1 text-sm font-medium text-neutral-700 disabled:opacity-70 dark:border-neutral-600 dark:bg-neutral-600 dark:text-neutral-200`
                  : `border border-neutral-200 bg-white px-2 py-1 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-70 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-600`
              }`}
            >
              Unread
            </button>
          )}
        </div>
      </div>

      {/* Groups List */}
      {filteredGroups.length === 0 ? (
        <div className='flex flex-col items-center justify-center rounded-xs border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800/50'>
          <Filter className='mb-2 h-10 w-10 text-neutral-400' />
          <p className='text-lg font-medium text-neutral-800 dark:text-neutral-200'>
            No results found
          </p>
          <p className='mt-1 text-neutral-500 dark:text-neutral-400'>
            Try adjusting your search or filter criteria
          </p>
        </div>
      ) : (
        <div className='space-y-4'>
          {/* Render priority groups (active proposals) first */}
          {priorityGroups.map((group) => (
            <div key={group.id}>
              <StreamingGroupItem group={group} />
            </div>
          ))}

          {/* Then render regular groups */}
          {regularGroups.map((group) => (
            <div key={group.id}>
              <StreamingGroupItem group={group} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
