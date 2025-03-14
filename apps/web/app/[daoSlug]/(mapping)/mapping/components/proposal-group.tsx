'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import superjson from 'superjson';
import {
  deleteGroup,
  FuzzySearchResult,
  fuzzySearchItems,
  GroupsDataReturnType,
  ProposalGroup,
  ProposalGroupItem,
  saveGroups,
} from '../actions';

interface SerializedProps {
  serializedProps: string;
}

// Original props interface
interface GroupingProps {
  proposalGroups: GroupsDataReturnType['proposalGroups'];
  daoSlug: string;
  daoId: string;
}

/**
 * Component for managing proposal groups
 */
export default function GroupingInterface({
  serializedProps,
}: SerializedProps) {
  // Deserialize the props using SuperJSON
  const { proposalGroups, daoSlug, daoId }: GroupingProps =
    superjson.parse(serializedProps);

  // State management
  const [groups, setGroups] = useState<ProposalGroup[]>(() =>
    [...proposalGroups].sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
    )
  );

  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [searchResults, setSearchResults] = useState<FuzzySearchResult[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
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
   * Perform search and update results
   */
  const handleSearch = async (value: string) => {
    setSearchTerm(value);
    if (value.trim()) {
      try {
        const results = await fuzzySearchItems(value, daoSlug);
        const currentGroup = groups.find(
          (group) => group.id === editingGroupId
        );

        // Filter out items that are already in the group
        if (currentGroup) {
          setSearchResults(
            results.filter((result) => {
              const resultIdentifier = getItemIdentifier(result);
              return !currentGroup.items.some(
                (item) => getItemIdentifier(item) === resultIdentifier
              );
            })
          );
        } else {
          setSearchResults(results);
        }
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      }
    } else {
      setSearchResults([]);
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
   * Create a new group
   */
  const createNewGroup = async () => {
    if (!newGroupName.trim() || isLoading) return;

    setIsLoading(true);
    const newGroup: ProposalGroup = {
      id: uuidv4(),
      name: newGroupName.trim(),
      items: [],
      daoId: daoId,
      createdAt: new Date(),
    };

    try {
      // Save the new group immediately
      await saveGroupsToServer([newGroup]);

      // Update local state
      setGroups((prevGroups) => [newGroup, ...prevGroups]);
      setNewGroupName('');
      setEditingGroupName(newGroupName);
      setEditingGroupId(newGroup.id!);
    } catch (error) {
      console.error('Failed to create group:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Add search result item to a group
   */
  const addItemToGroup = async (groupId: string, item: FuzzySearchResult) => {
    if (isLoading) return;
    setIsLoading(true);

    // Create the proper group item structure
    let newItem: ProposalGroupItem;
    if (item.type === 'proposal') {
      newItem = {
        type: 'proposal',
        name: item.name,
        externalId: item.external_id || '',
        governorId: item.governor_id || '',
        indexerName: item.indexerName,
      };
    } else {
      newItem = {
        type: 'topic',
        name: item.name,
        externalId: item.external_id || '',
        daoDiscourseId: item.dao_discourse_id || '',
        indexerName: item.indexerName,
      };
    }

    // First update local state for immediate UI feedback
    const updatedGroups = groups.map((group) => {
      if (group.id === groupId) {
        return {
          ...group,
          items: [newItem, ...group.items],
        };
      }
      return group;
    });

    setGroups(updatedGroups);

    // Remove the added item from search results
    setSearchResults((prev) =>
      prev.filter(
        (result) => getItemIdentifier(result) !== getItemIdentifier(item)
      )
    );

    try {
      // Save updated groups to server
      await saveGroupsToServer(updatedGroups);
    } catch (error) {
      // Revert to previous state if save fails
      setGroups(groups);
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

    // First update local state for immediate UI feedback
    const updatedGroups = groups.map((group) =>
      group.id === groupId
        ? {
            ...group,
            items: group.items.filter(
              (item) => getItemIdentifier(item) !== itemIdentifier
            ),
          }
        : group
    );

    setGroups(updatedGroups);

    try {
      // Save updated groups to server
      await saveGroupsToServer(updatedGroups);
    } catch (error) {
      // Revert to previous state if save fails
      setGroups(groups);
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
    // First update local state for immediate UI feedback
    const updatedGroups = groups.map((group) =>
      group.id === groupId ? { ...group, name: newName.trim() } : group
    );

    setGroups(updatedGroups);

    try {
      // Save updated groups to server
      await saveGroupsToServer(updatedGroups);
      setEditingGroupId(null);
      setEditingGroupName('');
      setSearchTerm('');
      setSearchResults([]);
    } catch (error) {
      // Revert to previous state if save fails
      setGroups(groups);
      console.error('Failed to edit group:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Delete a group
   */
  const handleDeleteGroup = async (groupId: string) => {
    if (isLoading) return;

    if (window.confirm('Are you sure you want to delete this group?')) {
      setIsLoading(true);
      try {
        await deleteGroup(groupId);
        setGroups((prev) => prev.filter((group) => group.id !== groupId));

        if (editingGroupId === groupId) {
          setEditingGroupId(null);
          setEditingGroupName('');
          setSearchTerm('');
          setSearchResults([]);
        }
      } catch (error) {
        console.error('Failed to delete group:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Render the IndexerBadge component for items
  const renderIndexerBadge = (indexerName?: string) => {
    let bgColorClasses =
      'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300';

    if (indexerName) {
      if (indexerName.includes('SNAPSHOT')) {
        bgColorClasses =
          'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300';
      } else if (indexerName.includes('http')) {
        bgColorClasses =
          'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300';
      } else {
        bgColorClasses =
          'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300';
      }
    }

    return (
      <span
        className={`rounded-full px-2 py-1 text-xs font-medium ${bgColorClasses}`}
      >
        {indexerName || 'unknown'}
      </span>
    );
  };

  // Render the TypeBadge component for items
  const renderTypeBadge = (type: 'proposal' | 'topic') => (
    <span
      className={`rounded-full px-2 py-1 text-xs font-medium ${
        type === 'proposal'
          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
          : 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300'
        }`}
    >
      {type === 'proposal' ? 'Proposal' : 'Discussion'}
    </span>
  );

  return (
    <div className='space-y-6'>
      {/* Create new group form */}
      <div
        className='rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-700
          dark:bg-neutral-800 dark:shadow-md'
      >
        <div
          className='flex items-center justify-between border-b border-neutral-200 p-4
            dark:border-neutral-700'
        >
          <h3 className='text-lg font-semibold text-neutral-900 dark:text-neutral-100'>
            Create New Group
          </h3>
        </div>
        <div className='p-4'>
          <div className='flex space-x-4'>
            <input
              type='text'
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder='New group name'
              className='focus:ring-brand-accent focus:ring-opacity-50 w-full rounded-md border
                border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-900 shadow-sm
                focus:ring-2 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100
                dark:shadow-neutral-950'
              disabled={isLoading}
            />
            <button
              onClick={createNewGroup}
              className={`border-brand-accent bg-brand-accent hover:bg-brand-accent-darker
                focus:ring-brand-accent focus:ring-opacity-50 w-48 rounded-md border px-4 py-2
                text-sm font-medium text-white transition-colors focus:ring-2
                disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800
                dark:text-neutral-100 dark:hover:bg-neutral-700 ${
                isLoading || !newGroupName.trim()
                    ? 'cursor-not-allowed opacity-50'
                    : ''
                }`}
              disabled={isLoading || !newGroupName.trim()}
            >
              {isLoading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </div>
      </div>

      {/* Groups list */}
      {groups.length === 0 ? (
        <div className='p-8 text-center text-neutral-500 dark:text-neutral-400'>
          No groups found. Create your first group above.
        </div>
      ) : (
        <div
          className='overflow-x-auto rounded-lg border border-neutral-200 bg-white
            dark:border-neutral-700 dark:bg-neutral-800'
        >
          <table className='min-w-full table-auto border-collapse'>
            <thead className='bg-neutral-100 dark:bg-neutral-800'>
              <tr>
                <th
                  className='border-b border-neutral-200 px-6 py-3 text-left text-sm font-semibold
                    text-neutral-900 dark:border-neutral-700 dark:text-neutral-100'
                >
                  Group Name
                </th>
                <th
                  className='border-b border-neutral-200 px-6 py-3 text-left text-sm font-semibold
                    text-neutral-900 dark:border-neutral-700 dark:text-neutral-100'
                >
                  Items
                </th>
                <th
                  className='border-b border-neutral-200 px-6 py-3 text-left text-sm font-semibold
                    text-neutral-900 dark:border-neutral-700 dark:text-neutral-100'
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr
                  key={group.id}
                  className='border-b border-neutral-200 dark:border-neutral-700'
                >
                  <td className='px-6 py-4 font-medium text-neutral-900 dark:text-neutral-100'>
                    {editingGroupId === group.id ? (
                      <input
                        type='text'
                        value={editingGroupName}
                        onChange={(e) => setEditingGroupName(e.target.value)}
                        className='focus:ring-brand-accent focus:ring-opacity-50 w-full rounded-md border
                          border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-900 shadow-sm
                          focus:ring-2 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100
                          dark:shadow-neutral-950'
                        disabled={isLoading}
                      />
                    ) : (
                      <Link
                        href={`/${group.id}`}
                        target='_blank'
                        className='hover:underline'
                      >
                        {group.name}
                      </Link>
                    )}
                  </td>
                  <td className='px-6 py-4'>
                    {editingGroupId === group.id ? (
                      <div className='space-y-3'>
                        {/* List of current items */}
                        <div className='mb-2'>
                          <div className='mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300'>
                            Current Items ({group.items.length})
                          </div>
                          <div className='max-h-60 overflow-y-auto'>
                            <ul className='flex flex-col gap-2'>
                              {group.items.length > 0 ? (
                                group.items.map((item) => (
                                  <li
                                    key={getItemIdentifier(item)}
                                    className='flex items-start justify-between rounded-md border border-neutral-200
                                      bg-neutral-100 p-2 dark:border-neutral-700 dark:bg-neutral-700'
                                  >
                                    <div className='flex flex-1 flex-wrap items-start gap-2 pr-2'>
                                      <div className='flex-shrink-0'>
                                        {renderTypeBadge(item.type)}
                                      </div>
                                      <div className='flex-shrink-0'>
                                        {renderIndexerBadge(item.indexerName)}
                                      </div>
                                      <span className='break-words text-neutral-900 dark:text-neutral-100'>
                                        {item.name}
                                      </span>
                                    </div>
                                    <button
                                      onClick={() =>
                                        removeItemFromGroup(
                                          group.id!,
                                          getItemIdentifier(item)
                                        )
                                      }
                                      className={`focus:ring-opacity-50 mt-0 ml-2 flex-shrink-0 rounded-md bg-red-500 px-3 py-1
                                        text-xs text-white transition-colors hover:bg-red-600 focus:ring-2
                                        focus:ring-red-500 disabled:opacity-50 ${
                                        isLoading
                                            ? 'cursor-not-allowed opacity-50'
                                            : ''
                                        }`}
                                      disabled={isLoading}
                                    >
                                      Remove
                                    </button>
                                  </li>
                                ))
                              ) : (
                                <p className='p-2 text-center text-neutral-500 dark:text-neutral-400'>
                                  No items in this group yet.
                                </p>
                              )}
                            </ul>
                          </div>
                        </div>

                        {/* Search box */}
                        <div className='space-y-2'>
                          <label
                            htmlFor={`search-${group.id}`}
                            className='block text-sm font-medium text-neutral-700 dark:text-neutral-300'
                          >
                            Search for items to add
                          </label>
                          <input
                            id={`search-${group.id}`}
                            type='text'
                            value={searchTerm}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder='Search proposals and discussions...'
                            className='focus:ring-brand-accent focus:ring-opacity-50 w-full rounded-md border
                              border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-900 shadow-sm
                              focus:ring-2 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100
                              dark:shadow-neutral-950'
                            disabled={isLoading}
                          />
                        </div>

                        {/* Search results */}
                        {searchTerm && (
                          <div
                            className='rounded-md border border-neutral-200 bg-neutral-50 dark:border-neutral-700
                              dark:bg-neutral-800'
                          >
                            <h3 className='mb-2 px-4 pt-4 font-medium text-neutral-900 dark:text-neutral-100'>
                              Search Results
                            </h3>
                            {searchResults.length === 0 ? (
                              <p className='px-4 py-2 text-center text-neutral-500 dark:text-neutral-400'>
                                {isLoading
                                  ? 'Searching...'
                                  : 'No matching items found'}
                              </p>
                            ) : (
                              <ul className='max-h-60 space-y-1 overflow-y-auto px-2 pb-2'>
                                {searchResults.map((item) => (
                                  <li
                                    key={getItemIdentifier(item)}
                                    className='focus:ring-opacity-50 flex cursor-pointer items-start justify-between rounded-md
                                      p-2 transition-colors hover:bg-neutral-100 focus:ring-2 focus:ring-neutral-500
                                      dark:hover:bg-neutral-700'
                                    onClick={() =>
                                      !isLoading &&
                                      addItemToGroup(group.id!, item)
                                    }
                                  >
                                    <div className='flex flex-1 flex-wrap items-start gap-2 pr-2'>
                                      <div className='flex-shrink-0'>
                                        {renderTypeBadge(item.type)}
                                      </div>
                                      <div className='flex-shrink-0'>
                                        {renderIndexerBadge(item.indexerName)}
                                      </div>
                                      <span className='break-words text-neutral-900 dark:text-neutral-100'>
                                        {item.name}
                                      </span>
                                    </div>
                                    <span
                                      className='mt-0 ml-2 flex-shrink-0 rounded-full bg-red-100 px-2 py-1 text-xs text-red-800
                                        dark:bg-red-900/40 dark:text-red-300'
                                    >
                                      {item.score.toFixed(2)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className='max-h-48 overflow-y-auto'>
                        {group.items.length === 0 ? (
                          <p className='text-sm text-neutral-500 dark:text-neutral-400'>
                            No items
                          </p>
                        ) : (
                          <div className='flex flex-col gap-2'>
                            {group.items.map((item) => (
                              <div
                                key={getItemIdentifier(item)}
                                className='flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-100 p-2
                                  text-xs dark:border-neutral-700 dark:bg-neutral-700'
                              >
                                <div className='flex-shrink-0'>
                                  {renderTypeBadge(item.type)}
                                </div>
                                <div className='flex-shrink-0'>
                                  {renderIndexerBadge(item.indexerName)}
                                </div>
                                <span
                                  className='max-w-[200px] truncate text-neutral-900 dark:text-neutral-100'
                                  title={item.name}
                                >
                                  {item.name}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className='px-6 py-4 text-sm font-medium'>
                    {editingGroupId === group.id ? (
                      <div className='flex gap-2'>
                        <button
                          onClick={() => editGroup(group.id!, editingGroupName)}
                          className={`border-brand-accent bg-brand-accent hover:bg-brand-accent-darker
                            focus:ring-brand-accent focus:ring-opacity-50 w-full rounded-md border px-4 py-2
                            text-sm font-medium text-white transition-colors focus:ring-2
                            disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800
                            dark:text-neutral-100 dark:hover:bg-neutral-700 ${
                            isLoading || !editingGroupName.trim()
                                ? 'cursor-not-allowed opacity-50'
                                : ''
                            }`}
                          disabled={isLoading || !editingGroupName.trim()}
                        >
                          {isLoading ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingGroupId(null);
                            setEditingGroupName('');
                            setSearchTerm('');
                            setSearchResults([]);
                          }}
                          className='focus:ring-opacity-50 w-full rounded-md border border-neutral-300 bg-white px-4
                            py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-100
                            focus:ring-2 focus:ring-neutral-500 disabled:opacity-50 dark:border-neutral-600
                            dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700'
                          disabled={isLoading}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className='flex gap-2'>
                        <button
                          onClick={() => {
                            setEditingGroupName(group.name);
                            setEditingGroupId(group.id!);
                            setSearchTerm('');
                            setSearchResults([]);
                          }}
                          className={`border-brand-accent bg-brand-accent hover:bg-brand-accent-darker
                            focus:ring-brand-accent focus:ring-opacity-50 w-full rounded-md border px-4 py-2
                            text-sm font-medium text-white transition-colors focus:ring-2
                            disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800
                            dark:text-neutral-100 dark:hover:bg-neutral-700 ${
                            isLoading ? 'cursor-not-allowed opacity-50' : '' }`}
                          disabled={isLoading}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(group.id!)}
                          className={`focus:ring-opacity-50 w-full rounded-md border border-red-500 bg-red-500 px-4
                            py-2 text-sm font-medium text-white transition-colors hover:bg-red-600
                            focus:ring-2 focus:ring-red-500 disabled:opacity-50 dark:border-red-700
                            dark:bg-red-500 dark:hover:bg-red-600`}
                          disabled={isLoading}
                        >
                          {isLoading ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
