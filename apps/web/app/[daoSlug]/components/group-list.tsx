'use client';

import { useState, useMemo } from 'react';
import { Search, Filter } from 'lucide-react';
import { InactiveGroupItem } from './group-items/inactive-item';
import { DiscussionGroupItem } from './group-items/discussion-item';

interface Group {
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
  resultCard: React.ReactNode | null;
}

interface GroupListProps {
  groups: Group[];
}

export function GroupList({ groups }: GroupListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<
    'all' | 'active' | 'proposals' | 'discussions'
  >('all');

  const filteredGroups = useMemo(() => {
    let filtered = groups;

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
      case 'proposals':
        filtered = filtered.filter((group) => group.proposalsCount > 0);
        break;
      case 'discussions':
        filtered = filtered.filter(
          (group) => !group.hasActiveProposal && group.proposalsCount === 0
        );
        break;
    }

    return filtered;
  }, [groups, searchQuery, filter]);

  return (
    <div className='flex flex-col gap-6'>
      {/* Search and Filter Bar */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='relative w-full sm:w-64'>
          <div className='relative flex items-center'>
            <Search className='absolute left-3 h-5 w-5 text-neutral-400' />
            <input
              type='text'
              placeholder='Search by name or author...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='w-full border border-neutral-200 bg-white py-2 pr-4 pl-10 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-neutral-600'
            />
          </div>
        </div>

        <div className='flex flex-wrap gap-2'>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-800'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === 'active'
                ? 'bg-green-700 text-white dark:bg-green-700 dark:text-white'
                : 'bg-neutral-100 text-green-700 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-green-400 dark:hover:bg-neutral-600'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilter('proposals')}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === 'proposals'
                ? 'bg-blue-700 text-white dark:bg-blue-700 dark:text-white'
                : 'bg-neutral-100 text-blue-700 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-blue-400 dark:hover:bg-neutral-600'
            }`}
          >
            Proposals
          </button>
          <button
            onClick={() => setFilter('discussions')}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === 'discussions'
                ? 'bg-neutral-800 text-white dark:bg-neutral-600 dark:text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600'
            }`}
          >
            Discussions
          </button>
        </div>
      </div>

      {/* Groups List */}
      {filteredGroups.length === 0 ? (
        <div className='flex flex-col items-center justify-center border border-neutral-200 bg-white p-8 text-center dark:border-neutral-700 dark:bg-neutral-800'>
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
          {filteredGroups.map((group) =>
            group.hasActiveProposal ? (
              <div key={group.id}>{group.resultCard}</div>
            ) : group.proposalsCount > 0 ? (
              <div key={group.id}>
                <InactiveGroupItem group={group} />
              </div>
            ) : (
              <div key={group.id}>
                <DiscussionGroupItem group={group} />
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

export const LoadingGroupList = () => {
  return (
    <div className='space-y-4'>
      {Array(6)
        .fill(0)
        .map((_, index) => (
          <LoadingGroupItem key={index} />
        ))}
    </div>
  );
};

export const LoadingGroupItem = () => {
  return (
    <div className='flex space-x-4 border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900'>
      {/* Avatar Skeleton */}
      <div className='h-12 w-12 animate-pulse bg-neutral-200 dark:bg-neutral-700'></div>

      <div className='flex w-full flex-col justify-center space-y-2'>
        {/* Group Name Skeleton */}
        <div className='h-6 w-full max-w-64 animate-pulse bg-neutral-200 dark:bg-neutral-700'></div>
        {/* Meta info line (Date, Counts) Skeleton */}
        <div className='flex flex-wrap gap-2'>
          <div className='h-4 w-24 animate-pulse bg-neutral-100 dark:bg-neutral-800'></div>
          <div className='h-4 w-16 animate-pulse bg-neutral-100 dark:bg-neutral-800'></div>
          <div className='h-4 w-20 animate-pulse bg-neutral-100 dark:bg-neutral-800'></div>
        </div>
      </div>
    </div>
  );
};
