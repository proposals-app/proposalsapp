import { Selectable, Vote } from "@proposalsapp/db";
import { Proposal } from "../ResultEndedEvent";
import { useMemo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shadcn/ui/tooltip";
import { cn } from "@/shadcn/lib/utils";

interface SingleChoiceVoteProps {
  proposal: Proposal;
  votes: Selectable<Vote>[];
}

interface ProcessedVote {
  choice: string;
  votingPower: number;
  voter: string;
}

const DEFAULT_COLORS = [
  "#36A2EB", // Blue
  "#4BC0C0", // Teal
  "#9966FF", // Purple
  "#FF9F40", // Orange
  "#C9CBCF", // Gray
];

const MIN_VISIBLE_WIDTH_PERCENT = 1; // Minimum width for a vote to be visible (0.5% of total width)

const calculateTopVotesCount = (
  totalVotes: number,
  votingPowerThreshold: number,
  votes: ProcessedVote[],
) => {
  // If very few votes, show all of them
  if (totalVotes <= 5) return totalVotes;

  // Calculate the number of votes that exceed the voting power threshold
  const significantVotesCount = votes.filter(
    (vote) => vote.votingPower >= votingPowerThreshold,
  ).length;

  // For larger numbers, use a combination of count and voting power threshold
  if (totalVotes <= 100) return Math.min(10, significantVotesCount);
  if (totalVotes <= 1000) return Math.min(8, significantVotesCount);
  if (totalVotes <= 10000) return Math.min(6, significantVotesCount);
  return Math.min(4, significantVotesCount);
};

const calculateVotingPowerThreshold = (
  votes: ProcessedVote[],
  totalVotingPower: number,
) => {
  // Sort votes by voting power in descending order
  const sortedVotes = [...votes].sort((a, b) => b.votingPower - a.votingPower);

  // Calculate cumulative voting power
  let cumulativePower = 0;
  let threshold = 0;

  // Find the voting power that represents the top 95% of total voting power
  for (const vote of sortedVotes) {
    cumulativePower += vote.votingPower;
    if (cumulativePower >= totalVotingPower * 0.95) {
      threshold = vote.votingPower;
      break;
    }
  }

  return threshold;
};

export const SingleChoiceVote = ({
  proposal,
  votes,
}: SingleChoiceVoteProps) => {
  const { votesByChoice, totalVotingPower } = useMemo(() => {
    const sortedVotes = [...votes]
      .filter((vote) => vote.votingPower)
      .sort((a, b) => Number(b.votingPower) - Number(a.votingPower));

    const processVote = (vote: Selectable<Vote>): ProcessedVote => {
      const choiceIndex = vote.choice as number;
      const choiceText =
        (proposal.choices as string[])[choiceIndex] || "Unknown";
      return {
        choice: choiceText,
        votingPower: Number(vote.votingPower),
        voter: vote.voterAddress,
      };
    };

    const processedVotes = sortedVotes.map(processVote);
    const total = processedVotes.reduce(
      (sum, vote) => sum + vote.votingPower,
      0,
    );

    // Group votes by choice
    const groupedVotes = processedVotes.reduce<Record<string, ProcessedVote[]>>(
      (acc, vote) => {
        if (!acc[vote.choice]) {
          acc[vote.choice] = [];
        }
        acc[vote.choice].push(vote);
        return acc;
      },
      {},
    );

    // Process each choice's votes
    const votesByChoice = Object.entries(groupedVotes).reduce<
      Record<
        string,
        {
          topVotes: ProcessedVote[];
          aggregated: { votingPower: number; count: number };
        }
      >
    >((acc, [choice, votes]) => {
      const sortedVotes = [...votes].sort(
        (a, b) => b.votingPower - a.votingPower,
      );

      // Calculate the voting power threshold for this choice
      const votingPowerThreshold = calculateVotingPowerThreshold(
        sortedVotes,
        sortedVotes.reduce((sum, vote) => sum + vote.votingPower, 0),
      );

      // Get number of top votes to show
      const topVotesCount = calculateTopVotesCount(
        sortedVotes.length,
        votingPowerThreshold,
        sortedVotes,
      );

      // Split votes into significant and remaining
      const significantVotes = sortedVotes.filter(
        (vote) => vote.votingPower >= votingPowerThreshold,
      );

      // Take either the calculated top votes or significant votes, whichever is smaller
      const topVotes = sortedVotes
        .slice(0, Math.min(topVotesCount, significantVotes.length))
        .filter(
          (vote) =>
            (vote.votingPower / total) * 100 >= MIN_VISIBLE_WIDTH_PERCENT,
        ); // Ensure top votes are visible

      const remaining = sortedVotes.slice(topVotes.length);

      const aggregated = remaining.reduce(
        (sum, vote) => ({
          votingPower: sum.votingPower + vote.votingPower,
          count: sum.count + 1,
        }),
        { votingPower: 0, count: 0 },
      );

      acc[choice] = { topVotes, aggregated };
      return acc;
    }, {} as any);

    return { votesByChoice, totalVotingPower: total };
  }, [votes, proposal.choices]);

  if (!totalVotingPower) {
    return <div>No votes recorded</div>;
  }

  const VoteSegment = ({
    color,
    width,
    tooltip,
    isAggregated = false,
  }: {
    color: string;
    width: number;
    tooltip: string;
    isAggregated?: boolean;
  }) => {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`h-full border-r border-white hover:opacity-90`}
            style={{
              width: `${width}%`,
              ...(isAggregated
                ? {
                    background: `repeating-linear-gradient(
                                  90deg,
                                  ${color} 0px,
                                  ${color} 1px,
                                  transparent 1px,
                                  transparent 2px
                                )`,
                  }
                : { backgroundColor: color }),
            }}
          />
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          className={cn("z-50 max-w-32")}
        >
          <p className="text-sm">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex h-4 w-full overflow-hidden rounded-md">
          {Object.entries(votesByChoice).map(([choice, voteData], index) => {
            const color = DEFAULT_COLORS[index % DEFAULT_COLORS.length];
            return (
              <>
                {/* Top votes for this choice */}
                {voteData.topVotes.map((vote, index) => (
                  <VoteSegment
                    key={`${choice}-top-${index}`}
                    color={color}
                    width={(vote.votingPower / totalVotingPower) * 100}
                    tooltip={`${vote.voter.slice(0, 4)}...${vote.voter.slice(-4)}: ${vote.votingPower.toLocaleString()} voting power`}
                  />
                ))}

                {/* Aggregated remaining votes for this choice */}
                {voteData.aggregated.votingPower > 0 && (
                  <VoteSegment
                    key={`${choice}-aggregated`}
                    color={color}
                    width={
                      (voteData.aggregated.votingPower / totalVotingPower) * 100
                    }
                    tooltip={`${
                      voteData.aggregated.count
                    } more votes with ${voteData.aggregated.votingPower.toLocaleString()} total voting power`}
                    isAggregated={true}
                  />
                )}
              </>
            );
          })}
        </div>
        {/* Render the legend */}
        <VoteLegend
          choices={Object.keys(votesByChoice)}
          colors={DEFAULT_COLORS}
        />
      </div>
    </TooltipProvider>
  );
};

const VoteLegend = ({
  choices,
  colors,
}: {
  choices: string[];
  colors: string[];
}) => {
  return (
    <div className="mt-4 flex flex-wrap gap-4">
      {choices.map((choice, index) => (
        <div key={choice} className="flex items-center gap-2">
          <div
            className="h-4 w-4 rounded-sm"
            style={{ backgroundColor: colors[index % colors.length] }}
          />
          <span className="text-sm">{choice}</span>
        </div>
      ))}
    </div>
  );
};
