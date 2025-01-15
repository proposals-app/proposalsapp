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

interface ResultsProps {
  proposal: Selectable<Proposal>;
  daoSlug: string;
}

export async function Results({ proposal, daoSlug }: ResultsProps) {
  const votes = await getVotesAction(proposal.id);

  // Create a map of voter addresses to their delegate information
  const delegateMap = new Map<string, DelegateInfo>();

  // Fetch delegate information for all voters
  await Promise.all(
    votes.map(async (vote) => {
      const delegate = await getDelegateForVoter(
        vote.voterAddress,
        daoSlug,
        proposal.id,
      );
      delegateMap.set(vote.voterAddress, delegate);
    }),
  );

  const processedResults = await processResultsAction(proposal, votes);

  if (!processedResults) {
    notFound();
  }

  return (
    <div>
      <div className="flex">
        <ResultsChart results={processedResults} />
        <ResultsList results={processedResults} />
      </div>
      {/* Pass delegateMap to ResultsTable */}
      <ResultsTable results={processedResults} delegateMap={delegateMap} />
    </div>
  );
}
