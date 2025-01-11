"use client";
import React, { useState, useMemo } from "react";
import { FixedSizeList as List } from "react-window";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shadcn/ui/table";
import { formatNumberWithSuffix } from "@/lib/utils";
import { Proposal, Selectable, Vote } from "@proposalsapp/db";
import { format } from "date-fns";

interface VotingTableProps {
  proposal: Selectable<Proposal>;
  votes: Selectable<Vote>[];
}

export const VotingTable = ({ proposal, votes }: VotingTableProps) => {
  // State to manage sorting
  const [sortColumn, setSortColumn] = useState<
    "choice" | "timeCreated" | "votingPower"
  >("votingPower");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const sortedVotes = useMemo(() => {
    return [...votes].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case "choice":
          // Sort by the actual choice text rather than the index
          const choiceA =
            (proposal.choices as string[])[a.choice as number] || "";
          const choiceB =
            (proposal.choices as string[])[b.choice as number] || "";
          comparison = choiceA.localeCompare(choiceB);
          break;

        case "timeCreated":
          const timeA = a.timeCreated ? new Date(a.timeCreated).getTime() : 0;
          const timeB = b.timeCreated ? new Date(b.timeCreated).getTime() : 0;
          comparison = timeA - timeB;
          break;

        case "votingPower":
          const powerA = Number(a.votingPower) || 0;
          const powerB = Number(b.votingPower) || 0;
          comparison = powerA - powerB;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [votes, sortColumn, sortDirection, proposal.choices]);

  const handleSortChange = (
    column: "choice" | "timeCreated" | "votingPower",
  ) => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Default to descending order when switching columns
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  // Row renderer for react-window
  const Row = ({
    index,
    style,
  }: {
    index: number;
    style: React.CSSProperties;
  }) => {
    const vote = sortedVotes[index];
    const choiceIndex = vote.choice as number;
    const choice = (proposal.choices as string[])[choiceIndex] || "Unknown";

    return (
      <div
        style={{
          ...style,
          display: "grid",
          gridTemplateColumns: "25% 25% 25% 25%", // Match the header columns
          alignItems: "center",
          padding: "0.5rem",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <div className="truncate">{vote.voterAddress}</div>
        <div className="font-medium">{choice}</div>
        <div>
          {vote.timeCreated
            ? format(new Date(vote.timeCreated), "MMM d, yyyy HH:mm")
            : "Unknown"}
        </div>
        <div>{formatNumberWithSuffix(Number(vote.votingPower))} ARB</div>
      </div>
    );
  };

  return (
    <div className="mt-6">
      <h3 className="mb-4 text-xl font-semibold">Voting Breakdown</h3>
      <div className="rounded-md border">
        {/* Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "25% 25% 25% 25%",
            padding: "0.75rem",
            backgroundColor: "#f9fafb",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <div>Voter</div>
          <div>
            <button
              onClick={() => handleSortChange("choice")}
              className="flex items-center gap-1"
            >
              Choice
              {sortColumn === "choice" && (
                <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
              )}
            </button>
          </div>
          <div>
            <button
              onClick={() => handleSortChange("timeCreated")}
              className="flex items-center gap-1"
            >
              Date
              {sortColumn === "timeCreated" && (
                <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
              )}
            </button>
          </div>
          <div>
            <button
              onClick={() => handleSortChange("votingPower")}
              className="flex items-center gap-1"
            >
              Voting Power
              {sortColumn === "votingPower" && (
                <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
              )}
            </button>
          </div>
        </div>

        {/* Virtualized List */}
        <List
          height={600}
          itemCount={sortedVotes.length}
          itemSize={50}
          width="100%"
        >
          {Row}
        </List>
      </div>
    </div>
  );
};
