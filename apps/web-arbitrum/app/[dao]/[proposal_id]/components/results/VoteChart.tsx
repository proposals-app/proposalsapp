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
  choices: string[];
  votingPower: number;
}

export function VoteChart({ votes, choiceNames }: VoteChartProps) {
  const { processedData, choices } = useMemo(() => {
    if (votes.length === 0) return { processedData: [], choices: [] };

    // Sort votes by timestamp
    const sortedVotes = [...votes].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );

    // Get all unique choices
    const uniqueChoices = Array.from(
      new Set(sortedVotes.flatMap((v) => v.choices)),
    ).sort();

    // Process votes for each choice separately
    const choiceVoteSeries = uniqueChoices.map((choice) => {
      let cumulativeVotingPower = 0;
      return sortedVotes
        .filter((vote) => vote.choices.includes(choice))
        .map((vote) => {
          // For multiple choice votes, divide voting power among chosen options
          const votePowerPerChoice = vote.votingPower / vote.choices.length;
          cumulativeVotingPower += votePowerPerChoice;
          return {
            timestamp: vote.timestamp.getTime(),
            votingPower: cumulativeVotingPower,
            choice,
          };
        });
    });

    // Combine all timestamps and create data points
    const timestampSet = new Set(
      sortedVotes.map((vote) => vote.timestamp.getTime()),
    );
    const allTimestamps = Array.from(timestampSet).sort((a, b) => a - b);

    const data = allTimestamps.map((timestamp) => {
      const dataPoint: any = { timestamp };
      uniqueChoices.forEach((choice) => {
        const lastVoteBeforeTimestamp = choiceVoteSeries
          .find((series) => series[0]?.choice === choice)
          ?.filter((point) => point.timestamp <= timestamp)
          .pop();
        dataPoint[choice] = lastVoteBeforeTimestamp?.votingPower || 0;
      });
      return dataPoint;
    });

    // Add initial zero point
    if (data.length > 0) {
      data.unshift({
        timestamp: data[0].timestamp,
        ...Object.fromEntries(uniqueChoices.map((choice) => [choice, 0])),
      });
    }

    return {
      processedData: data,
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
              />
              <YAxis />
              <Tooltip
                labelFormatter={(label) => formatDate(label as number)}
                formatter={(value, name) => [
                  value,
                  choiceNames[name as string] || name,
                ]}
              />
              <Legend
                formatter={(value) => choiceNames[value] || value}
                wrapperStyle={{ fontSize: "12px" }}
              />
              {choices.map((choice, index) => (
                <Line
                  key={choice}
                  type="stepAfter"
                  dataKey={choice}
                  name={choiceNames[choice] || choice}
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
