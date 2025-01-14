import { notFound } from "next/navigation";
import { getVotesAction, processResultsAction } from "./actions";
import { VotingPowerChart } from "./result/VotingPowerChart";
import { VotingTable } from "./result/VotingTable";
import { Proposal, Selectable } from "@proposalsapp/db";

interface ResultsProps {
  proposal: Selectable<Proposal>;
}

export async function Results({ proposal }: ResultsProps) {
  const votes = await getVotesAction(proposal.id);
  const processedResults = await processResultsAction(proposal, votes);

  if (!processedResults) {
    notFound();
  }

  return (
    <div>
      <VotingPowerChart results={processedResults} />
      <VotingTable results={processedResults} />
    </div>
  );
}
