"use client";

import React, { useState, useMemo } from "react";
import { FixedSizeList as List } from "react-window";
import { formatNumberWithSuffix } from "@/lib/utils";
import { format } from "date-fns";
import { ProcessedResults } from "../actions";

interface VotingTableProps {
  results: ProcessedResults;
}

export const VotingTable = ({ results }: VotingTableProps) => {
  const [sortColumn, setSortColumn] = useState<
    "choice" | "timestamp" | "votingPower"
  >("votingPower");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const sortedVotes = useMemo(() => {
    return [...results.votes].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case "choice":
          comparison = a.choiceText.localeCompare(b.choiceText);
          break;
        case "timestamp":
          comparison = a.timestamp.getTime() - b.timestamp.getTime();
          break;
        case "votingPower":
          comparison = a.votingPower - b.votingPower;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [results.votes, sortColumn, sortDirection]);

  const handleSortChange = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const Row = ({
    index,
    style,
  }: {
    index: number;
    style: React.CSSProperties;
  }) => {
    const vote = sortedVotes[index];

    return (
      <div
        style={{
          ...style,
          display: "grid",
          gridTemplateColumns: "25% 25% 25% 25%",
          alignItems: "center",
          padding: "0.5rem",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <div className="truncate">{vote.voterAddress}</div>
        <div className="font-medium">{vote.choiceText}</div>
        <div>{format(vote.timestamp, "MMM d, yyyy HH:mm")}</div>
        <div>{formatNumberWithSuffix(vote.votingPower)} ARB</div>
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
              onClick={() => handleSortChange("timestamp")}
              className="flex items-center gap-1"
            >
              Date
              {sortColumn === "timestamp" && (
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
