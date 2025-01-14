import { Proposal, Selectable } from "@proposalsapp/db";
import { Suspense } from "react";
import { LoadingVotes } from "./result/LoadingVotes";
import { Results } from "./Results";

export interface ProposalResultProps {
  proposal: Selectable<Proposal>;
}

export function ResultsContainer({ proposal }: ProposalResultProps) {
  return (
    <div className="flex h-full min-h-[calc(100vh-114px)] w-full flex-col rounded-lg border border-gray-400 bg-white p-6">
      <Suspense fallback={<LoadingVotes />}>
        <Results proposal={proposal} />
      </Suspense>
    </div>
  );
}
