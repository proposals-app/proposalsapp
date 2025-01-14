import { Selectable, Vote } from "@proposalsapp/db";
import { Proposal } from "../ResultEvent";
import { useMemo } from "react";
import { formatNumberWithSuffix } from "@/lib/utils";

interface ApprovalVoteProps {
  proposal: Proposal;
  votes: Selectable<Vote>[];
}

export const ApprovalVote = ({ proposal, votes }: ApprovalVoteProps) => {
  const { winningChoice, totalVotingPower, winningPercentage, maxVotingPower } =
    useMemo(() => {
      // Process votes where each vote can approve multiple choices
      const voteCounts: { [choice: number]: number } = {};
      const choices = proposal.choices as string[];

      // Initialize vote counts
      choices.forEach((_, index) => {
        voteCounts[index] = 0;
      });

      // Process each vote
      votes.forEach((vote) => {
        const approvedChoices = Array.isArray(vote.choice)
          ? (vote.choice as number[])
          : [vote.choice as number];

        approvedChoices.forEach((choice) => {
          const choiceIndex = choice - 1; // Convert to 0-based index
          voteCounts[choiceIndex] =
            (voteCounts[choiceIndex] || 0) + Number(vote.votingPower);
        });
      });

      // Find the winning choice
      let winningChoice = "Unknown";
      let maxVotingPower = 0;

      for (const [choice, votingPower] of Object.entries(voteCounts)) {
        if (votingPower > maxVotingPower) {
          maxVotingPower = votingPower;
          winningChoice = choices[Number(choice)] || "Unknown";
        }
      }

      const totalVotingPower = Object.values(voteCounts).reduce(
        (sum, power) => sum + power,
        0,
      );

      const winningPercentage = (maxVotingPower / totalVotingPower) * 100;

      return {
        winningChoice,
        totalVotingPower,
        winningPercentage,
        maxVotingPower,
      };
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
          {formatNumberWithSuffix(maxVotingPower)}
        </div>
      </div>
    </div>
  );
};
