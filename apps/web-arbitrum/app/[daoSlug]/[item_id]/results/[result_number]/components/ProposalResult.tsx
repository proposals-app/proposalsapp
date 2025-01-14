import { Proposal, Selectable, Vote } from "@proposalsapp/db";
import { VotingPowerChart } from "./result/VotingPowerChart";
import { VotingTable } from "./result/VotingTable";
import { getVotes, processResults } from "./actions";
import { Suspense } from "react";
import { LoadingVotes } from "./result/LoadingVotes";

interface ProposalResultProps {
  proposal: Selectable<Proposal>;
}

export default function ProposalResult({ proposal }: ProposalResultProps) {
  return (
    <div className="flex h-full min-h-[calc(100vh-114px)] w-full flex-col rounded-lg border border-gray-400 bg-white p-6">
      <Suspense fallback={<LoadingVotes />}>
        <Results proposal={proposal} />
      </Suspense>
    </div>
  );
}

async function Results({ proposal }: ProposalResultProps) {
  const votesLabel = `getVotes-${proposal.id}`;
  const processResultsLabel = `processResults-${proposal.id}`;

  console.time(votesLabel);
  const votes = await getVotes(proposal.id);
  console.timeEnd(votesLabel);

  console.time(processResultsLabel);
  const processedResults = await processResults(proposal, votes);
  console.timeEnd(processResultsLabel);

  return (
    <>
      {/* Voting Power Chart */}
      <VotingPowerChart results={processedResults} />
      {/* Voting Table */}
      <VotingTable results={processedResults} />
    </>
  );
}
