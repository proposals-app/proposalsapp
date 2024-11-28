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
        choice: vote.choice as number[],
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    if (sortedVotes.length === 0) {
      return { processedData: [], choices: [] };
    }

    // Create time windows
    const timestamps = Array.from(new Set(sortedVotes.map((v) => v.timestamp)));

    // Initialize vote tally for each timestamp
    const voteTally: VoteTally = {};
    timestamps.forEach((timestamp) => {
      voteTally[timestamp] = {};

      if (proposal.choices && Array.isArray(proposal.choices))
        proposal.choices.forEach((_, index) => {
          voteTally[timestamp][index] = 0;
        });
    });

    // Calculate cumulative votes at each timestamp
    let currentVotes: ProcessedVote[] = [];
    timestamps.forEach((timestamp) => {
      // Add new votes for this timestamp
      const newVotes = sortedVotes.filter((v) => v.timestamp <= timestamp);
      currentVotes = newVotes;

      // Count first choices for current state
      currentVotes.forEach((vote) => {
        if (vote.choice.length > 0) {
          const firstChoice = vote.choice[0];
          voteTally[timestamp][firstChoice] =
            (voteTally[timestamp][firstChoice] || 0) + vote.votingPower;
        }
      });
    });

    // Convert tally to chart data format
    const processedPoints = timestamps.map((timestamp) => {
      const point: { [key: string]: number } = { timestamp };
      Object.entries(voteTally[timestamp]).forEach(([choice, votes]) => {
        point[choice] = votes;
      });
      return point;
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
                formatter={(value: number) => [`${value.toFixed(2)} VP`, ""]}
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
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
