'use client';

import { useCallback, useState } from 'react';
import superjson from 'superjson';
import {
  deleteGroup,
  saveGroups,
  type FuzzySearchResult,
  type GroupsDataReturnType,
  type ProposalGroup,
  type ProposalGroupItem,
} from '../actions';
import {
  Badge,
  Button,
  MappingTable,
  MappingTableActionCell,
  MappingTableCell,
  MappingTableRow,
} from './ui';
import { FuzzyItemSearch } from './ui/search';

interface SerializedProps {
  serializedProps: string;
}

// Original props interface
interface GroupingProps {
  proposalGroups: GroupsDataReturnType['proposalGroups'];
  daoSlug: string;
}

/**
 * Component for managing proposal groups
 */
export default function GroupingInterface({
  serializedProps,
}: SerializedProps) {
  // Deserialize the props using SuperJSON
  const { proposalGroups, daoSlug }: GroupingProps =
    superjson.parse(serializedProps);

  // State management
  const [groups, setGroups] = useState<ProposalGroup[]>(() =>
    [...proposalGroups].sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
    )
  );
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Helper function to get a unique identifier for an item
  const getItemIdentifier = useCallback(
    (item: ProposalGroupItem | FuzzySearchResult): string => {
      if (item.type === 'proposal') {
        // Handle both ProposalItem and FuzzySearchResult formats
        const externalId =
          'externalId' in item ? item.externalId : item.external_id;
        const governorId =
          'governorId' in item ? item.governorId : item.governor_id;
        return `proposal-${externalId}-${governorId}`;
      } else if (item.type === 'topic') {
        // Handle both TopicItem and FuzzySearchResult formats
        const externalId =
          'externalId' in item ? item.externalId : item.external_id;
        const daoDiscourseId =
          'daoDiscourseId' in item
            ? item.daoDiscourseId
            : item.dao_discourse_id;
        return `topic-${externalId}-${daoDiscourseId}`;
      }
      return `unknown-${item.name}`; // Fallback
    },
    []
  );

  /**
   * Handle item selection from fuzzy search
   */
  const handleItemSelect = (item: FuzzySearchResult) => {
    if (editingGroupId) {
      addItemToGroup(editingGroupId, item);
    }
  };

  /**
   * Save groups to the server
   */
  const saveGroupsToServer = useCallback(
    async (groupsToSave: ProposalGroup[]) => {
      setIsLoading(true);
      try {
        // Ensure all dates are in ISO string format
        const formattedGroups = groupsToSave.map((group) => ({
          ...group,
          createdAt: group.createdAt,
        }));

        await saveGroups(formattedGroups);
      } catch (error) {
        console.error('Failed to save groups:', error);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Add search result item to a group
   */
  const addItemToGroup = async (groupId: string, item: FuzzySearchResult) => {
    if (isLoading) return;

    const currentGroup = groups.find((g) => g.id === groupId);
    if (!currentGroup) return;

    // Check if item already exists in the group
    const itemIdentifier = getItemIdentifier(item);
    const itemExists = currentGroup.items.some(
      (i) => getItemIdentifier(i) === itemIdentifier
    );

    if (itemExists) {
      console.log('Item already exists in the group');
      return;
    }

    // Convert FuzzySearchResult to the appropriate ProposalGroupItem type
    let newItem: ProposalGroupItem;

    if (item.type === 'proposal') {
      // Create a proposal item specifically
      newItem = {
        externalId: item.external_id!,
        governorId: item.governor_id!,
        indexerName: item.indexerName,
        type: 'proposal', // Explicitly set as 'proposal' to match the expected type
        name: item.name,
      };
    } else if (item.type === 'topic') {
      // Create a topic item specifically
      newItem = {
        externalId: item.external_id!,
        daoDiscourseId: item.dao_discourse_id!,
        indexerName: item.indexerName,
        type: 'topic', // Explicitly set as 'topic' to match the expected type
        name: item.name,
      };
    } else {
      console.error('Unknown item type:', item.type);
      return;
    }

    setIsLoading(true);

    // Add item to group
    const updatedGroups = groups.map((group) => {
      if (group.id === groupId) {
        return {
          ...group,
          items: [...group.items, newItem],
        };
      }
      return group;
    });

    try {
      // Save the updated group
      const groupToUpdate = updatedGroups.find((g) => g.id === groupId);
      if (groupToUpdate) {
        await saveGroupsToServer([groupToUpdate]);
      }

      // Update local state
      setGroups(updatedGroups);
    } catch (error) {
      console.error('Failed to add item to group:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Remove an item from a group
   */
  const removeItemFromGroup = async (
    groupId: string,
    itemIdentifier: string
  ) => {
    if (isLoading) return;

    setIsLoading(true);

    // Remove item from group
    const updatedGroups = groups.map((group) => {
      if (group.id === groupId) {
        return {
          ...group,
          items: group.items.filter(
            (item) => getItemIdentifier(item) !== itemIdentifier
          ),
        };
      }
      return group;
    });

    try {
      // Save the updated group
      const groupToUpdate = updatedGroups.find((g) => g.id === groupId);
      if (groupToUpdate) {
        await saveGroupsToServer([groupToUpdate]);
      }

      // Update local state
      setGroups(updatedGroups);
    } catch (error) {
      console.error('Failed to remove item from group:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Update a group's name
   */
  const editGroup = async (groupId: string, newName: string) => {
    if (!newName.trim() || isLoading) return;

    setIsLoading(true);

    // Update group name
    const updatedGroups = groups.map((group) => {
      if (group.id === groupId) {
        return {
          ...group,
          name: newName.trim(),
        };
      }
      return group;
    });

    try {
      // Save the updated group
      const groupToUpdate = updatedGroups.find((g) => g.id === groupId);
      if (groupToUpdate) {
        await saveGroupsToServer([groupToUpdate]);
      }

      // Update local state
      setGroups(updatedGroups);
      setEditingGroupId(null);
      setEditingGroupName('');
    } catch (error) {
      console.error('Failed to update group name:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Delete a group
   */
  const handleDeleteGroup = async (groupId: string) => {
    if (isLoading) return;

    if (
      !window.confirm(
        'Are you sure you want to delete this group? This action cannot be undone.'
      )
    ) {
      return;
    }

    setIsLoading(true);

    try {
      // Delete the group from the server
      await deleteGroup(groupId);

      // Update local state
      setGroups((prevGroups) =>
        prevGroups.filter((group) => group.id !== groupId)
      );
    } catch (error) {
      console.error('Failed to delete group:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Render badge for item indexer
   */
  const renderIndexerBadge = (indexerName?: string) => {
    if (!indexerName) return null;

    return <Badge variant='blue'>{indexerName}</Badge>;
  };

  /**
   * Render badge for item type
   */
  const renderTypeBadge = (type: 'proposal' | 'topic') => {
    return (
      <Badge variant={type === 'proposal' ? 'green' : 'purple'}>
        {type === 'proposal' ? 'Proposal' : 'Topic'}
      </Badge>
    );
  };

  return (
    <div>
      {/* Groups table */}
      {groups.length > 0 ? (
        <MappingTable
          headers={['Group', 'Items', 'Actions']}
          className='mb-6'
          emptyState={
            <div className='py-8 text-center'>
              <p className='text-neutral-500 dark:text-neutral-400'>
                No proposal groups found
              </p>
              <p className='mt-1 text-sm text-neutral-400 dark:text-neutral-500'>
                Create a group above to get started
              </p>
            </div>
          }
        >
          {groups.map((group) => (
            <MappingTableRow key={group.id}>
              <MappingTableCell>
                {editingGroupId === group.id ? (
                  <div className='flex flex-col space-y-4'>
                    <div className='mb-2'>
                      <input
                        type='text'
                        className='w-full rounded-md border border-neutral-300 px-4 py-2 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-neutral-400'
                        placeholder='Group Name'
                        value={editingGroupName}
                        onChange={(e) => setEditingGroupName(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                ) : (
                  <div className='font-medium text-neutral-900 dark:text-neutral-100'>
                    {group.name}
                  </div>
                )}
              </MappingTableCell>
              <MappingTableCell>
                {editingGroupId === group.id ? (
                  <div className='space-y-2'>
                    <div className='flex items-center justify-between'>
                      <h4 className='font-medium text-neutral-900 dark:text-neutral-100'>
                        Items in Group ({group.items?.length || 0}):
                      </h4>
                    </div>
                    {group.items && group.items.length > 0 ? (
                      <div className='max-h-[300px] overflow-y-auto rounded-md border border-neutral-200 dark:border-neutral-700'>
                        <ul className='divide-y divide-neutral-200 dark:divide-neutral-700'>
                          {group.items.map((item) => (
                            <li
                              key={getItemIdentifier(item)}
                              className='flex flex-col p-2 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                            >
                              <div className='mb-2 flex min-w-0 flex-col gap-1'>
                                <div className='mb-1 flex flex-wrap gap-1'>
                                  <div className='flex-shrink-0'>
                                    {renderTypeBadge(item.type)}
                                  </div>
                                  <div className='flex-shrink-0'>
                                    {renderIndexerBadge(item.indexerName)}
                                  </div>
                                </div>
                                <span
                                  className='break-words text-neutral-900 dark:text-neutral-100'
                                  title={item.name}
                                >
                                  {item.name}
                                </span>
                              </div>
                              <div className='flex justify-end'>
                                <Button
                                  onClick={() =>
                                    removeItemFromGroup(
                                      group.id!,
                                      getItemIdentifier(item)
                                    )
                                  }
                                  variant='danger'
                                  className='h-8 min-w-[80px] shrink-0 px-2 py-0'
                                  disabled={isLoading}
                                >
                                  Remove
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className='text-center text-neutral-500 dark:text-neutral-400'>
                        No items in this group yet.
                      </p>
                    )}

                    {/* Fuzzy search to add items */}
                    <FuzzyItemSearch
                      daoSlug={daoSlug}
                      excludeItems={group.items.map(getItemIdentifier)}
                      onSelectItem={handleItemSelect}
                      isLoading={isLoading}
                    />
                  </div>
                ) : (
                  <div className='text-neutral-900 dark:text-neutral-100'>
                    {group.items && group.items.length > 0 ? (
                      <div>
                        <div className='mb-2 flex items-center gap-2'>
                          <span className='text-sm font-medium text-neutral-600 dark:text-neutral-400'>
                            {group.items.length} item
                            {group.items.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className='max-h-[250px] overflow-y-auto p-1'>
                          <div className='divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-700 dark:border-neutral-700'>
                            {group.items.map((item) => (
                              <div
                                key={getItemIdentifier(item)}
                                className='p-2 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                              >
                                <div className='flex min-w-0 flex-col gap-1'>
                                  <div className='mb-1 flex flex-wrap gap-1'>
                                    <div className='flex-shrink-0'>
                                      {renderTypeBadge(item.type)}
                                    </div>
                                    <div className='flex-shrink-0'>
                                      {renderIndexerBadge(item.indexerName)}
                                    </div>
                                  </div>
                                  <span
                                    className='break-words text-neutral-900 dark:text-neutral-100'
                                    title={item.name}
                                  >
                                    {item.name}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className='text-center text-neutral-500 dark:text-neutral-400'>
                        No items in this group yet.
                      </p>
                    )}
                  </div>
                )}
              </MappingTableCell>
              <MappingTableActionCell>
                {editingGroupId === group.id ? (
                  <div className='flex flex-wrap gap-2'>
                    <Button
                      onClick={() => editGroup(group.id!, editingGroupName)}
                      variant='primary'
                      disabled={isLoading || !editingGroupName.trim()}
                      isLoading={isLoading && editingGroupName.trim() !== ''}
                      className='min-w-[80px]'
                    >
                      Save
                    </Button>
                    <Button
                      onClick={() => {
                        setEditingGroupId(null);
                        setEditingGroupName('');
                      }}
                      variant='outline'
                      disabled={isLoading}
                      className='min-w-[80px]'
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className='flex flex-wrap gap-2'>
                    <Button
                      onClick={() => {
                        setEditingGroupName(group.name);
                        setEditingGroupId(group.id!);
                      }}
                      variant='primary'
                      disabled={isLoading}
                      className='min-w-[80px]'
                    >
                      Edit
                    </Button>
                    <Button
                      onClick={() => handleDeleteGroup(group.id!)}
                      variant='danger'
                      disabled={isLoading}
                      isLoading={isLoading}
                      className='min-w-[80px]'
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </MappingTableActionCell>
            </MappingTableRow>
          ))}
        </MappingTable>
      ) : (
        <div className='mb-6 rounded-lg border border-neutral-200 p-8 text-center dark:border-neutral-700'>
          <p className='text-neutral-500 dark:text-neutral-400'>
            No proposal groups found
          </p>
          <p className='mt-1 text-sm text-neutral-400 dark:text-neutral-500'>
            Create a group above to get started
          </p>
        </div>
      )}
    </div>
  );
}
