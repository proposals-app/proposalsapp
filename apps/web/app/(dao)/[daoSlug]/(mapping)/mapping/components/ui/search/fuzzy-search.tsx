'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface FuzzySearchProps<T> {
  placeholder: string;
  onSearch: (_term: string) => Promise<T[]>;
  onSelect: (_item: T) => void;
  renderItem: (_item: T) => React.ReactNode;
  isLoading?: boolean;
  noResultsMessage?: string;
  searchingMessage?: string;
  className?: string;
}

/**
 * A reusable fuzzy search component with improved overlay positioning
 */
export const FuzzySearch = <T extends object>({
  placeholder,
  onSearch,
  onSelect,
  renderItem,
  isLoading = false,
  noResultsMessage = 'No results found',
  searchingMessage = 'Searching...',
  className = '',
}: FuzzySearchProps<T>) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<T[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSearch = useCallback(
    async (term: string) => {
      if (!term.trim()) {
        setSearchResults([]);
        setDropdownVisible(false);
        return;
      }

      setSearchLoading(true);
      try {
        console.log(`Executing search for term: "${term}"`);
        const results = await onSearch(term);
        console.log(`Search returned ${results.length} results`, results);

        setSearchResults(results);
        // Always show dropdown with results or no results message
        setDropdownVisible(true);

        // Force a re-render to ensure the dropdown is visible
        setTimeout(() => {
          if (results.length > 0) {
            console.log(
              'Search results available, ensuring dropdown is visible'
            );
            setDropdownVisible(true);
          }
        }, 0);
      } catch (error) {
        console.error('Search failed', error);
        setSearchResults([]);
        setDropdownVisible(true); // Show dropdown with error message
      } finally {
        setSearchLoading(false);
      }
    },
    [onSearch]
  );

  // Debounce search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setDropdownVisible(false);
      return;
    }

    // Always show dropdown with loading state when typing
    setDropdownVisible(true);
    setSearchLoading(true);

    // Log that we're searching
    console.log(`Searching for: "${searchTerm}"`);

    const timer = setTimeout(() => {
      handleSearch(searchTerm);
    }, 300); // Wait 300ms after typing stops

    return () => clearTimeout(timer);
  }, [searchTerm, handleSearch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Only handle click outside if the dropdown is visible
      if (
        dropdownVisible &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setSearchTerm('');
        setSearchResults([]);
        setDropdownVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownVisible]);

  const handleSelect = (item: T) => {
    onSelect(item);
    setSearchTerm('');
    setSearchResults([]);
    setDropdownVisible(false);
  };

  // We don't need a complex position calculation anymore
  // The dropdown will be positioned using CSS classes instead

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        type='text'
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className='w-full rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-900 shadow-sm focus:ring-2 focus:ring-brand-accent focus:ring-opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:shadow-neutral-950'
        disabled={isLoading}
        onFocus={() => {
          // Show dropdown on focus if there's a search term
          if (searchTerm.trim()) {
            setDropdownVisible(true);
            // Re-run search if we have a term but no results yet
            if (searchResults.length === 0 && !searchLoading) {
              handleSearch(searchTerm);
            }
          }
        }}
      />
      {dropdownVisible && (
        <div
          ref={dropdownRef}
          className='absolute left-0 top-full z-[9999] mt-1 w-full overflow-hidden rounded-md border border-neutral-300 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900 dark:shadow-neutral-950'
          style={{ maxHeight: '300px' }}
        >
          {searchLoading ? (
            <p className='px-4 py-2 text-center text-neutral-500 dark:text-neutral-400'>
              {searchingMessage}
            </p>
          ) : searchResults.length === 0 ? (
            <p className='px-4 py-2 text-center text-neutral-500 dark:text-neutral-400'>
              {noResultsMessage}
            </p>
          ) : (
            <ul className='scrollbar-thin scrollbar-thumb-rounded scrollbar-track-transparent scrollbar-thumb-neutral-400 dark:scrollbar-thumb-neutral-600 max-h-60 overflow-y-auto py-1'>
              {searchResults.map((item, index) => (
                <li
                  key={index}
                  className='cursor-pointer px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  onClick={() => handleSelect(item)}
                >
                  {renderItem(item)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default FuzzySearch;
