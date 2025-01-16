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
import { Skeleton } from "@/shadcn/ui/skeleton";

interface ResultsProps {
  proposal: Selectable<Proposal>;
  daoSlug: string;
}

export function Results({ proposal, daoSlug }: ResultsProps) {
  return (
    <div className="flex w-full">
      <Suspense fallback={<ResultsLoading />}>
        <ResultsContent proposal={proposal} daoSlug={daoSlug} />
      </Suspense>
    </div>
  );
}

export function ResultsLoading() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex w-full gap-4">
        {/* Chart Loading */}
        <div className="w-full">
          <Skeleton className="h-[400px] w-full" />
        </div>

        {/* List Loading */}
        <div className="w-64 space-y-4">
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
          <Skeleton className="mb-4 h-10 w-full" />
          <Skeleton className="mb-4 h-8 w-full" />
        </div>
      </div>

      {/* Table Loading */}
      <div className="w-full">
        <Skeleton className="mb-4 h-8 w-48" />
        <div className="rounded-md border">
          {/* Header */}
          <div className="grid grid-cols-4 gap-4 border-b bg-gray-50 p-3">
            {["Delegate", "Choice", "Date", "Voting Power"].map((header, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>

          {/* Rows */}
          <div className="space-y-2 p-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="grid grid-cols-4 gap-4 p-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
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
