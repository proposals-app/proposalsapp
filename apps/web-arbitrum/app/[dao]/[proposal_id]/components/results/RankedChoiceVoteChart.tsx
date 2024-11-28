import { useMemo } from "react";
import {
  Line,
  LineChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/shadcn/ui/card";
import { Proposal, Selectable, Vote } from "@proposalsapp/db";

interface ResultProps {
  proposal: Selectable<Proposal> & {
    votes: Selectable<Vote>[];
  };
}

type ProcessedVote = {
  timestamp: number;
  votingPower: number;
  choice: number[];
};

type VoteTally = {
  [timestamp: number]: {
    [choice: string]: number;
  };
};

type RoundResult = {
  voteCounts: { [choice: number]: number };
  eliminated: number[];
  winner?: number;
};

export function RankedChoiceVoteChart({ proposal }: ResultProps) {
  const { processedData, choices } = useMemo(() => {
    if (
      !proposal.votes ||
      proposal.votes.length === 0 ||
      !Array.isArray(proposal.choices)
    ) {
      return { processedData: [], choices: [] };
    }

    // Sort votes by timestamp
    const sortedVotes = proposal.votes
      .filter((vote) => vote.timeCreated && Array.isArray(vote.choice))
      .map((vote) => ({
        timestamp: new Date(vote.timeCreated!).getTime(),
        votingPower: Number(vote.votingPower),
        choice: (vote.choice as number[]).map((c) => c - 1), // Convert to 0-based index
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    if (sortedVotes.length === 0) {
      return { processedData: [], choices: [] };
    }

    // Function to run one round of IRV counting
    const countIRVRound = (
      votes: ProcessedVote[],
      eliminatedChoices: number[],
    ): RoundResult => {
      const voteCounts: { [key: number]: number } = {};
      let totalVotingPower = 0;

      // Count votes for each choice
      votes.forEach((vote) => {
        // Find the highest-ranked choice that hasn't been eliminated
        const validChoice = vote.choice.find(
          (choice) => !eliminatedChoices.includes(choice),
        );
        if (validChoice !== undefined) {
          voteCounts[validChoice] =
            (voteCounts[validChoice] || 0) + vote.votingPower;
          totalVotingPower += vote.votingPower;
        }
      });

      // Check if any choice has majority
      const majorityThreshold = totalVotingPower / 2;
      let winner: number | undefined;
      Object.entries(voteCounts).forEach(([choice, votes]) => {
        if (votes > majorityThreshold) {
          winner = parseInt(choice);
        }
      });

      // If no winner, find choice with fewest votes to eliminate
      let toEliminate: number | undefined;
      if (!winner) {
        let minVotes = Infinity;
        Object.entries(voteCounts).forEach(([choice, votes]) => {
          if (
            votes < minVotes &&
            !eliminatedChoices.includes(parseInt(choice))
          ) {
            minVotes = votes;
            toEliminate = parseInt(choice);
          }
        });
      }

      return {
        voteCounts,
        eliminated:
          toEliminate !== undefined
            ? [...eliminatedChoices, toEliminate]
            : eliminatedChoices,
        winner,
      };
    };

    // Create time windows
    const timestamps = Array.from(new Set(sortedVotes.map((v) => v.timestamp)));

    // Process votes at each timestamp using IRV
    const processedPoints = timestamps.map((timestamp) => {
      const currentVotes = sortedVotes.filter((v) => v.timestamp <= timestamp);
      let eliminated: number[] = [];
      let result: RoundResult;
      let finalVoteCounts: { [key: number]: number } = {};

      if (proposal.choices && Array.isArray(proposal.choices))
        // Run IRV rounds until we have a winner or no more choices to eliminate
        do {
          result = countIRVRound(currentVotes, eliminated);
          finalVoteCounts = result.voteCounts;
          eliminated = result.eliminated;
        } while (
          !result.winner &&
          eliminated.length < proposal.choices.length - 1
        );

      return {
        timestamp,
        ...finalVoteCounts,
      };
    });

    // Add initial zero point
    if (processedPoints.length > 0) {
      const zeroPoint = {
        timestamp: processedPoints[0].timestamp,
        ...Object.fromEntries(
          proposal.choices.map((_, index) => [index.toString(), 0]),
        ),
      };
      processedPoints.unshift(zeroPoint);
    }

    return {
      processedData: processedPoints,
      choices: proposal.choices as string[],
    };
  }, [proposal.votes, proposal.choices]);

  if (processedData.length === 0) {
    return (
      <Card className="bg-white">
        <CardContent className="flex h-64 items-center justify-center text-gray-500">
          No voting data available
        </CardContent>
      </Card>
    );
  }

  // Format date to show month and day only
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(date);
  };

  const colors = [
    "#2563eb", // blue-600
    "#dc2626", // red-600
    "#16a34a", // green-600
    "#9333ea", // purple-600
    "#ca8a04", // yellow-600
    "#0891b2", // cyan-600
  ];

  return (
    <Card className="bg-white">
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={processedData}
              margin={{ left: 0, right: 20, top: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatDate}
                type="number"
                domain={["auto", "auto"]}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(label) => formatDate(label as number)}
                formatter={(value: number, name: string) => [
                  `${value.toFixed(2)} VP`,
                  `${name}`,
                ]}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              {choices.map((choice: string, index: number) => (
                <Line
                  key={index}
                  type="monotone"
                  dataKey={index.toString()}
                  name={choice}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
