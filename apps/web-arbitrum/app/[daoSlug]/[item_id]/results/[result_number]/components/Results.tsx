import { getVotes, processResults } from "./actions";
import { VotingPowerChart } from "./result/VotingPowerChart";
import { VotingTable } from "./result/VotingTable";
import { ProposalResultProps } from "./ResultsContainer";

export async function Results({ proposal }: ProposalResultProps) {
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
