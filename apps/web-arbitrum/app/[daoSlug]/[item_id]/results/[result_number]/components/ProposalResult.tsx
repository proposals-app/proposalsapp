import { Proposal, Selectable, Vote } from "@proposalsapp/db";
import { VotingPowerChart } from "./result/VotingPowerChart";
import { VotingTable } from "./result/VotingTable";

interface ProposalResultProps {
  proposal: Selectable<Proposal>;
  votes: Selectable<Vote>[];
}

export const ProposalResult = ({ proposal, votes }: ProposalResultProps) => {
  return (
    <div className="flex h-full min-h-[calc(100vh-114px)] w-full flex-col rounded-lg border border-gray-400 bg-white p-6">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold">{proposal.name}</h2>
        <p className="text-sm text-gray-500">
          {votes.length} vote{votes.length !== 1 ? "s" : ""}
        </p>
      </div>

      <VotingPowerChart votes={votes} proposal={proposal} />

      <VotingTable votes={votes} proposal={proposal} />
    </div>
  );
};
