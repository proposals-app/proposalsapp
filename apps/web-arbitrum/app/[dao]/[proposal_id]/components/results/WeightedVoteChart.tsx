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

export function WeightedVoteChart({ proposal }: ResultProps) {
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

    // Create separate arrays to track each choice's weighted votes
    const choiceVotes: {
      [key: string]: { timestamp: number; weightedPower: number }[];
    } = {};
    uniqueChoices.forEach(({ index }) => {
      choiceVotes[index] = [];
    });

    // Process each vote
    proposal.votes.forEach((vote) => {
      if (!vote.timeCreated || !vote.votingPower) return;

      const timestamp = new Date(vote.timeCreated!).getTime();
      let totalVotingPower = vote.votingPower;

      // Ensure choice is an object and process it
      if (typeof vote.choice !== "object" || vote.choice === null) {
        console.warn("Invalid choice format for a weighted vote:", vote);
        return;
      }

      const choices = vote.choice as { [key: string]: number };

      // Calculate the sum of all fractions in the choice object
      const fractionSum = Object.values(choices).reduce(
        (sum, fraction) => sum + fraction,
        0,
      );

      if (fractionSum === 0) {
        console.warn("Sum of fractions is zero for a weighted vote:", vote);
        return;
      }

      // Normalize each fraction and calculate the weighted power
      Object.entries(choices).forEach(([choiceIndexString, fraction]) => {
        const choiceIndex = parseInt(choiceIndexString) - 1; // Convert to 0-based index
        if (
          !uniqueChoices.some(
            (choice) => parseInt(choice.index) === choiceIndex,
          )
        ) {
          console.warn(
            `Choice index ${choiceIndex} not found in proposal choices.`,
          );
          return;
        }
        const normalizedFraction = fraction / fractionSum;
        const weightedPower = totalVotingPower * normalizedFraction;

        // Add the weighted voting power to the corresponding choice's timestamp
        choiceVotes[choiceIndex].push({
          timestamp,
          weightedPower: weightedPower,
        });
      });
    });

    // Create data points for all timestamps where any vote occurred
    const allTimestamps = Array.from(
      new Set(proposal.votes.map((v) => new Date(v.timeCreated!).getTime())),
    ).sort((a, b) => a - b);

    // Initialize an array to hold the processed data points
    const processedPoints: { timestamp: number; [key: string]: number }[] = [];

    // Create the processed data points
    allTimestamps.forEach((timestamp) => {
      const point: { timestamp: number; [key: string]: number } = { timestamp };
      uniqueChoices.forEach(({ index }) => {
        const choiceHistory = choiceVotes[index];
        let totalWeightedPower = 0;

        choiceHistory
          .filter((v) => v.timestamp <= timestamp)
          .forEach((v) => (totalWeightedPower += v.weightedPower));

        point[index] = totalWeightedPower;
      });
      processedPoints.push(point);
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
        <div className="h-96 w-full">
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
                formatter={(value: number, name: string) =>
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
