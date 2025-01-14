import { Proposal, Selectable } from "@proposalsapp/db";
import { getVotes, processResults } from "./actions";
import { VotingPowerChart } from "./result/VotingPowerChart";
import { VotingTable } from "./result/VotingTable";

export interface ProposalResultProps {
  proposal: Selectable<Proposal>;
}

export async function Results({ proposal }: ProposalResultProps) {
  const votes = await getVotes(proposal.id);
  const processedResults = await processResults(proposal, votes);

  return (
    <div>
      <VotingPowerChart results={processedResults} />
      <VotingTable results={processedResults} />
    </div>
  );
}
