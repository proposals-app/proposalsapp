"use client";
import React, { useState } from "react"; // Import useState from React
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

  // Sort function based on state
  const compareFn = (a: Selectable<Vote>, b: Selectable<Vote>) => {
    let comparison = 0;

    const aValue = a[sortColumn as keyof Selectable<Vote>];
    const bValue = b[sortColumn as keyof Selectable<Vote>];

    if (sortColumn === "timeCreated") {
      // Handle date comparisons
      const aTime = aValue ? new Date(aValue).getTime() : 0;
      const bTime = bValue ? new Date(bValue).getTime() : 0;
      comparison = aTime - bTime;
    } else if (sortColumn === "votingPower") {
      // Handle number comparisons
      const aNum = aValue ? Number(aValue) : 0;
      const bNum = bValue ? Number(bValue) : 0;
      comparison = aNum - bNum;
    } else if (sortColumn === "choice") {
      // Handle string comparisons
      comparison = String(aValue).localeCompare(String(bValue));
    }

    return sortDirection === "asc" ? comparison : -comparison;
  };

  // Sort votes based on state
  const sortedVotes = [...votes].sort(compareFn);

  // Function to update sorting
  const handleSortChange = (column: keyof Selectable<Vote>) => {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection("desc");
    } else {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    }
  };

  return (
    <div className="mt-6">
      <h3 className="mb-4 text-xl font-semibold">Voting Breakdown</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Voter</TableHead>
            <TableHead>
              <button
                onClick={() => handleSortChange("choice")}
                className="flex items-center gap-1"
              >
                Choice
                {sortColumn === "choice" && (
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                )}
              </button>
            </TableHead>
            <TableHead>
              <button
                onClick={() => handleSortChange("timeCreated")}
                className="flex items-center gap-1"
              >
                Date
                {sortColumn === "timeCreated" && (
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                )}
              </button>
            </TableHead>
            <TableHead>
              <button
                onClick={() => handleSortChange("votingPower")}
                className="flex items-center gap-1"
              >
                Voting Power
                {sortColumn === "votingPower" && (
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                )}
              </button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedVotes.map((vote) => {
            const choiceIndex = vote.choice as number;
            const choice =
              (proposal.choices as string[])[choiceIndex] || "Unknown";

            return (
              <TableRow key={vote.id}>
                <TableCell>{vote.voterAddress}</TableCell>
                <TableCell className="font-medium">{choice}</TableCell>
                <TableCell>
                  {vote.timeCreated
                    ? format(new Date(vote.timeCreated), "MMM d, yyyy HH:mm")
                    : "Unknown"}
                </TableCell>
                <TableCell>
                  {formatNumberWithSuffix(Number(vote.votingPower))} ARB
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
