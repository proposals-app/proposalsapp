import { Proposal, Selectable, Vote } from "@proposalsapp/db";
import { VotingPowerChart } from "./result/VotingPowerChart";
import { VotingTable } from "./result/VotingTable";
import { processResults } from "./actions";
import { Suspense } from "react";
import { LoadingVotes } from "./result/LoadingVotes";

interface ProposalResultProps {
  proposal: Selectable<Proposal>;
}

export async function ProposalResult({ proposal }: ProposalResultProps) {
  return (
    <div className="flex h-full min-h-[calc(100vh-114px)] w-full flex-col rounded-lg border border-gray-400 bg-white p-6">
      <Suspense fallback={<LoadingVotes />}>
        <Results proposal={proposal} />
      </Suspense>
    </div>
  );
}

async function Results({ proposal }: ProposalResultProps) {
  const processedResults = await processResults(proposal);

  return (
    <>
      {/* Voting Power Chart */}
      <VotingPowerChart results={processedResults} />
      {/* Voting Table */}
      <VotingTable results={processedResults} />
    </>
  );
}
