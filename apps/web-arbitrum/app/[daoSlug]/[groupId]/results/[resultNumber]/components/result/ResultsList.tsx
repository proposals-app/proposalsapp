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
  // const totalDelegatedVp = results.totalDelegatedVp;

  const totalDelegatedVp = results.totalDelegatedVp;
  // Calculate voting power for each choice using finalResults
  const choicesWithPower = results.choices.map((choice, index) => ({
    choice,
    votingPower: results.finalResults[index] || 0,
    color: results.choiceColors[index],
    countsTowardsQuorum: results.quorumChoices.includes(index),
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

  const quorumVotingPower = sortedChoices
    .filter((choice) => choice.countsTowardsQuorum)
    .reduce((sum, choice) => sum + choice.votingPower, 0);

  const participationPercentage = totalDelegatedVp
    ? (totalVotingPower / totalDelegatedVp) * 100
    : 0;

  console.log(results.quorum);
  console.log(totalDelegatedVp);

  return (
    <div className="ml-6 w-64">
      <h3 className="mb-4 text-xl font-semibold">Vote Distribution</h3>
      <div className="space-y-4">
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
        </div>

        {isExpanded && (
          <button
            className="mt-2 text-sm text-gray-600 hover:text-gray-900"
            onClick={() => setIsExpanded(false)}
          >
            Show less
          </button>
        )}

        {/* Quorum Bar */}
        <div>
          {results.quorum !== null && totalDelegatedVp && (
            <div className="mb-4">
              <div className="relative flex h-4 w-full rounded-lg bg-gray-200">
                {/* Quorum Line */}
                <div
                  className="absolute -top-1 z-10 h-6 w-0.5 bg-red-500"
                  style={{
                    left: `${(results.quorum / totalDelegatedVp) * 100}%`,
                  }}
                />
                {/* Choices that count towards quorum */}
                {sortedChoices
                  .filter((choice) => choice.countsTowardsQuorum)
                  .map((choice, index) => (
                    <div
                      key={index}
                      className={`h-full ${index == 0 ? "rounded-l-lg" : "rounded-none"} `}
                      style={{
                        width: `${(choice.votingPower / totalDelegatedVp) * 100}%`,
                        backgroundColor: choice.color,
                      }}
                    />
                  ))}
              </div>
              {/* Quorum Text */}
              <div className="mt-2 text-sm text-gray-600">
                <span className="font-semibold">
                  {formatNumberWithSuffix(quorumVotingPower)}
                </span>{" "}
                of{" "}
                <span className="font-semibold">
                  {formatNumberWithSuffix(results.quorum)}
                </span>{" "}
                Quorum
              </div>
            </div>
          )}
        </div>

        {/* Add the delegated voting power bar if totalDelegatedVp is available */}
        <div>
          {totalDelegatedVp && (
            <div className="mt-4">
              {/* Thin black bar showing the percentage of voting power used */}
              <div className="relative h-1 w-full rounded-full bg-gray-200">
                {/* Black bar representing the percentage of voting power used */}
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-black"
                  style={{
                    width: `${participationPercentage}%`,
                  }}
                />
              </div>

              {/* Text description */}
              <div className="mt-2 text-xs text-gray-600">
                <span className="font-semibold">
                  {participationPercentage.toFixed(0)}%
                </span>{" "}
                of all delegated ARB has voted
              </div>
            </div>
          )}
        </div>
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
