'use client';

import { FuzzySearchResult, fuzzySearchItems } from '../../../actions';
import FuzzySearch from './fuzzy-search';
import Badge from '../badge';

interface FuzzyItemSearchProps {
  daoSlug: string;
  excludeItems?: string[];
  onSelectItem: (item: FuzzySearchResult) => void;
  isLoading?: boolean;
  className?: string;
}

const FuzzyItemSearch: React.FC<FuzzyItemSearchProps> = ({
  daoSlug,
  excludeItems = [],
  onSelectItem,
  isLoading,
  className,
}) => {
  const handleSearch = async (term: string) => {
    const results = await fuzzySearchItems(term, daoSlug);

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
