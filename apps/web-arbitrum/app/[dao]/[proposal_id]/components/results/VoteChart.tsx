"use client";

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
import { useMemo } from "react";

interface VoteChartProps {
  votes: VoteDataPoint[];
  choiceNames: Record<string, string>;
}

interface VoteDataPoint {
  timestamp: Date;
  choices: string[] | string;
  votingPower: number;
}

export function VoteChart({ votes, choiceNames }: VoteChartProps) {
  const { processedData, choices } = useMemo(() => {
    if (votes.length === 0) return { processedData: [], choices: [] };

    // Sort votes by timestamp
    const sortedVotes = [...votes].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );

    // Get all unique choice indices from the votes (they are 1-based)
    const uniqueChoices = Array.from(
      new Set(
        sortedVotes.flatMap((v) =>
          Array.isArray(v.choices) ? v.choices : [v.choices],
        ),
      ),
    ).sort((a, b) => Number(a) - Number(b));

    // Create separate arrays to track each choice's votes
    const choiceVotes: {
      [key: string]: { timestamp: number; total: number }[];
    } = {};
    uniqueChoices.forEach((choice) => {
      choiceVotes[choice] = [];
    });

    // Process each vote
    sortedVotes.forEach((vote) => {
      const timestamp = vote.timestamp.getTime();
      const voteChoices = Array.isArray(vote.choices)
        ? vote.choices
        : [vote.choices];

      // For each choice in this vote, add the vote to its tracking array
      voteChoices.forEach((choice) => {
        const previousTotal =
          choiceVotes[choice].length > 0
            ? choiceVotes[choice][choiceVotes[choice].length - 1].total
            : 0;
        choiceVotes[choice].push({
          timestamp,
          total: previousTotal + vote.votingPower,
        });
      });
    });

    // Create data points for all timestamps where any vote occurred
    const allTimestamps = Array.from(
      new Set(sortedVotes.map((v) => v.timestamp.getTime())),
    ).sort((a, b) => a - b);

    // Create the processed data points
    const processedPoints = allTimestamps.map((timestamp) => {
      const point: any = { timestamp };

      // For each choice, find its total at this timestamp
      uniqueChoices.forEach((choice) => {
        const choiceHistory = choiceVotes[choice];
        const latestVote = choiceHistory
          .filter((v) => v.timestamp <= timestamp)
          .pop();
        point[choice] = latestVote ? latestVote.total : 0;
      });

      return point;
    });

    // Add initial zero point
    if (processedPoints.length > 0) {
      const zeroPoint = {
        timestamp: processedPoints[0].timestamp,
        ...Object.fromEntries(uniqueChoices.map((choice) => [choice, 0])),
      };
      processedPoints.unshift(zeroPoint);
    }

    return {
      processedData: processedPoints,
      choices: uniqueChoices,
    };
  }, [votes]);

  // Format date to show month and day only
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(date);
  };

  // Calculate ticks manually to show only 5 evenly spaced dates
  const getCustomTicks = useMemo(() => {
    if (processedData.length === 0) return [];

    const firstTimestamp = processedData[0].timestamp;
    const lastTimestamp = processedData[processedData.length - 1].timestamp;
    const timeRange = lastTimestamp - firstTimestamp;

    return Array.from(
      { length: 5 },
      (_, i) => firstTimestamp + (timeRange * i) / 4,
    );
  }, [processedData]);

  if (processedData.length === 0) {
    return (
      <Card className="bg-white">
        <CardContent className="flex h-64 items-center justify-center text-gray-500">
          No voting data available
        </CardContent>
      </Card>
    );
  }

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
                ticks={getCustomTicks}
                type="number"
                domain={["auto", "auto"]}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(label) => formatDate(label as number)}
                formatter={(value, name) => [
                  value,
                  choiceNames[name] || `Choice ${name}`,
                ]}
              />
              <Legend
                formatter={(value) => choiceNames[value] || `Choice ${value}`}
                wrapperStyle={{ fontSize: "12px" }}
              />
              {choices.map((choice, index) => (
                <Line
                  key={choice}
                  type="stepAfter"
                  dataKey={choice}
                  name={choice.toString()}
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
