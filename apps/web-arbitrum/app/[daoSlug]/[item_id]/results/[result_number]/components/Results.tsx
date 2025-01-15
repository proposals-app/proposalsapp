import { notFound } from "next/navigation";
import {
  DelegateInfo,
  getDelegateForVoter,
  getVotesAction,
  processResultsAction,
} from "./actions";
import { ResultsChart } from "./result/ResultsChart";
import { ResultsTable } from "./result/ResultsTable";
import { Proposal, Selectable } from "@proposalsapp/db";
import { ResultsList } from "./result/ResultsList";
import { Suspense } from "react";

interface ResultsProps {
  proposal: Selectable<Proposal>;
  daoSlug: string;
}

export function Results({ proposal, daoSlug }: ResultsProps) {
  return (
    <div className="flex w-full">
      <Suspense fallback={<div>loading</div>}>
        <ResultsContent proposal={proposal} daoSlug={daoSlug} />
      </Suspense>
    </div>
  );
}

// New component to handle the async content
async function ResultsContent({ proposal, daoSlug }: ResultsProps) {
  const votes = await getVotesAction(proposal.id);

  // Create a map of voter addresses to their delegate information
  const delegateMap = new Map<string, DelegateInfo>();

  // Fetch delegate information for all voters
  await Promise.all(
    votes.map(async (vote) => {
      if (vote.votingPower > 50000) {
        const delegate = await getDelegateForVoter(
          vote.voterAddress,
          daoSlug,
          proposal.id,
        );
        delegateMap.set(vote.voterAddress, delegate);
      }
    }),
  );

  const processedResults = await processResultsAction(proposal, votes);

  if (!processedResults) {
    notFound();
  }

  return (
    <div className="w-full">
      <div className="flex">
        <ResultsChart results={processedResults} />
        <ResultsList results={processedResults} />
      </div>

      <ResultsTable results={processedResults} delegateMap={delegateMap} />
    </div>
  );
}
