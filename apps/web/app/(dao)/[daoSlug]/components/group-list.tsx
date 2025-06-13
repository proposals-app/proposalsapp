'use client';

import { useMemo, useState, useTransition, useDeferredValue } from 'react';
import { Filter, Search } from 'lucide-react';
import { GroupItemWrapper } from './group-item-wrapper';
import type { FeedData } from '../actions';
import { Spinner } from '../../../components/ui/spinner';

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

interface GroupListProps {
  initialGroups: Group[];
  signedIn: boolean;
}

// Enhanced individual group item with error boundary and progressive loading
function GroupItem({ group }: { group: Group }) {
  return <GroupItemWrapper group={group} />;
}

export function GroupList({ initialGroups, signedIn }: GroupListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'unread'>('all');
  const [isPending, startTransition] = useTransition();

  // Defer the search query for filtering to keep input responsive
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Handle search - update input immediately
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  // Handle filter change with transition
  const handleFilterChange = (newFilter: 'all' | 'active' | 'unread') => {
    startTransition(() => {
      setFilter(newFilter);
    });
  };

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

    // Apply search filter using deferred value
    if (deferredSearchQuery.trim()) {
      const query = deferredSearchQuery.toLowerCase();
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
  }, [sortedGroups, deferredSearchQuery, filter]);

  // Check if search is still processing
  const isSearchPending = searchQuery !== deferredSearchQuery;

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
              onChange={(e) => handleSearchChange(e.target.value)}
              className='w-full rounded-xs border border-neutral-200 bg-white py-2 pr-4 pl-10 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-neutral-600'
            />
            {(isPending || isSearchPending) && (
              <div className='absolute top-1/2 right-3 -translate-y-1/2'>
                <Spinner size='sm' />
              </div>
            )}
          </div>
        </div>

        <div className='flex flex-wrap gap-2 self-end'>
          <button
            onClick={() => handleFilterChange('all')}
            disabled={isPending}
            className={`cursor-pointer rounded-xs px-4 py-1.5 text-sm font-medium ${
              filter === 'all'
                ? `border border-neutral-200 bg-neutral-300 px-2 py-1 text-sm font-medium text-neutral-700 disabled:opacity-70 dark:border-neutral-600 dark:bg-neutral-600 dark:text-neutral-200`
                : `border border-neutral-200 bg-white px-2 py-1 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-70 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-600`
            }`}
          >
            All
          </button>
          <button
            onClick={() => handleFilterChange('active')}
            disabled={isPending}
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
              onClick={() => handleFilterChange('unread')}
              disabled={isPending}
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
          {/* Show loading overlay when filtering */}

          {priorityGroups.map((group) => (
            <div key={group.id}>
              <GroupItem group={group} />
            </div>
          ))}

          {/* Then render regular groups with staggered loading */}
          {regularGroups.map((group) => (
            <div key={group.id}>
              <GroupItem group={group} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
