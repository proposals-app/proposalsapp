"use client";

import { useState, useEffect, useMemo } from "react";
import { saveGroups, searchItems } from "../actions";
import Link from "next/link";

interface ProposalGroupItem {
  id: string;
  type: "proposal" | "topic";
  name: string;
}

interface ProposalGroup {
  id?: string;
  name: string;
  items: ProposalGroupItem[];
}

interface GroupingInterfaceProps {
  initialGroups: ProposalGroup[];
}

export default function GroupingInterface({
  initialGroups,
}: GroupingInterfaceProps) {
  const [groups, setGroups] = useState<ProposalGroup[]>(initialGroups);
  const [newGroupName, setNewGroupName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<ProposalGroupItem[]>([]);

  const itemsInGroups = useMemo(() => {
    const itemSet = new Set<string>();
    groups.forEach((group) => {
      group.items.forEach((item) => itemSet.add(item.id));
    });
    return itemSet;
  }, [groups]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      const results = await searchItems(searchTerm);
      const filteredResults = results.filter(
        (item) => !itemsInGroups.has(item.id),
      );
      setSearchResults(filteredResults);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, itemsInGroups]);

  const addGroup = () => {
    if (newGroupName.trim()) {
      setGroups([...groups, { name: newGroupName, items: [] }]);
      setNewGroupName("");
    }
  };

  const addItemToGroup = (groupId: string, item: ProposalGroupItem) => {
    setGroups(
      groups.map((group) =>
        group.id === groupId
          ? { ...group, items: [...group.items, item] }
          : group,
      ),
    );
    setSearchResults(searchResults.filter((result) => result.id !== item.id));
  };

  const removeItemFromGroup = (groupId: string, itemId: string) => {
    let removedItem: ProposalGroupItem | undefined;
    setGroups(
      groups.map((group) => {
        if (group.id === groupId) {
          const newItems = group.items.filter((item) => {
            if (item.id === itemId) {
              removedItem = item;
              return false;
            }
            return true;
          });
          return { ...group, items: newItems };
        }
        return group;
      }),
    );
    if (removedItem) {
      setSearchResults([...searchResults, removedItem]);
    }
  };

  const handleSaveGroups = async () => {
    try {
      await saveGroups(groups);
      alert("Groups saved successfully");
    } catch (error) {
      alert("Failed to save groups");
    }
  };

  return (
    <div>
      <div className="mb-4">
        <input
          type="text"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          className="mr-2 border p-2"
          placeholder="New group name"
        />
        <button
          onClick={addGroup}
          className="rounded bg-blue-500 p-2 text-white"
        >
          Add Group
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full border p-2"
          placeholder="Search proposals and topics..."
        />
      </div>

      <div className="flex flex-col">
        {groups.map((group) => (
          <div key={group.id} className="border p-4">
            <h2 className="mb-2 text-xl font-bold">{group.name}</h2>

            <ul>
              {group.items.map((item) => (
                <li
                  key={item.id}
                  className="mb-1 flex items-center justify-between"
                >
                  <span>
                    {item.type === "proposal" ? "Proposal: " : "Topic: "}
                    {item.name}
                  </span>
                  <button
                    onClick={() => removeItemFromGroup(group.id!, item.id)}
                    className="text-red-500"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2">
              <select
                onChange={(e) => {
                  const selectedItem = JSON.parse(
                    e.target.value,
                  ) as ProposalGroupItem;
                  addItemToGroup(group.id!, selectedItem);
                }}
                className="border p-1"
              >
                <option value="">Add item</option>
                {searchResults.map((item) => (
                  <option key={item.id} value={JSON.stringify(item)}>
                    {item.type === "proposal" ? "Proposal: " : "Topic: "}{" "}
                    {item.name.replace(/(.{100})..+/, "$1…")}
                  </option>
                ))}
              </select>
            </div>
            {group.id && (
              <Link
                href={`/proposal_group/${group.id}`}
                className="mt-4 text-blue-300 underline"
              >
                {group.name}
              </Link>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={handleSaveGroups}
        className="mt-4 rounded bg-green-500 p-2 text-white"
      >
        Save Groups
      </button>
    </div>
  );
}
