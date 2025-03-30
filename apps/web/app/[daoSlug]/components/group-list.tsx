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
  topicsCount: number;
  proposalsCount: number;
  votesCount: number;
  postsCount: number;
  resultCard: React.ReactNode | null;
}

interface GroupListProps {
  groups: Group[];
  signedIn: boolean;
}

export function GroupList({ groups, signedIn }: GroupListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'unread'>('all');

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

      case 'unread':
        filtered = filtered.filter((group) => group.hasNewActivity);
        break;
    }

    return filtered;
  }, [groups, searchQuery, filter]);

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
