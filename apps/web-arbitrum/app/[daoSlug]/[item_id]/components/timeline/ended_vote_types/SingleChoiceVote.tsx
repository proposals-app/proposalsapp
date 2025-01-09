import { Selectable, Vote } from "@proposalsapp/db";
import { Proposal } from "../ResultEndedEvent";
import { useMemo } from "react";
import { formatNumberWithSuffix } from "@/lib/utils";

interface SingleChoiceVoteProps {
  proposal: Proposal;
  votes: Selectable<Vote>[];
}

export const SingleChoiceVote = ({
  proposal,
  votes,
}: SingleChoiceVoteProps) => {
  const { winningChoice, totalVotingPower, winningPercentage } = useMemo(() => {
    const sortedVotes = [...votes]
      .filter((vote) => vote.votingPower)
      .sort((a, b) => Number(b.votingPower) - Number(a.votingPower));

    const processVote = (
      vote: Selectable<Vote>,
    ): { choice: string; votingPower: number } => {
      const choiceIndex = vote.choice as number;
      const choiceText =
        (proposal.choices as string[])[choiceIndex] || "Unknown";
      return {
        choice: choiceText,
        votingPower: Number(vote.votingPower),
      };
    };

    const processedVotes = sortedVotes.map(processVote);
    const totalVotingPower = processedVotes.reduce(
      (sum, vote) => sum + vote.votingPower,
      0,
    );

    // Group votes by choice
    const groupedVotes = processedVotes.reduce<Record<string, number>>(
      (acc, vote) => {
        if (!acc[vote.choice]) {
          acc[vote.choice] = 0;
        }
        acc[vote.choice] += vote.votingPower;
        return acc;
      },
      {},
    );

    // Find the winning choice
    let winningChoice = "Unknown";
    let maxVotingPower = 0;

    for (const [choice, votingPower] of Object.entries(groupedVotes)) {
      if (votingPower > maxVotingPower) {
        maxVotingPower = votingPower;
        winningChoice = choice;
      }
    }

    const winningPercentage = (maxVotingPower / totalVotingPower) * 100;

    return { winningChoice, totalVotingPower, winningPercentage };
  }, [votes, proposal.choices]);

  return (
    <div className="flex-col items-center justify-between">
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
    </div>
  );
};
