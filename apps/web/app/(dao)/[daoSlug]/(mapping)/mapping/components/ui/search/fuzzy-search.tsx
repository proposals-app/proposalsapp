'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface FuzzySearchProps<T> {
  placeholder: string;
  onSearch: (term: string) => Promise<T[]>;
  onSelect: (item: T) => void;
  renderItem: (item: T) => React.ReactNode;
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
        return;
      }

      setSearchLoading(true);
      try {
        const results = await onSearch(term);
        setSearchResults(results);
        // Only show dropdown if we have results or a message to display
        setDropdownVisible(true);
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

    const timer = setTimeout(() => {
      handleSearch(searchTerm);
    }, 300); // Wait 300ms after typing stops

    return () => clearTimeout(timer);
  }, [searchTerm, handleSearch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
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
  }, []);

  const handleSelect = (item: T) => {
    onSelect(item);
    setSearchTerm('');
    setSearchResults([]);
    setDropdownVisible(false);
  };

  // Calculate position for the dropdown
  const getDropdownPosition = () => {
    if (!inputRef.current) return {};

    const rect = inputRef.current.getBoundingClientRect();
    const scrollX = window.scrollX || document.documentElement.scrollLeft;
    const scrollY = window.scrollY || document.documentElement.scrollTop;

    // Check if there's enough space below the input
    const spaceBelow = window.innerHeight - rect.bottom;
    const contentHeight = Math.min(searchResults.length * 38, 240); // Approximate height

    // Position above if not enough space below
    if (spaceBelow < contentHeight && rect.top > contentHeight) {
      return {
        bottom: window.innerHeight - rect.top - scrollY,
        left: rect.left + scrollX,
        maxWidth: containerRef.current?.offsetWidth,
      };
    }

    // Default position below
    return {
      top: rect.bottom + scrollY,
      left: rect.left + scrollX,
      maxWidth: containerRef.current?.offsetWidth,
    };
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        type='text'
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className='focus:ring-brand-accent focus:ring-opacity-50 w-full rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-900 shadow-sm focus:ring-2 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:shadow-neutral-950'
        disabled={isLoading}
        onFocus={() => {
          if (searchTerm.trim() && searchResults.length > 0) {
            setDropdownVisible(true);
          }
        }}
      />
      {dropdownVisible && (
        <div
          ref={dropdownRef}
          className='fixed z-50 mt-1 rounded-md border border-neutral-300 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900 dark:shadow-neutral-950'
          style={getDropdownPosition()}
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
            <ul className='scrollbar-thin scrollbar-thumb-rounded scrollbar-track-transparent scrollbar-thumb-neutral-400 dark:scrollbar-thumb-neutral-600 max-h-60 min-w-[300px] overflow-y-auto'>
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
