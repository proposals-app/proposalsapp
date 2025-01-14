import { Proposal, Selectable, Vote } from "@proposalsapp/db";
import { VotingPowerChart } from "./result/VotingPowerChart";
import { VotingTable } from "./result/VotingTable";
import { processResults } from "./actions";
import { Suspense } from "react";
import { LoadingVotes } from "./result/LoadingVotes";

interface ProposalResultProps {
  proposal: Selectable<Proposal>;
  votes: Selectable<Vote>[];
}

export async function ProposalResult({ proposal, votes }: ProposalResultProps) {
  return (
    <div className="flex h-full min-h-[calc(100vh-114px)] w-full flex-col rounded-lg border border-gray-400 bg-white p-6">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold">{proposal.name}</h2>
        <p className="text-sm text-gray-500">
          {votes.length} vote{votes.length !== 1 ? "s" : ""}
        </p>
      </div>

      <Suspense fallback={<LoadingVotes />}>
        <Results proposal={proposal} votes={votes} />
      </Suspense>
    </div>
  );
}

async function Results({ proposal, votes }: ProposalResultProps) {
  const processedResults = await processResults(proposal, votes);

  return (
    <>
      {/* Voting Power Chart */}
      <VotingPowerChart results={processedResults} />
      {/* Voting Table */}
      <VotingTable results={processedResults} />
    </>
  );
}
