"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/shadcn/ui/card";
import { VoteChart } from "./VoteChart";
import { Proposal, Selectable, Vote } from "@proposalsapp/db";

interface ResultsPanelProps {
  proposals: Array<
    Selectable<Proposal> & {
      votes: Selectable<Vote>[];
    }
  >;
}

export function ResultsPanel({ proposals }: ResultsPanelProps) {
  return (
    <div className="sticky top-24 h-[calc(100vh-6rem)]">
      <div className="h-full overflow-y-auto pr-4">
        <div className="space-y-4">
          {proposals.map((proposal, index) => (
            <Card key={index} className="bg-white shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{proposal.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <VoteChart proposal={proposal} />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
