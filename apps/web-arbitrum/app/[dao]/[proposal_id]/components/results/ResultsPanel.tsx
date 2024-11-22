"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/shadcn/ui/card";
import { VoteChart } from "./VoteChart";
import { Proposal, Selectable } from "@proposalsapp/db";
import { useMemo } from "react";

interface ResultsPanelProps {
  groupDetails: {
    proposals: Array<
      Selectable<Proposal> & {
        votes: Array<{
          id: string;
          choice: string | string[];
          timeCreated: string;
          votingPower: string;
        }>;
        choices: Record<string, string>;
      }
    >;
  };
}

export function ResultsPanel({ groupDetails }: ResultsPanelProps) {
  const processedProposals = useMemo(
    () =>
      [...groupDetails.proposals]
        .sort((a, b) => {
          // Use toDate() method on Timestamp objects
          const dateA = a.timeEnd.getTime();
          const dateB = b.timeEnd.getTime();
          return dateB - dateA;
        })
        .map((proposal) => ({
          ...proposal,
          processedVotes: proposal.votes
            .filter((v) => v !== null)
            .map((vote) => ({
              timestamp: new Date(vote.timeCreated),
              choices: Array.isArray(vote.choice)
                ? vote.choice.map((c) => String(c))
                : [String(vote.choice)],
              votingPower: parseFloat(vote.votingPower),
            })),
          choiceNames: proposal.choices || {},
        })),
    [groupDetails],
  );

  return (
    <div className="sticky top-24 h-[calc(100vh-6rem)]">
      <div className="h-full overflow-y-auto pr-4">
        <div className="space-y-4">
          {processedProposals.map((proposal, index) => (
            <Card key={index} className="bg-white shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{proposal.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <VoteChart
                  votes={proposal.processedVotes}
                  choiceNames={proposal.choiceNames}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
