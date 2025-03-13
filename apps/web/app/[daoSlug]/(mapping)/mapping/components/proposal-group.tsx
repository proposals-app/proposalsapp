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
    let bgColorClasses = 'bg-gray-100 dark:bg-gray-700';

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
          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
        }`}
    >
      {type === 'proposal' ? 'Proposal' : 'Discussion'}
    </span>
  );

  return (
    <div className='space-y-6'>
      {/* Create new group form */}
      <div className='flex space-x-4'>
        <input
          type='text'
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          placeholder='New group name'
          className='grow rounded-md border border-neutral-300 bg-white p-2 text-neutral-900
            dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100'
          disabled={isLoading}
        />
        <button
          onClick={createNewGroup}
          className={`rounded-md border border-neutral-300 bg-white px-4 py-2 text-neutral-900
            dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 ${
            isLoading || !newGroupName.trim()
                ? 'cursor-not-allowed opacity-50'
                : 'hover:bg-neutral-100 dark:hover:bg-neutral-700'
            }`}
          disabled={isLoading || !newGroupName.trim()}
        >
          {isLoading ? 'Creating...' : 'Create Group'}
        </button>
      </div>

      {/* Groups list */}
      {groups.length === 0 ? (
        <div className='p-8 text-center text-neutral-500 dark:text-neutral-400'>
          No groups found. Create your first group above.
        </div>
      ) : (
        groups.map((group) => (
          <div
            key={group.id}
            className='rounded-lg border border-neutral-300 bg-white shadow-xs dark:border-neutral-600
              dark:bg-neutral-800'
          >
            {/* Group header */}
            <div
              className='flex items-center justify-between border-b border-neutral-300 p-4
                dark:border-neutral-600'
            >
              <h2 className='text-lg font-semibold text-neutral-900 dark:text-neutral-100'>
                {editingGroupId === group.id ? (
                  <input
                    type='text'
                    value={editingGroupName}
                    onChange={(e) => setEditingGroupName(e.target.value)}
                    className='w-64 rounded-md border border-neutral-300 bg-white p-2 text-neutral-900
                      dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100'
                    disabled={isLoading}
                  />
                ) : (
                  <Link
                    href={`/${group.id}`}
                    target='_blank'
                    className='flex items-center gap-2 text-neutral-900 hover:underline dark:text-neutral-100'
                  >
                    {group.name}
                  </Link>
                )}
              </h2>
              <div className='flex space-x-2'>
                {editingGroupId === group.id ? (
                  <button
                    onClick={() => editGroup(group.id!, editingGroupName)}
                    className={`h-8 w-32 rounded-md border border-neutral-300 bg-white px-3 py-1
                      text-neutral-900 dark:border-neutral-600 dark:bg-neutral-700
                      dark:text-neutral-100 ${
                      isLoading || !editingGroupName.trim()
                          ? 'cursor-not-allowed opacity-50'
                          : 'hover:bg-neutral-100 dark:hover:bg-neutral-600'
                      }`}
                    disabled={isLoading || !editingGroupName.trim()}
                  >
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditingGroupName(group.name);
                        setEditingGroupId(group.id!);
                        setSearchTerm('');
                        setSearchResults([]);
                      }}
                      className={`h-8 w-32 rounded-md border border-neutral-300 bg-white px-3 py-1
                        text-neutral-900 dark:border-neutral-600 dark:bg-neutral-700
                        dark:text-neutral-100 ${
                        isLoading
                            ? 'cursor-not-allowed opacity-50'
                            : 'hover:bg-neutral-100 dark:hover:bg-neutral-600'
                        }`}
                      disabled={isLoading}
                    >
                      Edit Group
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(group.id!)}
                      className={`h-8 w-32 rounded-md border border-red-300 bg-white px-3 py-1 text-red-600
                        dark:border-red-700 dark:bg-neutral-700 dark:text-red-400 ${
                        isLoading
                            ? 'cursor-not-allowed opacity-50'
                            : 'hover:bg-red-50 dark:hover:bg-red-900/20'
                        }`}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Deleting...' : 'Delete Group'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Group content */}
            <div className='p-4'>
              {editingGroupId === group.id ? (
                // Editing mode
                <>
                  {/* List of current items */}
                  <ul className='mb-4 space-y-2'>
                    {group.items.length > 0 ? (
                      group.items.map((item) => (
                        <li
                          key={getItemIdentifier(item)}
                          className='flex items-center justify-between rounded-md border border-neutral-300 bg-white
                            p-2 dark:border-neutral-600 dark:bg-neutral-700'
                        >
                          <span className='flex items-center gap-2 truncate'>
                            {renderTypeBadge(item.type)}
                            {renderIndexerBadge(item.indexerName)}
                            <span className='truncate text-neutral-900 dark:text-neutral-100'>
                              {item.name}
                            </span>
                          </span>
                          <button
                            onClick={() =>
                              removeItemFromGroup(
                                group.id!,
                                getItemIdentifier(item)
                              )
                            }
                            className={`ml-2 shrink-0 rounded-md bg-red-500 px-2 py-1 text-white hover:bg-red-600
                              dark:bg-red-700 dark:hover:bg-red-600 ${
                              isLoading ? 'cursor-not-allowed opacity-50' : '' }`}
                            disabled={isLoading}
                          >
                            Remove
                          </button>
                        </li>
                      ))
                    ) : (
                      <p className='text-center text-neutral-500 dark:text-neutral-400'>
                        No items in this group yet. Search below to add items.
                      </p>
                    )}
                  </ul>

                  {/* Search box */}
                  <div className='mb-4'>
                    <label
                      htmlFor={`search-${group.id}`}
                      className='mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300'
                    >
                      Search for items to add
                    </label>
                    <input
                      id={`search-${group.id}`}
                      type='text'
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                      placeholder='Search proposals and discussions...'
                      className='w-full rounded-md border border-neutral-300 bg-white p-2 text-neutral-900
                        dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100'
                      disabled={isLoading}
                    />
                  </div>

                  {/* Search results */}
                  {searchTerm && (
                    <div
                      className='dark:bg-neutral-750 rounded-md border border-neutral-300 bg-neutral-50 p-2
                        dark:border-neutral-600'
                    >
                      <h3 className='mb-2 font-medium text-neutral-900 dark:text-neutral-100'>
                        Search Results
                      </h3>
                      {searchResults.length === 0 ? (
                        <p className='p-2 text-center text-neutral-500 dark:text-neutral-400'>
                          {isLoading
                            ? 'Searching...'
                            : 'No matching items found'}
                        </p>
                      ) : (
                        <ul className='max-h-60 space-y-2 overflow-y-auto'>
                          {searchResults.map((item) => (
                            <li
                              key={getItemIdentifier(item)}
                              className={`flex items-center gap-2 rounded-md p-2 ${
                                isLoading
                                  ? 'cursor-not-allowed opacity-50'
                                  : 'cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700'
                                }`}
                              onClick={() =>
                                !isLoading && addItemToGroup(group.id!, item)
                              }
                            >
                              {renderTypeBadge(item.type)}
                              {renderIndexerBadge(item.indexerName)}
                              <span className='flex-1 truncate text-neutral-900 dark:text-neutral-100'>
                                {item.name}
                              </span>
                              <span
                                className='rounded-full bg-red-100 px-2 py-1 text-xs text-red-800 dark:bg-red-900/40
                                  dark:text-red-300'
                              >
                                {item.score.toFixed(2)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </>
              ) : (
                // View mode
                <>
                  {group.items.length === 0 ? (
                    <p className='p-2 text-center text-neutral-500 dark:text-neutral-400'>
                      No items in this group
                    </p>
                  ) : (
                    <ul className='space-y-2'>
                      {group.items.map((item) => (
                        <li
                          key={getItemIdentifier(item)}
                          className='flex items-center gap-2 rounded-md border border-neutral-300 bg-white p-2
                            dark:border-neutral-600 dark:bg-neutral-700'
                        >
                          {renderTypeBadge(item.type)}
                          {renderIndexerBadge(item.indexerName)}
                          <span className='truncate text-neutral-900 dark:text-neutral-100'>
                            {item.name}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
