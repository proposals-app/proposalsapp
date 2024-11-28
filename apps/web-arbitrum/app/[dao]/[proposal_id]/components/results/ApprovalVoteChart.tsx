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
import { Card, CardContent, CardTitle } from "@/shadcn/ui/card";
import { useMemo } from "react";
import { Proposal, Selectable, Vote } from "@proposalsapp/db";
import { isArray } from "util";

interface ResultProps {
  proposal: Selectable<Proposal> & {
    votes: Selectable<Vote>[];
  };
}

export function ApprovalVoteChart({ proposal }: ResultProps) {
  const { processedData, choices } = useMemo(() => {
    if (!proposal.votes || proposal.votes.length === 0)
      return { processedData: [], choices: [] };

    // Ensure choices are available
    if (!proposal.choices || !Array.isArray(proposal.choices)) {
      console.warn("No choices available for this proposal.");
      return { processedData: [], choices: [] };
    }

    const uniqueChoices = proposal.choices.map((choice, index) => ({
      index: index.toString(),
      label: choice,
    }));

    // Create separate arrays to track each choice's votes
    const choiceVotes: {
      [key: string]: number;
    } = {};
    uniqueChoices.forEach(({ index }) => {
      choiceVotes[index] = 0;
    });

    // Process each vote
    proposal.votes.forEach((vote) => {
      if (!Array.isArray(vote.choice)) return;

      vote.choice.forEach((choiceIndex) => {
        const choiceStr = choiceIndex?.toString() ?? 0;
        if (choiceVotes[choiceStr]) {
          choiceVotes[choiceStr] += 1;
        }
      });
    });

    // Create the processed data points
    const processedPoints = uniqueChoices.map(({ index, label }) => ({
      name: label,
      value: choiceVotes[index],
    }));

    return {
      processedData: processedPoints,
      choices: uniqueChoices.map(({ label }) => label),
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
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => [value, "Votes"]} />
              <Legend />
              {choices.map((choice, index) => (
                <Line
                  key={index}
                  type="monotone"
                  dataKey="value"
                  stroke={colors[index % colors.length]}
                  name={choice?.toString() ?? `Choice ${index}`}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
