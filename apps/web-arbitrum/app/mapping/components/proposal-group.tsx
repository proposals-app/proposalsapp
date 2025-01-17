"use client";

import React, { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  saveGroups,
  fuzzySearchItems,
  ProposalGroup,
  ProposalGroupItem,
  deleteGroup,
  FuzzyItem,
} from "../actions";
import { Input } from "@/shadcn/ui/input";
import { Button } from "@/shadcn/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shadcn/ui/card";
import { Badge } from "@/shadcn/ui/badge";
import Link from "next/link";
import {
  ExternalLinkIcon,
  PlusIcon,
  TrashIcon,
  EditIcon,
  CheckIcon,
} from "lucide-react";
import { Separator } from "@/shadcn/ui/separator";
import { ScrollArea } from "@/shadcn/ui/scroll-area";

interface GroupingInterfaceProps {
  initialGroups?: ProposalGroup[];
}

export default function GroupingInterface({
  initialGroups = [],
}: GroupingInterfaceProps) {
  const [groups, setGroups] = useState<ProposalGroup[]>(() =>
    [...initialGroups].sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime(),
    ),
  );
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<string>("");
  const [searchResults, setSearchResults] = useState<FuzzyItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [shouldSaveGroups, setShouldSaveGroups] = useState(false);

  const handleSearch = async (value: string) => {
    setSearchTerm(value);
    if (value.trim()) {
      const results = await fuzzySearchItems(value);

      const currentGroup = groups.find((group) => group.id === editingGroupId);

      if (currentGroup) {
        const filteredResults = results.filter(
          (result) => !currentGroup.items.some((item) => item.id === result.id),
        );
        setSearchResults(filteredResults);
      } else {
        setSearchResults(results);
      }
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
      setNewGroupName("");
      setEditingGroupName(newGroupName);
      setEditingGroupId(newGroup.id!);
      setShouldSaveGroups(true);
    }
  };

  const addItemToGroup = (groupId: string, item: ProposalGroupItem) => {
    setGroups((prevGroups) =>
      prevGroups.map((group) =>
        group.id === groupId
          ? { ...group, items: [item, ...group.items] }
          : group,
      ),
    );
    setSearchResults((prevResults) =>
      prevResults.filter((result) => result.id !== item.id),
    );
    setShouldSaveGroups(true);
  };

  const removeItemFromGroup = (groupId: string, itemId: string) => {
    setGroups(
      groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              items: group.items.filter((item) => item.id !== itemId),
            }
          : group,
      ),
    );
    setShouldSaveGroups(true);
  };

  const editGroup = (groupId: string, newName: string) => {
    setGroups((prevGroups) =>
      prevGroups.map((group) =>
        group.id === groupId
          ? { ...group, name: newName.trim() || group.name }
          : group,
      ),
    );
    setShouldSaveGroups(true);
  };

  useEffect(() => {
    if (shouldSaveGroups) {
      handleSaveGroups();
      setShouldSaveGroups(false);
    }
  }, [groups, shouldSaveGroups]);

  const handleSaveGroups = async () => {
    try {
      await saveGroups(groups);
    } catch (error) {
      console.error("Failed to save groups:", error);
      alert("Failed to save groups");
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (window.confirm("Are you sure you want to delete this group?")) {
      try {
        await deleteGroup(groupId);
        setGroups(groups.filter((group) => group.id !== groupId));
      } catch (error) {
        console.error("Failed to delete group:", error);
        alert("Failed to delete group");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex space-x-4">
        <Input
          type="text"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          placeholder="New group name"
          className="flex-grow"
        />
        <Button onClick={createNewGroup}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Create Group
        </Button>
      </div>

      {groups.map((group) => (
        <Card key={group.id} className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {editingGroupId === group.id ? (
                <div className="flex items-center space-x-2">
                  <Input
                    type="text"
                    value={editingGroupName}
                    onChange={(e) => setEditingGroupName(e.target.value)}
                    className="w-64"
                  />
                </div>
              ) : (
                <Link
                  href={`proposal_group/${group.id}`}
                  target="_blank"
                  className="flex gap-2 hover:underline"
                >
                  {group.name}
                  {initialGroups.map((g) => g.id).includes(group.id) && (
                    <ExternalLinkIcon className="h-4 w-4" />
                  )}
                </Link>
              )}
            </CardTitle>
            <div className="space-x-2">
              {editingGroupId === group.id ? (
                <Button
                  size="sm"
                  onClick={() => {
                    editGroup(editingGroupId, editingGroupName);
                    setEditingGroupId(null);
                    setEditingGroupName("");
                    setSearchTerm("");
                    setSearchResults([]);
                  }}
                >
                  <CheckIcon className="mr-2 h-4 w-4" />
                  Done Editing
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingGroupName(group.name);
                      setEditingGroupId(group.id!);
                    }}
                  >
                    <EditIcon className="mr-2 h-4 w-4" />
                    Edit Group
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteGroup(group.id!)}
                  >
                    <TrashIcon className="mr-2 h-4 w-4" />
                    Delete Group
                  </Button>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingGroupId === group.id ? (
              <>
                <ul className="mb-4 space-y-2">
                  {group.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border p-2"
                    >
                      <span className="flex gap-2">
                        {item.type === "proposal" ? (
                          <Badge>Proposal</Badge>
                        ) : (
                          <Badge variant="secondary">Discussion</Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={`${item.indexerName.includes("SNAPSHOT") ? "bg-yellow-100 dark:bg-yellow-800" : item.indexerName.includes("http") ? "bg-blue-100 dark:bg-blue-800" : "bg-green-100 dark:bg-green-800"}`}
                        >
                          {item.indexerName}
                        </Badge>

                        {item.name}
                      </span>

                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeItemFromGroup(group.id!, item.id)}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
                <Input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search proposals and discussions..."
                  className="mb-4"
                />
                <ScrollArea className="h-64 rounded-md border p-4">
                  <ul className="space-y-2">
                    {searchResults.map((item) => (
                      <li
                        key={item.id}
                        className="flex h-8 cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-gray-100"
                        onClick={() => addItemToGroup(group.id!, item)}
                      >
                        {item.type === "proposal" ? (
                          <Badge>Proposal</Badge>
                        ) : (
                          <Badge variant="secondary">Discussion</Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={`${item.indexerName.includes("SNAPSHOT") ? "bg-yellow-100 dark:bg-yellow-800" : item.indexerName.includes("http") ? "bg-blue-100 dark:bg-blue-800" : "bg-green-100 dark:bg-green-800"}`}
                        >
                          {item.indexerName}
                        </Badge>
                        <label htmlFor={`item-${item.id}`}>{item.name}</label>
                        <Badge variant="destructive">{item.score}</Badge>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </>
            ) : (
              <>
                <ul className="mb-4 space-y-2">
                  {group.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-2 rounded-lg border p-2"
                    >
                      {item.type === "proposal" ? (
                        <Badge>Proposal</Badge>
                      ) : (
                        <Badge variant="secondary">Discussion</Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={`${item.indexerName.includes("SNAPSHOT") ? "bg-yellow-100 dark:bg-yellow-800" : item.indexerName.includes("http") ? "bg-blue-100 dark:bg-blue-800" : "bg-green-100 dark:bg-green-800"}`}
                      >
                        {item.indexerName}
                      </Badge>
                      <span>{item.name}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
