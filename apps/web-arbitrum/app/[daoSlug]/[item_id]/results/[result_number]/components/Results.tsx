import { getVotes, processResults } from "./actions";
import { VotingPowerChart } from "./result/VotingPowerChart";
import { VotingTable } from "./result/VotingTable";
import { ProposalResultProps } from "./ResultsContainer";

export async function Results({ proposal }: ProposalResultProps) {
  "use client";

  const votes = await getVotes(proposal.id);
  const processedResults = await processResults(proposal, votes);

  return (
    <>
      <VotingPowerChart results={processedResults} />
      <VotingTable results={processedResults} />
    </>
  );
}
