'use client';

import { Selectable, Voter } from '@proposalsapp/db';
import { fuzzySearchVoters } from '../../../delegates/actions';
import FuzzySearch from './fuzzy-search';
import Badge from '../badge';

interface FuzzyVoterSearchProps {
  excludeVoterIds?: string[];
  onSelectVoter: (voter: Selectable<Voter>) => void;
  isLoading?: boolean;
  className?: string;
}

const FuzzyVoterSearch: React.FC<FuzzyVoterSearchProps> = ({
  excludeVoterIds = [],
  onSelectVoter,
  isLoading,
  className,
}) => {
  const handleSearch = async (term: string) => {
    return await fuzzySearchVoters(term, excludeVoterIds);
  };

  return (
    <FuzzySearch<Selectable<Voter>>
      placeholder='Search voters...'
      onSearch={handleSearch}
      onSelect={onSelectVoter}
      isLoading={isLoading}
      noResultsMessage='No voters found'
      searchingMessage='Searching voters...'
      className={className}
      renderItem={(voter) => (
        <div className='flex flex-col gap-1'>
          <div className='flex items-center gap-2'>
            <span className='truncate font-mono text-sm text-neutral-900 dark:text-neutral-100'>
              {voter.address}
            </span>
            <Badge variant='blue'>Voter</Badge>
          </div>
          {voter.ens && (
            <div className='text-xs text-neutral-500 dark:text-neutral-400'>
              {voter.ens}
            </div>
          )}
        </div>
      )}
    />
  );
};

export default FuzzyVoterSearch;
