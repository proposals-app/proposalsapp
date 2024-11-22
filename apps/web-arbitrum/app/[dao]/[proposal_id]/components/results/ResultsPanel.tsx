"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/shadcn/ui/card";
import { VoteChart } from "./VoteChart";
import { Proposal } from "@proposalsapp/db";
import { useMemo } from "react";

interface ResultsPanelProps {
  groupDetails: {
    proposals: Array<
      Proposal & {
        votes: Array<{
          id: string;
          choice: string | string[];
          timeCreated: string;
          votingPower: string;
        }>;
      }
    >;
  };
}

export function ResultsPanel({ groupDetails }: ResultsPanelProps) {
  const processedProposals = useMemo(
    () =>
      groupDetails.proposals.map((proposal) => ({
        ...proposal,
        processedVotes: proposal.votes
          .filter((v) => v !== null)
          .map((vote) => ({
            timestamp: new Date(vote.timeCreated),
            // Handle both single choice and multiple choice formats
            choices: Array.isArray(vote.choice)
              ? vote.choice.map(String) // Convert numbers to strings for array choices
              : [String(vote.choice)], // Convert single number to string array
            votingPower: parseFloat(vote.votingPower),
          })),
      })),
    [groupDetails],
  );

  return (
    <div className="sticky top-20 h-[calc(100vh-5rem)] w-96 space-y-4 overflow-y-auto pr-4">
      {processedProposals.map((proposal, index) => (
        <Card key={index} className="bg-white shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{proposal.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <VoteChart votes={proposal.processedVotes} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
