'use client';

import { ExternalLinkIcon } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  deleteGroup,
  FuzzyItem,
  fuzzySearchItems,
  ProposalGroup,
  saveGroups,
} from '../actions';

interface GroupingInterfaceProps {
  initialGroups?: ProposalGroup[];
  daoSlug: string;
}

export default function GroupingInterface({
  initialGroups = [],
  daoSlug,
}: GroupingInterfaceProps) {
  const [groups, setGroups] = useState<ProposalGroup[]>(() =>
    [...initialGroups].sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
    )
  );

  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [searchResults, setSearchResults] = useState<FuzzyItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [shouldSaveGroups, setShouldSaveGroups] = useState(false);

  const handleSearch = async (value: string) => {
    setSearchTerm(value);
    if (value.trim()) {
      const results = await fuzzySearchItems(value, daoSlug);
      const currentGroup = groups.find((group) => group.id === editingGroupId);
      setSearchResults(
        currentGroup
          ? results.filter(
              (result) =>
                !currentGroup.items.some((item) => item.id === result.id)
            )
          : results
      );
    } else {
      setSearchResults([]);
    }
  };

  const createNewGroup = () => {
    if (newGroupName.trim()) {
      const newGroup: ProposalGroup = {
        id: uuidv4(),
        name: newGroupName,
        items: [],
        createdAt: new Date().toISOString(),
      };
      setGroups([newGroup, ...groups]);
      setNewGroupName('');
      setEditingGroupName(newGroupName);
      setEditingGroupId(newGroup.id!);
      setShouldSaveGroups(true);
    }
  };

  const addItemToGroup = (groupId: string, item: FuzzyItem) => {
    setGroups((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? { ...group, items: [item, ...group.items] }
          : group
      )
    );
    setSearchResults((prev) => prev.filter((result) => result.id !== item.id));
    setShouldSaveGroups(true);
  };

  const removeItemFromGroup = (groupId: string, itemId: string) => {
    setGroups((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? {
              ...group,
              items: group.items.filter((item) => item.id !== itemId),
            }
          : group
      )
    );
    setShouldSaveGroups(true);
  };

  const editGroup = (groupId: string, newName: string) => {
    setGroups((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? { ...group, name: newName.trim() || group.name }
          : group
      )
    );
    setShouldSaveGroups(true);
  };

  const handleSaveGroups = useCallback(async () => {
    try {
      await saveGroups(groups);
    } catch (error) {
      console.error('Failed to save groups:', error);
      alert('Failed to save groups');
    }
  }, [groups]);

  useEffect(() => {
    if (shouldSaveGroups) {
      handleSaveGroups();
      setShouldSaveGroups(false);
    }
  }, [shouldSaveGroups, handleSaveGroups]);

  const handleDeleteGroup = async (groupId: string) => {
    if (window.confirm('Are you sure you want to delete this group?')) {
      try {
        await deleteGroup(groupId);
        setGroups((prev) => prev.filter((group) => group.id !== groupId));
      } catch (error) {
        console.error('Failed to delete group:', error);
        alert('Failed to delete group');
      }
    }
  };

  return (
    <div className='space-y-6'>
      <div className='flex space-x-4'>
        <input
          type='text'
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          placeholder='New group name'
          className='grow rounded-md border p-2'
        />
        <button
          onClick={createNewGroup}
          className='rounded-md border px-4 py-2'
        >
          Create Group
        </button>
      </div>

      {groups.map((group) => (
        <div key={group.id} className='rounded-lg border shadow-xs'>
          <div className='flex items-center justify-between border-b p-4'>
            <h2 className='text-lg font-semibold'>
              {editingGroupId === group.id ? (
                <input
                  type='text'
                  value={editingGroupName}
                  onChange={(e) => setEditingGroupName(e.target.value)}
                  className='w-64 rounded-md border p-2'
                />
              ) : (
                <Link
                  href={`/${daoSlug}/${group.id}`}
                  target='_blank'
                  className='flex gap-2'
                >
                  {group.name}
                  {initialGroups.some((g) => g.id === group.id) && (
                    <ExternalLinkIcon className='h-4 w-4' />
                  )}
                </Link>
              )}
            </h2>
            <div className='space-x-2'>
              {editingGroupId === group.id ? (
                <button
                  onClick={() => {
                    editGroup(editingGroupId, editingGroupName);
                    setEditingGroupId(null);
                    setEditingGroupName('');
                    setSearchTerm('');
                    setSearchResults([]);
                  }}
                  className='rounded-md border px-3 py-1'
                >
                  Done Editing
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setEditingGroupName(group.name);
                      setEditingGroupId(group.id!);
                    }}
                    className='rounded-md border px-3 py-1'
                  >
                    Edit Group
                  </button>
                  <button
                    onClick={() => handleDeleteGroup(group.id!)}
                    className='rounded-md border px-3 py-1'
                  >
                    Delete Group
                  </button>
                </>
              )}
            </div>
          </div>
          <div className='p-4'>
            {editingGroupId === group.id && (
              <>
                <ul className='mb-4 space-y-2'>
                  {group.items.map((item) => (
                    <li
                      key={item.id}
                      className='flex items-center justify-between'
                    >
                      <span className='flex gap-2'>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                      item.type === 'proposal'
                              ? 'bg-blue-100 dark:bg-blue-800'
                              : 'bg-gray-100 dark:bg-gray-800'
                          }`}
                        >
                          {item.type === 'proposal' ? 'Proposal' : 'Discussion'}
                        </span>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                      item.indexerName.includes('SNAPSHOT')
                              ? 'bg-yellow-100 dark:bg-yellow-800'
                              : item.indexerName.includes('http')
                                ? 'bg-blue-100 dark:bg-blue-800'
                                : 'bg-green-100 dark:bg-green-800'
                          }`}
                        >
                          {item.indexerName}
                        </span>
                        {item.name}
                      </span>
                      <button
                        onClick={() => removeItemFromGroup(group.id!, item.id)}
                        className='rounded-md bg-red-500 px-2 py-1 text-white hover:bg-red-600'
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                <input
                  type='text'
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder='Search proposals and discussions...'
                  className='mb-4 w-full rounded-md border p-2'
                />
                <ul className='space-y-2'>
                  {searchResults.map((item) => (
                    <li
                      key={item.id}
                      className='flex h-8 items-center gap-2'
                      onClick={() => addItemToGroup(group.id!, item)}
                    >
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          item.type === 'proposal'
                            ? 'bg-blue-100 dark:bg-blue-800'
                            : 'bg-gray-100 dark:bg-gray-800'
                        }`}
                      >
                        {item.type === 'proposal' ? 'Proposal' : 'Discussion'}
                      </span>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          item.indexerName.includes('SNAPSHOT')
                            ? 'bg-yellow-100 dark:bg-yellow-800'
                            : item.indexerName.includes('http')
                              ? 'bg-blue-100 dark:bg-blue-800'
                              : 'bg-green-100 dark:bg-green-800'
                        }`}
                      >
                        {item.indexerName}
                      </span>
                      <label htmlFor={`item-${item.id}`}>{item.name}</label>
                      <span className='rounded-full bg-red-100 px-2 py-1 text-xs dark:bg-red-800'>
                        {item.score}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {!editingGroupId && (
              <ul className='mb-4 space-y-2'>
                {group.items.map((item) => (
                  <li key={item.id} className='flex items-center gap-2'>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        item.type === 'proposal'
                          ? 'bg-blue-100 dark:bg-blue-800'
                          : 'bg-gray-100 dark:bg-gray-800'
                      }`}
                    >
                      {item.type === 'proposal' ? 'Proposal' : 'Discussion'}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        item.indexerName.includes('SNAPSHOT')
                          ? 'bg-yellow-100 dark:bg-yellow-800'
                          : item.indexerName.includes('http')
                            ? 'bg-blue-100 dark:bg-blue-800'
                            : 'bg-green-100 dark:bg-green-800'
                      }`}
                    >
                      {item.indexerName}
                    </span>
                    <span>{item.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
