"use client";

import { useState } from "react";
import { ProcessedResults } from "../actions";
import { formatNumberWithSuffix } from "@/lib/utils";

interface ResultsListProps {
  results: ProcessedResults;
}

export function ResultsList({ results }: ResultsListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const totalVotingPower = results.totalVotingPower;

  // Calculate voting power for each choice
  const choicesWithPower = results.choices.map((choice, index) => ({
    choice,
    votingPower: results.votes.reduce((sum, vote) => {
      if (vote.choice === index) {
        return sum + vote.votingPower;
      } else if (vote.choice === -1 && vote.choiceText.includes(choice)) {
        // Handle weighted votes
        const choiceIndex = results.choices.indexOf(choice);
        const weight = vote.choiceText
          .split(", ")
          .find((c) => c.includes(choice))
          ?.match(/\((\d+\.?\d*)%\)/)?.[1];
        if (weight) {
          return sum + (vote.votingPower * parseFloat(weight)) / 100;
        }
      }
      return sum;
    }, 0),
    color: results.choiceColors[index],
  }));

  // Sort by voting power descending
  const sortedChoices = choicesWithPower.sort(
    (a, b) => b.votingPower - a.votingPower,
  );

  // Determine which choices to show
  const topChoices = isExpanded ? sortedChoices : sortedChoices.slice(0, 5);
  const otherChoices = isExpanded ? [] : sortedChoices.slice(5);

  // Calculate total voting power for "Other" choices
  const otherVotingPower = otherChoices.reduce(
    (sum, choice) => sum + choice.votingPower,
    0,
  );

  return (
    <div className="ml-6 w-64">
      <h3 className="mb-4 text-xl font-semibold">Vote Distribution</h3>
      <div className="space-y-2">
        {topChoices.map(({ choice, votingPower, color }, index) => {
          const percentage = (votingPower / totalVotingPower) * 100;
          return (
            <ChoiceBar
              key={index}
              choice={choice}
              votingPower={votingPower}
              color={color}
              percentage={percentage}
            />
          );
        })}

        {otherChoices.length > 0 && (
          <div
            className="cursor-pointer hover:opacity-80"
            onClick={() => setIsExpanded(true)}
          >
            <ChoiceBar
              choice="Other"
              votingPower={otherVotingPower}
              color="#CBD5E1" // Default grey color
              percentage={(otherVotingPower / totalVotingPower) * 100}
            />
          </div>
        )}

        {isExpanded && (
          <button
            className="mt-2 text-sm text-gray-600 hover:text-gray-900"
            onClick={() => setIsExpanded(false)}
          >
            Show less
          </button>
        )}
      </div>
    </div>
  );
}

interface ChoiceBarProps {
  choice: string;
  votingPower: number;
  color: string;
  percentage: number;
}

function ChoiceBar({ choice, votingPower, color, percentage }: ChoiceBarProps) {
  return (
    <div className="relative h-10 w-full rounded-lg border border-gray-600 bg-gray-100">
      {/* Bar with percentage width */}
      <div
        className="absolute left-0 top-0 h-full rounded-lg opacity-85"
        style={{
          width: `${percentage}%`,
          backgroundColor: color,
        }}
      />

      {/* Text content */}
      <div className="absolute inset-0 flex items-center justify-between px-3">
        {/* Left side - Choice name */}
        <span className="max-w-[50%] truncate text-sm font-bold">{choice}</span>

        {/* Right side - Percentage and voting power */}
        <span className="text-xs font-light">
          {percentage.toFixed(1)}%{" "}
          <span className="font-bold">
            {formatNumberWithSuffix(votingPower)}
          </span>
        </span>
      </div>
    </div>
  );
}
