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

interface BasicVoteProps {
  proposal: Proposal;
  votes: Selectable<Vote>[];
}

interface ProcessedVote {
  choice: VoteChoice;
  votingPower: number;
  voter: string;
}

type VoteChoice = "For" | "Against" | "Abstain" | "Unknown";

const VOTE_COLORS = {
  For: "bg-green-500",
  Against: "bg-red-500",
  Abstain: "bg-yellow-500",
  Unknown: "bg-gray-500",
} as const;

const calculateTopVotesCount = (
  totalVotes: number,
  votingPowerThreshold: number,
) => {
  // If very few votes, show all of them
  if (totalVotes <= 5) return totalVotes;

  // For larger numbers, use a combination of count and voting power threshold
  if (totalVotes <= 100) return Math.min(10, totalVotes);
  if (totalVotes <= 1000) return Math.min(8, totalVotes);
  if (totalVotes <= 10000) return Math.min(6, totalVotes);
  return Math.min(4, totalVotes);
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

  // Find the voting power that represents the top 80% of total voting power
  for (const vote of sortedVotes) {
    cumulativePower += vote.votingPower;
    if (cumulativePower >= totalVotingPower * 0.8) {
      threshold = vote.votingPower;
      break;
    }
  }

  return threshold;
};

export const BasicVote = ({ proposal, votes }: BasicVoteProps) => {
  const { votesByChoice, totalVotingPower } = useMemo(() => {
    const sortedVotes = [...votes]
      .filter((vote) => vote.votingPower)
      .sort((a, b) => Number(b.votingPower) - Number(a.votingPower));

    const processVote = (vote: Selectable<Vote>): ProcessedVote => {
      const choiceIndex = vote.choice as number;
      const choiceText = (proposal.choices as string[])[
        choiceIndex
      ]?.toLowerCase();
      let choice: VoteChoice = "Unknown";

      if (
        choiceText?.includes("for") ||
        choiceText?.includes("yes") ||
        choiceText?.includes("yae")
      ) {
        choice = "For";
      } else if (
        choiceText?.includes("against") ||
        choiceText?.includes("no") ||
        choiceText?.includes("nay")
      ) {
        choice = "Against";
      } else if (choiceText?.includes("abstain")) {
        choice = "Abstain";
      }

      return {
        choice,
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
    const groupedVotes = processedVotes.reduce<
      Record<VoteChoice, ProcessedVote[]>
    >(
      (acc, vote) => {
        acc[vote.choice].push(vote);
        return acc;
      },
      {
        For: [],
        Against: [],
        Abstain: [],
        Unknown: [],
      },
    );

    // Process each choice's votes
    const votesByChoice = Object.entries(groupedVotes).reduce<
      Record<
        VoteChoice,
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
      );

      // Split votes into significant and remaining
      const significantVotes = sortedVotes.filter(
        (vote) => vote.votingPower >= votingPowerThreshold,
      );

      // Take either the calculated top votes or significant votes, whichever is smaller
      const topVotes = sortedVotes.slice(
        0,
        Math.min(topVotesCount, significantVotes.length),
      );

      const remaining = sortedVotes.slice(topVotes.length);

      const aggregated = remaining.reduce(
        (sum, vote) => ({
          votingPower: sum.votingPower + vote.votingPower,
          count: sum.count + 1,
        }),
        { votingPower: 0, count: 0 },
      );

      acc[choice as VoteChoice] = { topVotes, aggregated };
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
    color: keyof typeof colorMap;
    width: number;
    tooltip: string;
    isAggregated?: boolean;
  }) => {
    const colorMap = {
      "bg-green-500": "#22c55e",
      "bg-red-500": "#ef4444",
      "bg-yellow-500": "#eab308",
      "bg-gray-500": "#6b7280",
    } as const;

    const cssColor = colorMap[color] || "#6b7280";

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
                      ${cssColor} 0px,
                      ${cssColor} 1px,
                      transparent 1px,
                      transparent 2px
                    )`,
                  }
                : { backgroundColor: cssColor }),
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
        <div className="flex h-6 w-full overflow-hidden rounded-full">
          {(["For", "Abstain", "Against", "Unknown"] as const).map((choice) => {
            const voteData = votesByChoice[choice];
            if (!voteData) return null;

            return (
              <>
                {/* Top votes for this choice */}
                {voteData.topVotes.map((vote, index) => (
                  <VoteSegment
                    key={`${choice}-top-${index}`}
                    color={VOTE_COLORS[choice]}
                    width={(vote.votingPower / totalVotingPower) * 100}
                    tooltip={`${vote.voter.slice(0, 4)}...${vote.voter.slice(-4)}: ${vote.votingPower.toLocaleString()} voting power`}
                  />
                ))}

                {/* Aggregated remaining votes for this choice */}
                {voteData.aggregated.votingPower > 0 && (
                  <VoteSegment
                    key={`${choice}-aggregated`}
                    color={VOTE_COLORS[choice]}
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

        {/* Vote Type Legend */}
        {/* <div className="flex flex-wrap gap-4 text-sm">
          {(["For", "Against", "Abstain", "Unknown"] as const).map((type) => {
            const voteData = votesByChoice[type];
            if (!voteData) return null;

            const totalCount =
              voteData.topVotes.length + voteData.aggregated.count;
            if (totalCount === 0) return null;

            return (
              <div key={type} className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${VOTE_COLORS[type]}`} />
                <span>
                  {type}: {totalCount} votes
                </span>
              </div>
            );
          })}
        </div> */}
      </div>
    </TooltipProvider>
  );
};
