'use client';

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { GroupItem } from './group-item';

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
}

interface GroupListProps {
  groups: Group[];
}

export function GroupList({ groups }: GroupListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;

    const query = searchQuery.toLowerCase();
    return groups.filter((group) => {
      const nameMatch = group.name.toLowerCase().includes(query);
      const authorMatch = group.authorName.toLowerCase().includes(query);
      return nameMatch || authorMatch;
    });
  }, [groups, searchQuery]);

  return (
    <div className='flex flex-col gap-4'>
      {/* Search Bar */}
      <div className='relative'>
        <div className='relative flex items-center'>
          <Search className='absolute left-3 h-5 w-5 text-neutral-400' />
          <input
            type='text'
            placeholder='Search by name or author...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='w-full border border-neutral-200 bg-white py-2 pr-4 pl-10 text-neutral-900
              placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-500
              focus:outline-none sm:w-80 dark:border-neutral-700 dark:bg-neutral-800
              dark:text-neutral-100'
          />
        </div>
      </div>

      {/* Groups List */}
      {filteredGroups.length === 0 ? (
        <p className='mt-2 text-sm text-neutral-500 dark:text-neutral-400'>
          No results found
        </p>
      ) : (
        <div className='space-y-4'>
          {filteredGroups.map((group) => (
            <GroupItem key={group.id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}

export const LoadingGroupList = () => {
  return (
    <div className='space-y-4'>
      {Array(12) // Adjust number of loading items as needed, 4 seems reasonable
        .fill(0)
        .map((_, index) => (
          <div
            key={index}
            className='flex space-x-4 border border-neutral-200 bg-neutral-50 p-4
              dark:border-neutral-700 dark:bg-neutral-900'
          >
            {/* Avatar Skeleton */}
            <div className='h-12 w-12 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700'></div>

            <div className='flex flex-col justify-center space-y-2'>
              {/* Group Name Skeleton */}
              <div className='h-6 w-64 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-700'></div>
              {/* Meta info line (Date, Counts) Skeleton */}
              <div className='flex space-x-2'>
                <div className='h-4 w-24 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-800'></div>
                <div className='h-4 w-16 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-800'></div>
              </div>
            </div>
          </div>
        ))}
    </div>
  );
};
