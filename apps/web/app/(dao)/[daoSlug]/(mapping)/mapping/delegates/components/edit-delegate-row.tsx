'use client';

import type {
  Delegate,
  DiscourseUser,
  Selectable,
  Voter,
} from '@proposalsapp/db';
import { useState } from 'react';
import {
  deleteDelegate,
  mapDiscourseUserToDelegate,
  mapVoterToDelegate,
  unmapDiscourseUserFromDelegate,
  unmapVoterFromDelegate,
} from '../actions';
import {
  FuzzyDiscourseUserSearch,
  FuzzyVoterSearch,
} from '../../components/ui/search';
import {
  Badge,
  Button,
  MappingTableActionCell,
  MappingTableCell,
  MappingTableRow,
} from '../../components/ui';

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
    <MappingTableRow>
      <MappingTableCell>
        <Badge variant='neutral'>{delegate.id}</Badge>
      </MappingTableCell>
      <MappingTableCell>
        <div className='space-y-2'>
          <div className='mb-2 flex items-center justify-between'>
            <h4 className='font-medium text-neutral-900 dark:text-neutral-100'>
              Discourse Users ({currentDiscourseUsers?.length || 0}):
            </h4>
          </div>
          <div className='max-h-[300px] overflow-y-auto'>
            {currentDiscourseUsers.length > 0 ? (
              <div className='divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-700 dark:border-neutral-700'>
                {currentDiscourseUsers.map((user) => (
                  <div
                    className='flex items-center justify-between p-2 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    key={user.id}
                  >
                    <span className='text-sm text-neutral-900 dark:text-neutral-100'>
                      {user.username}
                    </span>
                    <Button
                      onClick={() => handleUnmapDiscourseUser(user.id)}
                      variant='danger'
                      disabled={isSaving || isDeleting}
                      className='h-8 min-w-[80px] shrink-0 px-2 py-0'
                    >
                      Unmap
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className='py-2 text-center text-neutral-500 dark:text-neutral-400'>
                No discourse users mapped
              </div>
            )}
          </div>
          <FuzzyDiscourseUserSearch
            daoSlug={daoSlug}
            excludeUserIds={currentDiscourseUsers.map((user) => user.id)}
            onSelectUser={handleMapDiscourseUser}
            isLoading={isSaving || isDeleting}
          />
        </div>
      </MappingTableCell>
      <MappingTableCell>
        <div className='space-y-2'>
          <div className='mb-2 flex items-center justify-between'>
            <h4 className='font-medium text-neutral-900 dark:text-neutral-100'>
              Voters ({currentVoters?.length || 0}):
            </h4>
          </div>
          <div className='max-h-[300px] overflow-y-auto'>
            {currentVoters.length > 0 ? (
              <div className='divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-700 dark:border-neutral-700'>
                {currentVoters.map((voter) => (
                  <div
                    className='flex items-center justify-between p-2 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    key={voter.id}
                  >
                    <div className='overflow-hidden text-sm text-neutral-900 dark:text-neutral-100'>
                      <div className='truncate font-mono' title={voter.address}>
                        {voter.address}
                      </div>
                      {voter.ens && (
                        <div
                          className='truncate text-xs text-neutral-500 dark:text-neutral-400'
                          title={voter.ens}
                        >
                          {voter.ens}
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={() => handleUnmapVoter(voter.id)}
                      variant='danger'
                      disabled={isSaving || isDeleting}
                      className='ml-2 h-8 min-w-[80px] shrink-0 px-2 py-0'
                    >
                      Unmap
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className='py-2 text-center text-neutral-500 dark:text-neutral-400'>
                No voters mapped
              </div>
            )}
          </div>
          <FuzzyVoterSearch
            excludeVoterIds={currentVoters.map((voter) => voter.id)}
            onSelectVoter={handleMapVoter}
            isLoading={isSaving || isDeleting}
          />
        </div>
      </MappingTableCell>
      <MappingTableActionCell>
        <div className='flex flex-wrap gap-2'>
          <Button
            onClick={onCancel}
            variant='outline'
            disabled={isSaving || isDeleting}
            className='min-w-[80px]'
          >
            Close
          </Button>
          <Button
            onClick={handleDeleteDelegate}
            variant='danger'
            disabled={isSaving || isDeleting}
            isLoading={isDeleting}
            className='min-w-[80px]'
          >
            Delete
          </Button>
        </div>
      </MappingTableActionCell>
    </MappingTableRow>
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
    <MappingTableRow key={delegate.id}>
      <MappingTableCell>
        <Badge variant='neutral'>{delegate.id}</Badge>
      </MappingTableCell>
      <MappingTableCell>
        <div>
          {discourseUsers.length > 0 ? (
            <div>
              <div className='mb-2 flex items-center gap-2'>
                <span className='text-sm font-medium text-neutral-600 dark:text-neutral-400'>
                  {discourseUsers.length} user
                  {discourseUsers.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className='max-h-[200px] overflow-y-auto'>
                <div className='divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-700 dark:border-neutral-700'>
                  {discourseUsers.map((user) => (
                    <div
                      className='flex items-center p-2 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                      key={user.id}
                    >
                      <span className='text-sm text-neutral-900 dark:text-neutral-100'>
                        {user.username}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className='text-sm text-neutral-500 dark:text-neutral-400'>
              No discourse users mapped
            </div>
          )}
        </div>
      </MappingTableCell>
      <MappingTableCell>
        <div>
          {voters.length > 0 ? (
            <div>
              <div className='mb-2 flex items-center gap-2'>
                <span className='text-sm font-medium text-neutral-600 dark:text-neutral-400'>
                  {voters.length} voter{voters.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className='max-h-[200px] overflow-y-auto'>
                <div className='divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-700 dark:border-neutral-700'>
                  {voters.map((voter) => (
                    <div
                      className='p-2 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                      key={voter.id}
                    >
                      <div
                        className='truncate font-mono text-xs text-neutral-900 dark:text-neutral-100'
                        title={voter.address}
                      >
                        {voter.address}
                      </div>
                      {voter.ens && (
                        <div
                          className='truncate text-xs text-neutral-500 dark:text-neutral-400'
                          title={voter.ens}
                        >
                          {voter.ens}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className='text-sm text-neutral-500 dark:text-neutral-400'>
              No voters mapped
            </div>
          )}
        </div>
      </MappingTableCell>
      <MappingTableActionCell>
        <Button
          onClick={() => setIsEditing(true)}
          variant='primary'
          className='min-w-[120px]'
        >
          Edit Mappings
        </Button>
      </MappingTableActionCell>
    </MappingTableRow>
  );
};
