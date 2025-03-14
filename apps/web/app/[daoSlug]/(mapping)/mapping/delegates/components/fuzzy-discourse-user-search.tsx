'use client';

import { Selectable, DiscourseUser } from '@proposalsapp/db-indexer';
import { fuzzySearchDiscourseUsers } from '../actions';
import { useState, useCallback, useEffect } from 'react';

interface FuzzyDiscourseUserSearchProps {
  daoSlug: string;
  excludeUserIds?: string[];
  onSelectUser: (user: Selectable<DiscourseUser>) => void;
  isLoading: boolean;
}

const FuzzyDiscourseUserSearch: React.FC<FuzzyDiscourseUserSearchProps> = ({
  daoSlug,
  excludeUserIds = [],
  onSelectUser,
  isLoading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<
    Selectable<DiscourseUser>[]
  >([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const handleSearch = useCallback(
    async (term: string) => {
      if (!term.trim()) {
        setSearchResults([]);
        return;
      }

      setSearchLoading(true);
      try {
        const results = await fuzzySearchDiscourseUsers(
          daoSlug,
          term,
          excludeUserIds
        );
        setSearchResults(results);
      } catch (error) {
        console.error('Discourse user search failed', error);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    },
    [daoSlug, excludeUserIds]
  );

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchTerm);
    }, 300); // Wait 300ms after typing stops

    return () => clearTimeout(timer); // Clear timeout on unmount or searchTerm change
  }, [searchTerm, handleSearch]);

  const selectUser = (user: Selectable<DiscourseUser>) => {
    onSelectUser(user);
    setSearchTerm('');
    setSearchResults([]); // Clear results after selection
  };

  return (
    <div>
      <input
        type='text'
        placeholder='Search Discourse Users...'
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className='w-full rounded-md border border-neutral-300 bg-white p-2 text-neutral-900
          dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100'
        disabled={isLoading}
      />

      {searchTerm.trim() && (
        <div
          className='dark:bg-neutral-750 mt-1 rounded-md border border-neutral-300 bg-neutral-50 p-2
            dark:border-neutral-600'
        >
          {searchLoading ? (
            <p className='p-2 text-center text-neutral-500 dark:text-neutral-400'>
              Searching...
            </p>
          ) : searchResults.length === 0 ? (
            <p className='p-2 text-center text-neutral-500 dark:text-neutral-400'>
              No users found
            </p>
          ) : (
            <ul className='max-h-48 overflow-y-auto'>
              {searchResults.map((user) => (
                <li
                  key={user.id}
                  className='cursor-pointer rounded-md p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                  onClick={() => selectUser(user)}
                >
                  {user.username}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default FuzzyDiscourseUserSearch;
