import { Proposal, Selectable, Vote } from "@proposalsapp/db";
import { VotingPowerChart } from "./result/VotingPowerChart";
import { VotingTable } from "./result/VotingTable";
import { processResults } from "./actions";
import { Suspense } from "react";

interface ProposalResultProps {
  proposal: Selectable<Proposal>;
  votes: Selectable<Vote>[];
}

export async function ProposalResult({ proposal, votes }: ProposalResultProps) {
  const processedResults = await processResults(proposal, votes);

  return (
    <div className="flex h-full min-h-[calc(100vh-114px)] w-full flex-col rounded-lg border border-gray-400 bg-white p-6">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold">{proposal.name}</h2>
        <p className="text-sm text-gray-500">
          {votes.length} vote{votes.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Voting Power Chart */}
      <Suspense fallback={<div>Loading chart...</div>}>
        <VotingPowerChart results={processedResults} />
      </Suspense>

      {/* Voting Table */}
      <Suspense fallback={<div>Loading table...</div>}>
        <VotingTable results={processedResults} />
      </Suspense>
    </div>
  );
}
