"use client";

import React, { useState } from "react";
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
import { ExternalLinkIcon } from "lucide-react";

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
  const [searchResults, setSearchResults] = useState<FuzzyItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

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
      setEditingGroupId(newGroup.id!);
    }
  };

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
  };

  const handleSaveGroups = async () => {
    try {
      await saveGroups(groups);
      setGroups((prevGroups) =>
        [...prevGroups].sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime(),
        ),
      );
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
        <Button onClick={createNewGroup}>Create Group</Button>
      </div>

      {groups.map((group) => (
        <Card key={group.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              <Link
                href={`proposal_group/${group.id}`}
                target="_blank"
                className="flex gap-2"
              >
                {group.name}
                {initialGroups.map((g) => g.id).includes(group.id) && (
                  <ExternalLinkIcon />
                )}
              </Link>
            </CardTitle>
            <div className="space-x-2">
              {editingGroupId === group.id ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingGroupId(null);
                    setSearchTerm("");
                    setSearchResults([]);
                    handleSaveGroups();
                  }}
                >
                  Done Editing
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    onClick={() => setEditingGroupId(group.id!)}
                  >
                    Edit Group
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteGroup(group.id!)}
                  >
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
                      className="flex items-center justify-between"
                    >
                      <span>
                        {item.type === "proposal"
                          ? "Proposal: "
                          : "Discussion: "}{" "}
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
                <ul className="space-y-2">
                  {searchResults.map((item) => (
                    <li
                      key={item.id}
                      className="flex h-8 items-center gap-2 hover:bg-gray-100"
                      onClick={() => addItemToGroup(group.id!, item)}
                    >
                      {item.type === "proposal" ? (
                        <Badge>Proposal</Badge>
                      ) : (
                        <Badge variant="secondary">Discussion</Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={`${item.indexerName == "SNAPSHOT" ? "bg-yellow-100" : item.indexerName.includes("http") ? "bg-blue-100" : "bg-green-100"}`}
                      >
                        {item.indexerName}
                      </Badge>
                      <label htmlFor={`item-${item.id}`}>{item.name}</label>
                      <Badge variant="destructive">{item.score}</Badge>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <ul className="mb-4 space-y-2">
                  {group.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-2">
                      {item.type === "proposal" ? (
                        <Badge>Proposal</Badge>
                      ) : (
                        <Badge variant="secondary">Discussion</Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={`${item.indexerName == "SNAPSHOT" ? "bg-yellow-100" : item.indexerName.includes("http") ? "bg-blue-100" : "bg-green-100"}`}
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
