'use client';

import { Selectable, Voter } from '@proposalsapp/db';
import { fuzzySearchVoters } from '../actions';
import { useState, useCallback, useEffect, useRef } from 'react';

interface FuzzyVoterSearchProps {
  excludeVoterIds?: string[];
  onSelectVoter: (voter: Selectable<Voter>) => void;
  isLoading: boolean;
}

const FuzzyVoterSearch: React.FC<FuzzyVoterSearchProps> = ({
  excludeVoterIds = [],
  onSelectVoter,
  isLoading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Selectable<Voter>[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(
    async (term: string) => {
      if (!term.trim()) {
        setSearchResults([]);
        return;
      }

      setSearchLoading(true);
      try {
        const results = await fuzzySearchVoters(term, excludeVoterIds);
        setSearchResults(results);
      } catch (error) {
        console.error('Voter search failed', error);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    },
    [excludeVoterIds]
  );

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchTerm);
    }, 300); // Wait 300ms after typing stops

    return () => clearTimeout(timer); // Clear timeout on unmount or searchTerm change
  }, [searchTerm, handleSearch]);

  const selectVoter = (voter: Selectable<Voter>) => {
    onSelectVoter(voter);
    setSearchTerm('');
    setSearchResults([]); // Clear results after selection
  };

  return (
    <div className='relative'>
      {' '}
      {/* Make this div relative */}
      <input
        ref={inputRef}
        type='text'
        placeholder='Search Voters...'
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className='focus:ring-brand-accent focus:ring-opacity-50 w-full rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-900 shadow-sm focus:ring-2 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:shadow-neutral-950'
        disabled={isLoading}
      />
      {searchTerm.trim() && (
        <div
          ref={dropdownRef}
          className='absolute top-full left-0 z-10 mt-1 w-full rounded-md border border-neutral-300 bg-white shadow-md dark:border-neutral-700 dark:bg-neutral-900 dark:shadow-neutral-950' /* Absolute positioning */
          style={{ zIndex: 10 }}
        >
          {searchLoading ? (
            <p className='px-4 py-2 text-center text-neutral-500 dark:text-neutral-400'>
              Searching...
            </p>
          ) : searchResults.length === 0 ? (
            <p className='px-4 py-2 text-center text-neutral-500 dark:text-neutral-400'>
              No voters found
            </p>
          ) : (
            <ul className='scrollbar-thin scrollbar-thumb-rounded scrollbar-track-transparent scrollbar-thumb-neutral-400 dark:scrollbar-thumb-neutral-600 max-h-48 overflow-y-auto'>
              {searchResults.map((voter) => (
                <li
                  key={voter.id}
                  className='flex cursor-pointer flex-col px-4 py-2 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800'
                  onClick={() => selectVoter(voter)}
                >
                  {voter.address}
                  {voter.ens && (
                    <div className='text-xs text-neutral-500 dark:text-neutral-400'>
                      {voter.ens}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default FuzzyVoterSearch;
