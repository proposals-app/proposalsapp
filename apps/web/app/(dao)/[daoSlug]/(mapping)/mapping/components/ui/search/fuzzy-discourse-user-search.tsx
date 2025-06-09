'use client';

import type { DiscourseUser, Selectable } from '@proposalsapp/db';
import { fuzzySearchDiscourseUsers } from '../../../delegates/actions';
import FuzzySearch from './fuzzy-search';
import Badge from '../badge';

interface FuzzyDiscourseUserSearchProps {
  daoSlug: string;
  excludeUserIds?: string[];
  onSelectUser: (_user: Selectable<DiscourseUser>) => void;
  isLoading?: boolean;
  className?: string;
}

const FuzzyDiscourseUserSearch: React.FC<FuzzyDiscourseUserSearchProps> = ({
  daoSlug,
  excludeUserIds = [],
  onSelectUser,
  isLoading,
  className,
}) => {
  const handleSearch = async (term: string) => {
    return await fuzzySearchDiscourseUsers(daoSlug, term, excludeUserIds);
  };

  return (
    <FuzzySearch<Selectable<DiscourseUser>>
      placeholder='Search Discourse Users...'
      onSearch={handleSearch}
      onSelect={onSelectUser}
      isLoading={isLoading}
      noResultsMessage='No users found'
      searchingMessage='Searching users...'
      className={className}
      renderItem={(user) => (
        <div className='flex items-center gap-2'>
          <span className='text-sm font-medium text-neutral-900 dark:text-neutral-100'>
            {user.username}
          </span>
          <Badge variant='neutral'>Discourse User</Badge>
        </div>
      )}
    />
  );
};

export default FuzzyDiscourseUserSearch;
