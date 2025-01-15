import { Selectable, Vote } from "@proposalsapp/db";
import { Proposal } from "../ResultEvent";
import { useMemo } from "react";
import { formatNumberWithSuffix } from "@/lib/utils";

interface RankedChoiceVoteProps {
  proposal: Proposal;
  votes: Selectable<Vote>[];
}

export const RankedChoiceVote = ({
  proposal,
  votes,
}: RankedChoiceVoteProps) => {
  const { winningChoice, totalVotingPower, winningPercentage, maxVotingPower } =
    useMemo(() => {
      const choices = proposal.choices as string[];
      let remainingChoices = new Set(choices.map((_, index) => index));
      let voteCounts: { [choice: number]: number } = {};
      let eliminatedChoices: number[] = [];
      let winner: number | null = null;

      // Initialize vote counts
      const initializeVoteCounts = () => {
        choices.forEach((_, index) => {
          voteCounts[index] = 0;
        });
      };

      // Run instant-runoff rounds
      while (remainingChoices.size > 1) {
        initializeVoteCounts();

        // Count votes for each choice
        votes.forEach((vote) => {
          const rankedChoices = Array.isArray(vote.choice)
            ? (vote.choice as number[])
            : [vote.choice as number];

          // Find the highest-ranked remaining choice
          const validChoice = rankedChoices.find((choice) =>
            remainingChoices.has(choice - 1),
          );

          if (validChoice !== undefined) {
            voteCounts[validChoice - 1] += Number(vote.votingPower);
          }
        });

        // Calculate total votes in this round
        const totalVotes = Object.values(voteCounts).reduce(
          (sum, power) => sum + power,
          0,
        );

        // Check if any choice has a majority
        for (const [choice, votes] of Object.entries(voteCounts)) {
          if (votes / totalVotes > 0.5) {
            winner = Number(choice);
            break;
          }
        }

        if (winner !== null) {
          break;
        }

        // Find the choice with the fewest votes
        let minVotes = Infinity;
        let choiceToEliminate = -1;

        remainingChoices.forEach((choice) => {
          if (voteCounts[choice] < minVotes) {
            minVotes = voteCounts[choice];
            choiceToEliminate = choice;
          }
        });

        // Eliminate the choice with the fewest votes
        remainingChoices.delete(choiceToEliminate);
        eliminatedChoices.push(choiceToEliminate);
      }

      // If no winner yet, the remaining choice is the winner
      if (winner === null) {
        winner = Array.from(remainingChoices)[0];
      }

      // Calculate final results
      const winningChoice = choices[winner] || "Unknown";
      const maxVotingPower = voteCounts[winner] || 0;

      const totalVotingPower = votes.reduce(
        (sum, vote) => sum + Number(vote.votingPower),
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