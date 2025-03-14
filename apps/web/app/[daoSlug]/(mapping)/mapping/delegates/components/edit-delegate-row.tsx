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
} from '../actions';
import FuzzyDiscourseUserSearch from './fuzzy-discourse-user-search';
import FuzzyVoterSearch from './fuzzy-voter-search';

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
    <tr className='border-b border-neutral-200 dark:border-neutral-800'>
      <td className='px-4 py-2'>{delegate.id}</td>
      <td className='px-4 py-2'>
        {currentDiscourseUsers.map((user) => (
          <div
            className='mb-1 flex items-center justify-between gap-2 rounded-md bg-neutral-100 p-2
              dark:bg-neutral-700'
            key={user.id}
          >
            {user.username}
            <button
              onClick={() => handleUnmapDiscourseUser(user.id)}
              className='rounded-md bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600'
              disabled={isSaving}
            >
              Unmap
            </button>
          </div>
        ))}
        <FuzzyDiscourseUserSearch
          daoSlug={daoSlug}
          excludeUserIds={currentDiscourseUsers.map((user) => user.id)}
          onSelectUser={handleMapDiscourseUser}
          isLoading={isSaving}
        />
      </td>
      <td className='px-4 py-2'>
        {currentVoters.map((voter) => (
          <div
            className='mb-1 flex items-center justify-between gap-2 rounded-md bg-neutral-100 p-2
              dark:bg-neutral-700'
            key={voter.id}
          >
            {voter.address}
            <button
              onClick={() => handleUnmapVoter(voter.id)}
              className='rounded-md bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600'
              disabled={isSaving}
            >
              Unmap
            </button>
          </div>
        ))}
        <FuzzyVoterSearch
          daoSlug={daoSlug}
          excludeVoterIds={currentVoters.map((voter) => voter.id)}
          onSelectVoter={handleMapVoter}
          isLoading={isSaving}
        />
      </td>
      <td className='px-4 py-2'>
        <div className='flex gap-2'>
          <button
            onClick={onCancel}
            className='w-full rounded-md border border-neutral-300 bg-white px-3 py-1 text-neutral-900
              hover:bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800
              dark:text-neutral-100 dark:hover:bg-neutral-700'
            disabled={isSaving}
          >
            Close
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
      className='border-b border-neutral-200 dark:border-neutral-800'
    >
      <td className='px-4 py-2'>{delegate.id}</td>
      <td className='px-4 py-2'>
        {discourseUsers.map((user) => (
          <div className='flex items-center gap-2' key={user.id}>
            {user.username}
          </div>
        ))}
      </td>
      <td className='px-4 py-2'>
        {voters.map((voter) => (
          <div className='flex flex-col gap-1' key={voter.id}>
            <div>{voter.address}</div>
            {voter.ens && (
              <div className='text-sm text-neutral-500 dark:text-neutral-400'>
                {voter.ens}
              </div>
            )}
          </div>
        ))}
      </td>
      <td className='px-4 py-2'>
        <button
          onClick={() => setIsEditing(true)}
          className='w-full rounded-md border border-neutral-300 bg-white px-3 py-1 text-neutral-900
            hover:bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800
            dark:text-neutral-100 dark:hover:bg-neutral-700'
        >
          Edit Mappings
        </button>
      </td>
    </tr>
  );
};
