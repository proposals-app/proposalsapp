'use client';

import type { FuzzySearchResult } from '../../../api-contract';
import { callMappingApi } from '../../../api-client';
import FuzzySearch from './fuzzy-search';
import { Badge } from '@/app/components/ui/badge';

interface FuzzyItemSearchProps {
  excludeItems?: string[];
  onSelectItem: (_item: FuzzySearchResult) => void;
  isLoading?: boolean;
  className?: string;
}

const FuzzyItemSearch: React.FC<FuzzyItemSearchProps> = ({
  excludeItems = [],
  onSelectItem,
  isLoading,
  className,
}) => {
  const handleSearch = async (term: string) => {
    const results = await callMappingApi<FuzzySearchResult[]>({
      operation: 'groups.search',
      query: term,
    });

    // Filter out items that are already in the group if excludeItems is provided
    if (excludeItems.length > 0) {
      return results.filter(
        (item) => !excludeItems.includes(getItemIdentifier(item))
      );
    }

    return results;
  };

  // Helper function to get a unique identifier for an item
  const getItemIdentifier = (item: FuzzySearchResult): string => {
    if (item.type === 'proposal') {
      return `proposal-${item.external_id}-${item.governor_id}`;
    } else if (item.type === 'topic') {
      return `topic-${item.external_id}-${item.dao_discourse_id}`;
    }
    return `unknown-${item.name}`;
  };

  return (
    <FuzzySearch<FuzzySearchResult>
      placeholder='Search proposals and topics...'
      onSearch={handleSearch}
      onSelect={onSelectItem}
      isLoading={isLoading}
      noResultsMessage='No items found'
      searchingMessage='Searching items...'
      className={className}
      renderItem={(item) => (
        <div className='flex items-center gap-2 truncate'>
          <span className='flex-1 truncate text-sm text-neutral-900 dark:text-neutral-100'>
            {item.name}
          </span>
          <div className='flex-shrink-0'>
            <Badge variant={item.type === 'proposal' ? 'green' : 'purple'}>
              {item.type === 'proposal' ? 'Proposal' : 'Topic'}
            </Badge>
          </div>
          {item.indexerName && (
            <div className='flex-shrink-0'>
              <Badge variant='blue'>{item.indexerName}</Badge>
            </div>
          )}
        </div>
      )}
    />
  );
};

export default FuzzyItemSearch;
