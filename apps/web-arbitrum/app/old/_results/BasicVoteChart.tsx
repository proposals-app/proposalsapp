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

export function BasicVoteChart({ proposal }: ResultProps) {
  const { processedData, choices } = useMemo(() => {
    if (!proposal.votes || proposal.votes.length === 0)
      return { processedData: [], choices: [] };

    // Ensure choices are available and is an array
    if (!Array.isArray(proposal.choices)) {
      console.warn("No choices available for this proposal.");
      return { processedData: [], choices: [] };
    }

    const uniqueChoices = proposal.choices.map((choice, index) => ({
      index: index.toString(),
      label: choice,
    }));

    // Create separate arrays to track each choice's votes
    const choiceVotes: {
      [key: string]: { timestamp: number; totalVotingPower: number }[];
    } = {};
    uniqueChoices.forEach(({ index }) => {
      choiceVotes[index] = [];
    });

    // Process each vote
    proposal.votes.forEach((vote) => {
      if (!vote.timeCreated || !vote.votingPower) return;

      const timestamp = new Date(vote.timeCreated!).getTime();
      let totalVotingPower = vote.votingPower;

      // Directly use the single number in vote.choice
      const choiceIndex = vote.choice as number;
      const choiceStr = choiceIndex.toString();

      if (choiceVotes[choiceStr]) {
        const previousTotal =
          choiceVotes[choiceStr].length > 0
            ? choiceVotes[choiceStr][choiceVotes[choiceStr].length - 1]
                .totalVotingPower
            : 0;
        choiceVotes[choiceStr].push({
          timestamp,
          totalVotingPower: previousTotal + totalVotingPower,
        });
      }
    });

    // Create data points for all timestamps where any vote occurred
    const allTimestamps = Array.from(
      new Set(proposal.votes.map((v) => new Date(v.timeCreated!).getTime())),
    ).sort((a, b) => a - b);

    // Create the processed data points
    const processedPoints = allTimestamps.map((timestamp) => {
      const point: { timestamp: number; [key: string]: number } = { timestamp };
      // For each choice, find its total at this timestamp
      uniqueChoices.forEach(({ index }) => {
        const choiceHistory = choiceVotes[index];
        const latestVote = choiceHistory
          .filter((v) => v.timestamp <= timestamp)
          .pop();
        point[index] = latestVote ? latestVote.totalVotingPower : 0;
      });
      return point;
    });

    // Add initial zero point
    if (processedPoints.length > 0) {
      const zeroPoint = {
        timestamp: processedPoints[0].timestamp,
        ...Object.fromEntries(uniqueChoices.map(({ index }) => [index, 0])),
      };
      processedPoints.unshift(zeroPoint);
    }

    return {
      processedData: processedPoints,
      choices: uniqueChoices.map(({ label }) => label),
    };
  }, [proposal.votes, proposal.choices]);

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
    "#16a34a", // green-600
    "#dc2626", // red-600
    "#ca8a04", // yellow-600
    "#2563eb", // blue-600
    "#9333ea", // purple-600
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
                formatter={(value, name) =>
                  name === undefined ? [value] : [value, `${name}`]
                }
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              {choices.map((choice, index) => (
                <Line
                  key={index}
                  type="stepAfter"
                  dataKey={index.toString()}
                  name={choice?.toString() ?? `Choice ${index}`}
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
