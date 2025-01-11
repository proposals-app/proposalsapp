import { Selectable, Proposal, Vote } from "@proposalsapp/db";
import { formatNumberWithSuffix } from "@/lib/utils";

interface ProposalResultProps {
  proposal: Selectable<Proposal>;
  votes: Selectable<Vote>[];
}

export const ProposalResult = ({ proposal, votes }: ProposalResultProps) => {
  // Calculate total voting power
  const totalVotingPower = votes.reduce(
    (sum, vote) => sum + Number(vote.votingPower),
    0,
  );

  // Group votes by choice
  const votesByChoice = votes.reduce<Record<string, number>>((acc, vote) => {
    const choiceIndex = vote.choice as number;
    const choiceText = (proposal.choices as string[])[choiceIndex] || "Unknown";
    if (!acc[choiceText]) {
      acc[choiceText] = 0;
    }
    acc[choiceText] += Number(vote.votingPower);
    return acc;
  }, {});

  // Find the winning choice
  let winningChoice = "Unknown";
  let maxVotingPower = 0;

  for (const [choice, votingPower] of Object.entries(votesByChoice)) {
    if (votingPower > maxVotingPower) {
      maxVotingPower = votingPower;
      winningChoice = choice;
    }
  }

  const winningPercentage = (maxVotingPower / totalVotingPower) * 100;

  return (
    <div className="flex h-[calc(100vh-114px)] w-full flex-col rounded-lg border border-gray-600 bg-white p-6">
      {/* <h2 className="mb-4 text-2xl font-semibold">{proposal.name}</h2>
      <div className="flex flex-grow flex-col space-y-4">
        <div className="flex h-4 w-full overflow-hidden rounded-md bg-gray-200">
          <div
            className="h-full bg-green-500"
            style={{ width: `${winningPercentage}%` }}
          />
        </div>
        <div className="flex w-full justify-between">
          <div className="truncate text-sm font-bold text-gray-800">
            {winningChoice}
          </div>
          <div className="text-sm text-gray-800">
            {formatNumberWithSuffix(totalVotingPower)}
          </div>
        </div>
        <div className="text-sm text-gray-600">
          Winning with {winningPercentage.toFixed(2)}% of the votes.
        </div>
      </div> */}
    </div>
  );
};
