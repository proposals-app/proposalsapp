"use client";

import { Card, CardContent, CardTitle } from "@/shadcn/ui/card";
import { useMemo } from "react";
import { Proposal, Selectable, Vote } from "@proposalsapp/db";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ResultProps {
  proposal: Selectable<Proposal> & {
    votes: Selectable<Vote>[];
  };
}

export function RankedChoiceVoteChart({ proposal }: ResultProps) {
  const { finalResult, choices } = useMemo(() => {
    if (!proposal.votes || proposal.votes.length === 0)
      return { finalResult: [], choices: [] };

    // Ensure choices are available
    if (!proposal.choices) {
      console.warn("No choices available for this proposal.");
      return { finalResult: [], choices: [] };
    }

    const uniqueChoices = proposal.choices.map((choice, index) => ({
      index: index.toString(),
      label: choice,
      votes: 0,
    }));

    // Create a map of votes
    const voteMap: { [key: string]: number[] } = {};
    proposal.votes.forEach((vote) => {
      if (!Array.isArray(vote.choice)) return;
      voteMap[vote.id] = vote.choice.map(String);
    });

    let remainingChoices = uniqueChoices.slice();
    while (remainingChoices.length > 1) {
      const firstChoiceVotes: { [key: string]: number } = {};

      // Count votes for each choice
      Object.values(voteMap).forEach((choices) => {
        const firstChoice = choices[0];
        if (firstChoiceVotes[firstChoice] === undefined) {
          firstChoiceVotes[firstChoice] = 0;
        }
        firstChoiceVotes[firstChoice]++;
      });

      // Find the choice with the least votes
      const minVotes = Math.min(...Object.values(firstChoiceVotes));
      const choicesToRemove = Object.keys(firstChoiceVotes).filter(
        (choice) => firstChoiceVotes[choice] === minVotes,
      );

      if (choicesToRemove.length > 0) {
        // Remove the choice with the least votes from remaining choices
        choicesToRemove.forEach((choiceToRemove) => {
          remainingChoices = remainingChoices.filter(
            (choice) => choice.index !== choiceToRemove,
          );
        });

        // Update vote map by removing the eliminated choices and moving to the next preference
        Object.keys(voteMap).forEach((voteId) => {
          const currentPreferences = voteMap[voteId];
          voteMap[voteId] = currentPreferences.filter(
            (choiceIndex) =>
              !choicesToRemove.some(
                (choiceToRemove) => choiceToRemove === choiceIndex,
              ),
          );
        });
      }
    }

    // Final result is the remaining choices
    return {
      finalResult: remainingChoices,
      choices: uniqueChoices.map(({ label }) => label),
    };
  }, [proposal.votes, proposal.choices]);

  if (finalResult.length === 0) {
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

  const chartData = finalResult.map((choice, index) => ({
    name: choice.label,
    value: index === 0 ? 100 : 0, // Assuming the winner gets 100%, others get 0%
  }));

  return (
    <Card className="bg-white">
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis type="number" domain={[0, 100]} />
              <Tooltip formatter={(value) => [value, "%"]} />
              <Legend />
              {choices.map((choice, index) => (
                <Line
                  key={index}
                  type="monotone"
                  dataKey="value"
                  stroke={colors[index % colors.length]}
                  name={choice}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
