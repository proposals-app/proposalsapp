"use client";

import React, { useState, useMemo } from "react";
import { FixedSizeList as List } from "react-window";
import { formatNumberWithSuffix } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { DelegateInfo, ProcessedResults } from "../actions";
import Link from "next/link";

interface ResultsTableProps {
  results: ProcessedResults;
  delegateMap: Map<string, DelegateInfo>;
}

export function ResultsTable({ results, delegateMap }: ResultsTableProps) {
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

  const isUrl = (text: string): boolean => {
    try {
      new URL(text);
      return true;
    } catch (e) {
      return false;
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
    const delegate = delegateMap.get(vote.voterAddress);

    const votingPowerPercentage =
      (vote.votingPower / results.totalVotingPower) * 100;

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
        <div className="flex items-center gap-2 font-bold">
          {delegate && (
            <>
              <span className="truncate">{delegate.name}</span>
            </>
          )}
          {!delegate && <span className="truncate">{vote.voterAddress}</span>}
        </div>
        <div
          className="flex cursor-default flex-col truncate"
          title={vote.choiceText}
        >
          <div className="font-bold">
            {vote.choiceText.length > 20
              ? `${vote.choiceText.substring(0, 20)}...`
              : vote.choiceText}
          </div>
          {vote.reason && (
            <div className="text-sm">
              {isUrl(vote.reason) ? (
                <Link
                  className="underline"
                  href={vote.reason}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {vote.reason.length > 30
                    ? `${vote.reason.substring(0, 30)}...`
                    : vote.reason}
                </Link>
              ) : (
                <div>
                  {vote.reason.length > 30
                    ? `${vote.reason.substring(0, 30)}...`
                    : vote.reason}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="cursor-default">
          <div>{formatDistanceToNow(vote.timestamp, { addSuffix: true })}</div>
          <div className="text-sm text-gray-500">
            {format(vote.timestamp, "MMM d, yyyy")}
          </div>
        </div>
        <div className="cursor-default">
          <div>{formatNumberWithSuffix(vote.votingPower)} ARB</div>
          <div className="text-sm text-gray-500">
            {votingPowerPercentage.toFixed(1)}%
          </div>
        </div>
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
          <div>Delegate</div>
          <div
            onClick={() => handleSortChange("choice")}
            className="flex cursor-default items-center gap-1"
          >
            Choice
            {sortColumn === "choice" && (
              <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
            )}
          </div>
          <div
            onClick={() => handleSortChange("timestamp")}
            className="flex cursor-default items-center gap-1"
          >
            Date
            {sortColumn === "timestamp" && (
              <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
            )}
          </div>
          <div
            onClick={() => handleSortChange("votingPower")}
            className="flex cursor-default items-center gap-1"
          >
            Voting Power
            {sortColumn === "votingPower" && (
              <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
            )}
          </div>
        </div>

        <List
          height={600}
          itemCount={sortedVotes.length}
          itemSize={60}
          width="100%"
        >
          {Row}
        </List>
      </div>
    </div>
  );
}
