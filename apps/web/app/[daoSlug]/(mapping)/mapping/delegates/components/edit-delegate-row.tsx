'use client';

import {
  Selectable,
  Delegate,
  DiscourseUser,
  Voter,
} from '@proposalsapp/db-indexer';
import { useState } from 'react';
import {
  mapDiscourseUserToDelegate,
  mapVoterToDelegate,
  unmapDiscourseUserFromDelegate,
  unmapVoterFromDelegate,
  deleteDelegate,
} from '../actions';
import FuzzyDiscourseUserSearch from './fuzzy-discourse-user-search';
import FuzzyVoterSearch from './fuzzy-voter-search';
import { useTransition } from 'react';

interface EditDelegateRowProps {
  delegate: Selectable<Delegate>;
  discourseUsers: Selectable<DiscourseUser>[];
  voters: Selectable<Voter>[];
  daoSlug: string;
  onCancel: () => void;
}

export const EditDelegateRow: React.FC<EditDelegateRowProps> = ({
  delegate,
  discourseUsers,
  voters,
  daoSlug,
  onCancel,
}) => {
  const [currentDiscourseUsers, setCurrentDiscourseUsers] =
    useState<Selectable<DiscourseUser>[]>(discourseUsers);
  const [currentVoters, setCurrentVoters] =
    useState<Selectable<Voter>[]>(voters);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleDeleteDelegate = async () => {
    if (
      window.confirm(
        'Are you sure you want to delete this delegate and all its mappings?'
      )
    ) {
      setIsDeleting(true);
      try {
        await deleteDelegate(delegate.id);
        // Optimistically remove the row from the UI, or re-fetch the data
        onCancel(); // For simplicity, just close the edit row which will trigger re-fetch on page level
      } catch (error) {
        console.error('Error deleting delegate:', error);
        setIsDeleting(false);
      }
    }
  };

  const handleMapDiscourseUser = async (
    discourseUser: Selectable<DiscourseUser>
  ) => {
    setIsSaving(true);
    try {
      await mapDiscourseUserToDelegate(delegate.id, discourseUser.id);
      setCurrentDiscourseUsers([...currentDiscourseUsers, discourseUser]);
    } catch (error) {
      console.error('Error mapping discourse user:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnmapDiscourseUser = async (discourseUserId: string) => {
    setIsSaving(true);
    try {
      await unmapDiscourseUserFromDelegate(delegate.id, discourseUserId);
      setCurrentDiscourseUsers(
        currentDiscourseUsers.filter((user) => user.id !== discourseUserId)
      );
    } catch (error) {
      console.error('Error unmapping discourse user:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMapVoter = async (voter: Selectable<Voter>) => {
    setIsSaving(true);
    try {
      await mapVoterToDelegate(delegate.id, voter.id);
      setCurrentVoters([...currentVoters, voter]);
    } catch (error) {
      console.error('Error mapping voter:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnmapVoter = async (voterId: string) => {
    setIsSaving(true);
    try {
      await unmapVoterFromDelegate(delegate.id, voterId);
      setCurrentVoters(currentVoters.filter((v) => v.id !== voterId));
    } catch (error) {
      console.error('Error unmapping voter:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <tr className='border-b border-neutral-200 transition-colors dark:border-neutral-700'>
      <td
        className='px-6 py-4 text-sm font-medium whitespace-nowrap text-neutral-900
          dark:text-neutral-100'
      >
        {delegate.id}
      </td>
      <td className='px-6 py-4'>
        <div className='space-y-2'>
          {currentDiscourseUsers.map((user) => (
            <div
              className='flex items-center justify-between rounded-md bg-neutral-100 p-2
                dark:bg-neutral-700'
              key={user.id}
            >
              <span className='text-sm text-neutral-900 dark:text-neutral-100'>
                {user.username}
              </span>{' '}
              <button
                onClick={() => handleUnmapDiscourseUser(user.id)}
                className='focus:ring-opacity-50 rounded-md bg-red-500 px-3 py-1 text-xs text-white
                  transition-colors hover:bg-red-600 focus:ring-2 focus:ring-red-500
                  disabled:opacity-50'
                disabled={isSaving || isDeleting}
              >
                Unmap
              </button>
            </div>
          ))}
          <FuzzyDiscourseUserSearch
            daoSlug={daoSlug}
            excludeUserIds={currentDiscourseUsers.map((user) => user.id)}
            onSelectUser={handleMapDiscourseUser}
            isLoading={isSaving || isDeleting}
          />
        </div>
      </td>
      <td className='px-6 py-4'>
        <div className='space-y-2'>
          {currentVoters.map((voter) => (
            <div
              className='flex items-center justify-between rounded-md bg-neutral-100 p-2
                dark:bg-neutral-700'
              key={voter.id}
            >
              <div className='text-sm text-neutral-900 dark:text-neutral-100'>
                <div>{voter.address}</div>
                {voter.ens && (
                  <div className='text-xs text-neutral-500 dark:text-neutral-400'>
                    {voter.ens}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleUnmapVoter(voter.id)}
                className='focus:ring-opacity-50 rounded-md bg-red-500 px-3 py-1 text-xs text-white
                  transition-colors hover:bg-red-600 focus:ring-2 focus:ring-red-500
                  disabled:opacity-50'
                disabled={isSaving || isDeleting}
              >
                Unmap
              </button>
            </div>
          ))}
          <FuzzyVoterSearch
            daoSlug={daoSlug}
            excludeVoterIds={currentVoters.map((voter) => voter.id)}
            onSelectVoter={handleMapVoter}
            isLoading={isSaving || isDeleting}
          />
        </div>
      </td>
      <td className='px-6 py-4 text-sm font-medium whitespace-nowrap'>
        <div className='flex gap-2'>
          <button
            onClick={onCancel}
            className='focus:ring-opacity-50 w-full rounded-md border border-neutral-300 bg-white px-4
              py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-100
              focus:ring-2 focus:ring-neutral-500 disabled:opacity-50 dark:border-neutral-600
              dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700'
            disabled={isSaving || isDeleting}
          >
            Close
          </button>
          <button
            onClick={handleDeleteDelegate}
            className='focus:ring-opacity-50 w-full rounded-md border border-red-500 bg-red-500 px-4
              py-2 text-sm font-medium text-white transition-colors hover:bg-red-600
              focus:ring-2 focus:ring-red-500 disabled:opacity-50'
            disabled={isSaving || isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </td>
    </tr>
  );
};

export const DelegateRow = ({
  delegate,
  discourseUsers,
  voters,
  daoSlug,
}: {
  delegate: Selectable<Delegate>;
  discourseUsers: Selectable<DiscourseUser>[];
  voters: Selectable<Voter>[];
  daoSlug: string;
}) => {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <EditDelegateRow
        delegate={delegate}
        discourseUsers={discourseUsers}
        voters={voters}
        daoSlug={daoSlug}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  return (
    <tr
      key={delegate.id}
      className='border-b border-neutral-200 transition-colors dark:border-neutral-700'
    >
      <td
        className='px-6 py-4 text-sm font-medium whitespace-nowrap text-neutral-900
          dark:text-neutral-100'
      >
        {delegate.id}
      </td>
      <td className='px-6 py-4'>
        <div className='space-y-2'>
          {discourseUsers.map((user) => (
            <div
              className='text-sm text-neutral-900 dark:text-neutral-100'
              key={user.id}
            >
              {user.username}
            </div>
          ))}
        </div>
      </td>
      <td className='px-6 py-4'>
        <div className='space-y-2'>
          {voters.map((voter) => (
            <div
              className='text-sm text-neutral-900 dark:text-neutral-100'
              key={voter.id}
            >
              <div className='font-mono'>{voter.address}</div>
              {voter.ens && (
                <div className='text-xs text-neutral-500 dark:text-neutral-400'>
                  {voter.ens}
                </div>
              )}
            </div>
          ))}
        </div>
      </td>
      <td className='px-6 py-4 text-sm font-medium whitespace-nowrap'>
        <button
          onClick={() => setIsEditing(true)}
          className='focus:ring-opacity-50 border-brand-accent bg-brand-accent
            hover:bg-brand-accent-darker focus:ring-brand-accent w-full rounded-md border
            px-4 py-2 text-sm font-medium text-white transition-colors focus:ring-2
            disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800
            dark:text-neutral-100 dark:hover:bg-neutral-700'
        >
          Edit Mappings
        </button>
      </td>
    </tr>
  );
};
