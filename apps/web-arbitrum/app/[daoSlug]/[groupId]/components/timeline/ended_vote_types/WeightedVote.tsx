import { Selectable, Vote } from "@proposalsapp/db";
import { Proposal } from "../ResultEvent";
import { useMemo } from "react";
import { formatNumberWithSuffix } from "@/lib/utils";

interface WeightedVoteProps {
  proposal: Proposal;
  votes: Selectable<Vote>[];
}

export const WeightedVote = ({ proposal, votes }: WeightedVoteProps) => {
  const { winningChoice, totalVotingPower, winningPercentage, maxVotingPower } =
    useMemo(() => {
      // Process weighted votes where each vote can distribute voting power across multiple choices
      const voteCounts: { [choice: number]: number } = {};
      const choices = proposal.choices as string[];

      // Initialize vote counts
      choices.forEach((_, index) => {
        voteCounts[index] = 0;
      });

      // Process each vote
      votes.forEach((vote) => {
        if (
          typeof vote.choice === "object" &&
          vote.choice !== null &&
          !Array.isArray(vote.choice)
        ) {
          const weightedChoices = vote.choice as Record<string, number>;
          const totalWeight = Object.values(weightedChoices).reduce(
            (sum, weight) => sum + weight,
            0,
          );

          // Distribute voting power according to weights
          Object.entries(weightedChoices).forEach(([choice, weight]) => {
            const choiceIndex = parseInt(choice) - 1; // Convert to 0-based index
            const normalizedPower =
              (Number(vote.votingPower) * weight) / totalWeight;
            voteCounts[choiceIndex] =
              (voteCounts[choiceIndex] || 0) + normalizedPower;
          });
        } else {
          // Handle non-weighted votes (fallback to basic processing)
          const choice = (vote.choice as number) - 1; // Convert to 0-based index
          voteCounts[choice] =
            (voteCounts[choice] || 0) + Number(vote.votingPower);
        }
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
      <div className="flex h-4 w-full overflow-hidden rounded-md bg-muted">
        <div
          className="h-full bg-green-500"
          style={{ width: `${winningPercentage}%` }}
        />
      </div>
      <div className="flex w-full justify-between">
        <div className="truncate text-sm font-bold text-muted-foreground">
          {winningChoice}
        </div>
        <div className="text-sm text-muted-foreground">
          {formatNumberWithSuffix(maxVotingPower)}
        </div>
      </div>
    </div>
  );
};
