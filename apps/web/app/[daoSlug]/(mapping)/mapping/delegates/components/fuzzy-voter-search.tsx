'use client';

import { Selectable, Voter } from '@proposalsapp/db-indexer';
import { fuzzySearchVoters } from '../actions';
import { useState, useCallback, useEffect } from 'react';

interface FuzzyVoterSearchProps {
  daoSlug: string;
  excludeVoterIds?: string[];
  onSelectVoter: (voter: Selectable<Voter>) => void;
  isLoading: boolean;
}

const FuzzyVoterSearch: React.FC<FuzzyVoterSearchProps> = ({
  daoSlug,
  excludeVoterIds = [],
  onSelectVoter,
  isLoading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Selectable<Voter>[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const handleSearch = useCallback(
    async (term: string) => {
      if (!term.trim()) {
        setSearchResults([]);
        return;
      }

      setSearchLoading(true);
      try {
        const results = await fuzzySearchVoters(daoSlug, term, excludeVoterIds);
        setSearchResults(results);
      } catch (error) {
        console.error('Voter search failed', error);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    },
    [daoSlug, excludeVoterIds]
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
    <div>
      <input
        type='text'
        placeholder='Search Voters...'
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
              No voters found
            </p>
          ) : (
            <ul className='max-h-48 overflow-y-auto'>
              {searchResults.map((voter) => (
                <li
                  key={voter.id}
                  className='cursor-pointer rounded-md p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                  onClick={() => selectVoter(voter)}
                >
                  {voter.address}
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
