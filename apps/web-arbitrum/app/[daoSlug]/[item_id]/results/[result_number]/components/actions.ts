import { otel } from "@/lib/otel";
import { Proposal, Selectable, Vote } from "@proposalsapp/db";
import { startOfHour, format } from "date-fns";
import { db } from "@proposalsapp/db";

export interface VoteResult {
  choice: number;
  choiceText: string;
  votingPower: number;
  voterAddress: string;
  timestamp: Date;
  color: string;
}

export interface TimeSeriesPoint {
  timestamp: string;
  values: { [choice: number]: number };
}

export interface ProcessedResults {
  votes: VoteResult[];
  proposal: Selectable<Proposal>;
  timeSeriesData: TimeSeriesPoint[];
  choices: string[];
  choiceColors: string[];
  totalVotingPower: number;
  quorum: number | null;
  quorumChoices: number[];
  winner: number | null;
}

export type ProposalMetadata = {
  quorumChoices?: number[];
  voteType?: string;
};

export const getColorForChoice = (
  choice: string | undefined | null,
): string => {
  if (!choice) return "#CBD5E1"; // Default grey color
  const lowerCaseChoice = choice.toLowerCase();
  if (/^(for|yes|yae)/.test(lowerCaseChoice)) return "#10B981"; // Green
  if (/^(against|no|nay)/.test(lowerCaseChoice)) return "#EF4444"; // Red
  if (lowerCaseChoice === "abstain") return "#F59E0B"; // Yellow
  const colors = ["#3B82F6", "#8B5CF6", "#EC4899", "#F97316", "#6EE7B7"];
  const hash = Array.from(lowerCaseChoice).reduce(
    (acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0,
    0,
  );
  return colors[Math.abs(hash) % colors.length];
};

function initializeHourlyData(
  startTime: Date,
  endTime: Date,
  choices: string[],
): { [hour: string]: { [choice: number]: number } } {
  const hourlyData: { [hour: string]: { [choice: number]: number } } = {};
  let currentHour = startOfHour(startTime);

  while (currentHour <= endTime) {
    const hourKey = format(currentHour, "yyyy-MM-dd HH:mm");
    hourlyData[hourKey] = {};
    choices.forEach((_, index) => {
      hourlyData[hourKey][index] = 0;
    });
    currentHour = new Date(currentHour.getTime() + 60 * 60 * 1000);
  }

  return hourlyData;
}

// Process basic (single-choice) votes
function processBasicVotes(
  votes: Selectable<Vote>[],
  choices: string[],
  proposal: Selectable<Proposal>,
): ProcessedResults {
  const choiceColors = choices.map((choice) => getColorForChoice(choice)); // Add this line

  const processedVotes: VoteResult[] = votes.map((vote) => {
    const choice = vote.choice as number;
    return {
      choice,
      choiceText: choices[choice] || "Unknown Choice",
      votingPower: Number(vote.votingPower),
      voterAddress: vote.voterAddress,
      timestamp: new Date(vote.timeCreated!),
      color: choiceColors[choice], // Use the precomputed color
    };
  });

  const sortedVotes = [...processedVotes].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );

  const hourlyData = initializeHourlyData(
    new Date(proposal.timeStart),
    sortedVotes.length > 0
      ? sortedVotes[sortedVotes.length - 1].timestamp
      : new Date(proposal.timeStart),
    choices,
  );

  // Accumulate votes
  sortedVotes.forEach((vote) => {
    const hourKey = format(startOfHour(vote.timestamp), "yyyy-MM-dd HH:mm");
    hourlyData[hourKey][vote.choice] =
      (hourlyData[hourKey][vote.choice] || 0) + vote.votingPower;
  });

  // Determine the winner
  const voteCounts: { [choice: number]: number } = {};
  choices.forEach((_, index) => {
    voteCounts[index] = 0;
  });

  processedVotes.forEach((vote) => {
    voteCounts[vote.choice] = (voteCounts[vote.choice] || 0) + vote.votingPower;
  });

  const winner = Object.entries(voteCounts).reduce((a, b) =>
    a[1] > b[1] ? a : b,
  )[0];

  return {
    votes: processedVotes,
    proposal,
    timeSeriesData: Object.entries(hourlyData).map(([timestamp, values]) => ({
      timestamp,
      values,
    })),
    choices,
    choiceColors, // Include choice colors
    totalVotingPower: processedVotes.reduce(
      (sum, vote) => sum + vote.votingPower,
      0,
    ),
    quorum: proposal.quorum ? Number(proposal.quorum) : null,
    quorumChoices: (proposal.metadata as ProposalMetadata).quorumChoices ?? [],
    winner: Number(winner),
  };
}

// Process weighted votes
function processWeightedVotes(
  votes: Selectable<Vote>[],
  choices: string[],
  proposal: Selectable<Proposal>,
): ProcessedResults {
  const choiceColors = choices.map((choice) => getColorForChoice(choice)); // Add this line

  const processedVotes: VoteResult[] = [];
  const hourlyData = initializeHourlyData(
    new Date(proposal.timeStart),
    votes.length > 0
      ? new Date(
          Math.max(...votes.map((v) => new Date(v.timeCreated!).getTime())),
        )
      : new Date(proposal.timeStart),
    choices,
  );

  const voteCounts: { [choice: number]: number } = {};
  choices.forEach((_, index) => {
    voteCounts[index] = 0;
  });

  votes.forEach((vote) => {
    if (
      typeof vote.choice === "object" &&
      vote.choice !== null &&
      !Array.isArray(vote.choice)
    ) {
      const weightedChoices = vote.choice as Record<string, number>;
      const timestamp = new Date(vote.timeCreated!);
      const hourKey = format(startOfHour(timestamp), "yyyy-MM-dd HH:mm");
      const totalWeight = Object.values(weightedChoices).reduce(
        (sum, weight) => sum + weight,
        0,
      );

      // Process each choice in the weighted vote
      Object.entries(weightedChoices).forEach(([choiceIndex, weight]) => {
        const choice = parseInt(choiceIndex) - 1; // Convert to 0-based index
        const normalizedPower =
          (Number(vote.votingPower) * weight) / totalWeight;

        // Add to processed votes
        processedVotes.push({
          choice,
          choiceText: choices[choice] || "Unknown Choice",
          votingPower: normalizedPower,
          voterAddress: vote.voterAddress,
          timestamp,
          color: choiceColors[choice], // Use the precomputed color
        });

        // Accumulate in hourly data
        hourlyData[hourKey][choice] =
          (hourlyData[hourKey][choice] || 0) + normalizedPower;

        // Accumulate in vote counts
        voteCounts[choice] = (voteCounts[choice] || 0) + normalizedPower;
      });
    } else {
      // Handle non-weighted votes (fallback to basic processing)
      const choice = (vote.choice as number) - 1; // Convert to 0-based index
      const timestamp = new Date(vote.timeCreated!);
      const hourKey = format(startOfHour(timestamp), "yyyy-MM-dd HH:mm");

      processedVotes.push({
        choice,
        choiceText: choices[choice] || "Unknown Choice",
        votingPower: Number(vote.votingPower),
        voterAddress: vote.voterAddress,
        timestamp,
        color: choiceColors[choice], // Use the precomputed color
      });

      hourlyData[hourKey][choice] =
        (hourlyData[hourKey][choice] || 0) + Number(vote.votingPower);

      // Accumulate in vote counts
      voteCounts[choice] = (voteCounts[choice] || 0) + Number(vote.votingPower);
    }
  });

  const winner = Object.entries(voteCounts).reduce((a, b) =>
    a[1] > b[1] ? a : b,
  )[0];

  return {
    votes: processedVotes,
    proposal,
    timeSeriesData: Object.entries(hourlyData).map(([timestamp, values]) => ({
      timestamp,
      values,
    })),
    choices,
    choiceColors, // Include choice colors
    totalVotingPower: processedVotes.reduce(
      (sum, vote) => sum + vote.votingPower,
      0,
    ),
    quorum: proposal.quorum ? Number(proposal.quorum) : null,
    quorumChoices: (proposal.metadata as ProposalMetadata).quorumChoices ?? [],
    winner: Number(winner),
  };
}

// Process approval votes
function processApprovalVotes(
  votes: Selectable<Vote>[],
  choices: string[],
  proposal: Selectable<Proposal>,
): ProcessedResults {
  const choiceColors = choices.map((choice) => getColorForChoice(choice)); // Add this line

  const processedVotes: VoteResult[] = [];
  const hourlyData = initializeHourlyData(
    new Date(proposal.timeStart),
    votes.length > 0
      ? new Date(
          Math.max(...votes.map((v) => new Date(v.timeCreated!).getTime())),
        )
      : new Date(proposal.timeStart),
    choices,
  );

  const voteCounts: { [choice: number]: number } = {};
  choices.forEach((_, index) => {
    voteCounts[index] = 0;
  });

  votes.forEach((vote) => {
    const approvedChoices = Array.isArray(vote.choice)
      ? (vote.choice as number[])
      : [vote.choice as number];
    const timestamp = new Date(vote.timeCreated!);
    const hourKey = format(startOfHour(timestamp), "yyyy-MM-dd HH:mm");

    // Each approved choice gets the full voting power of the voter
    approvedChoices.forEach((choice) => {
      const choiceIndex = choice - 1; // Convert to 0-based index

      // Add to processed votes
      processedVotes.push({
        choice: choiceIndex,
        choiceText: choices[choiceIndex] || "Unknown Choice",
        votingPower: Number(vote.votingPower), // Full voting power for each choice
        voterAddress: vote.voterAddress,
        timestamp,
        color: choiceColors[choiceIndex], // Use the precomputed color
      });

      // Accumulate in hourly data
      hourlyData[hourKey][choiceIndex] =
        (hourlyData[hourKey][choiceIndex] || 0) + Number(vote.votingPower);

      // Accumulate in vote counts
      voteCounts[choiceIndex] =
        (voteCounts[choiceIndex] || 0) + Number(vote.votingPower);
    });
  });

  const winner = Object.entries(voteCounts).reduce((a, b) =>
    a[1] > b[1] ? a : b,
  )[0];

  return {
    votes: processedVotes,
    proposal,
    timeSeriesData: Object.entries(hourlyData).map(([timestamp, values]) => ({
      timestamp,
      values,
    })),
    choices,
    choiceColors, // Include choice colors
    totalVotingPower: processedVotes.reduce(
      (sum, vote) => sum + vote.votingPower,
      0,
    ),
    quorum: proposal.quorum ? Number(proposal.quorum) : null,
    quorumChoices: (proposal.metadata as ProposalMetadata).quorumChoices ?? [],
    winner: Number(winner),
  };
}
function processRankedChoiceVotes(
  votes: Selectable<Vote>[],
  choices: string[],
  proposal: Selectable<Proposal>,
): ProcessedResults {
  const choiceColors = choices.map((choice) => getColorForChoice(choice)); // Add this line

  const DEBUG = false;
  const log = (...args: any[]) => {
    if (DEBUG) console.log(...args);
  };

  // Convert choices to a Set to ensure uniqueness
  const uniqueChoices = [...new Set(choices)];

  // Convert and sort votes
  const sortedVotes = votes
    .filter((vote) => vote.timeCreated && Array.isArray(vote.choice))
    .map((vote) => ({
      timestamp: new Date(vote.timeCreated!).getTime(),
      votingPower: Number(vote.votingPower),
      choice: (vote.choice as number[]).map((c) => c - 1), // Convert to 0-based index
      voterAddress: vote.voterAddress,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (sortedVotes.length === 0) {
    return {
      votes: [],
      proposal,
      timeSeriesData: [],
      choices: uniqueChoices,
      choiceColors: uniqueChoices.map((choice) => getColorForChoice(choice)), // Include choice colors
      totalVotingPower: 0,
      quorum: proposal.quorum ? Number(proposal.quorum) : null,
      quorumChoices:
        (proposal.metadata as ProposalMetadata).quorumChoices ?? [],
      winner: null, // No winner
    };
  }

  // Helper function to run IRV rounds
  const runIRV = (currentVotes: typeof sortedVotes) => {
    let eliminatedChoices = new Set<number>(); // Use a Set for eliminated choices
    let winner: number | undefined;
    let finalVoteCounts = new Map<number, number>(); // Use a Map for vote counts

    do {
      const voteCounts = new Map<number, number>(); // Use a Map for vote counts

      // Initialize vote counts to 0 for all choices
      uniqueChoices.forEach((_, index) => {
        voteCounts.set(index, 0);
      });

      // Count votes for the highest-ranked non-eliminated choice for each voter
      currentVotes.forEach((vote) => {
        // Find the first non-eliminated choice in the voter's ranking
        const validChoice = vote.choice.find(
          (choice) => !eliminatedChoices.has(choice),
        );
        if (validChoice !== undefined) {
          voteCounts.set(
            validChoice,
            (voteCounts.get(validChoice) || 0) + vote.votingPower,
          );
        }
      });

      // Set eliminated choices to 0 votes
      eliminatedChoices.forEach((choice) => {
        voteCounts.set(choice, 0);
      });

      const totalVotes = Array.from(voteCounts.values()).reduce(
        (sum, count) => sum + count,
        0,
      );
      const majorityThreshold = totalVotes / 2;

      log("Round Summary:");
      log("Total Votes:", totalVotes);
      log("Majority Threshold:", majorityThreshold);
      log(
        "Current Vote Counts:",
        Array.from(voteCounts.entries()).map(
          ([choice, count]) =>
            `${uniqueChoices[choice]}: ${count} (${((count / totalVotes) * 100).toFixed(2)}%)`,
        ),
      );
      log(
        "Eliminated Choices:",
        Array.from(eliminatedChoices)
          .map((c) => uniqueChoices[c])
          .join(", "),
      );

      // Check for a winner
      const winningEntry = Array.from(voteCounts.entries())
        .filter(([choice]) => !eliminatedChoices.has(choice))
        .find(([_, votes]) => votes > majorityThreshold);

      if (winningEntry) {
        winner = winningEntry[0];
        finalVoteCounts = voteCounts;
        break;
      }

      // Find the choice with the fewest votes to eliminate
      const activeChoices = Array.from(voteCounts.entries())
        .filter(([choice]) => !eliminatedChoices.has(choice))
        .map(([choice, votes]) => ({
          choice,
          votes,
        }));

      if (activeChoices.length > 0) {
        const minVotes = Math.min(...activeChoices.map((c) => c.votes));
        const toEliminate = activeChoices.find((c) => c.votes === minVotes);

        if (toEliminate) {
          eliminatedChoices.add(toEliminate.choice);
          log(
            "Eliminating:",
            uniqueChoices[toEliminate.choice],
            `(${toEliminate.votes} votes)`,
          );
        }
      }

      finalVoteCounts = voteCounts;
    } while (!winner && eliminatedChoices.size < uniqueChoices.length - 1);

    return { winner, finalVoteCounts, eliminatedChoices };
  };

  // Initialize time series data
  const timeSeriesData: TimeSeriesPoint[] = [];
  const timestampMap = new Map<string, TimeSeriesPoint>(); // Map to track unique timestamps
  let currentVotes: typeof sortedVotes = [];
  let eliminatedChoices = new Set<number>();

  // Process each vote individually
  sortedVotes.forEach((vote, index) => {
    currentVotes.push(vote);

    // Run IRV for the current set of votes
    const {
      winner,
      finalVoteCounts,
      eliminatedChoices: currentEliminated,
    } = runIRV(currentVotes);

    // Update the list of eliminated choices
    eliminatedChoices = currentEliminated;

    // Ensure eliminated choices are set to 0 in the final vote counts
    eliminatedChoices.forEach((choice) => {
      finalVoteCounts.set(choice, 0);
    });

    // Check if a time series point for this timestamp already exists
    const timestampKey = new Date(vote.timestamp).toISOString();
    const existingTimeSeriesPoint = timestampMap.get(timestampKey);

    if (existingTimeSeriesPoint) {
      // Update the existing time series point
      Array.from(finalVoteCounts.entries()).forEach(([choice, count]) => {
        if (!eliminatedChoices.has(choice)) {
          existingTimeSeriesPoint.values[choice] = count;
        }
      });
    } else {
      // Create a new time series point
      const timeSeriesPoint: TimeSeriesPoint = {
        timestamp: timestampKey,
        values: {},
      };

      // Only include non-eliminated choices in the time series data
      Array.from(finalVoteCounts.entries()).forEach(([choice, count]) => {
        if (!eliminatedChoices.has(choice)) {
          timeSeriesPoint.values[choice] = count;
        }
      });

      // Add to the time series data and the map
      timeSeriesData.push(timeSeriesPoint);
      timestampMap.set(timestampKey, timeSeriesPoint);
    }

    log(`Processed vote ${index + 1}/${sortedVotes.length}`);
    log(
      "Current Winner:",
      winner !== undefined ? uniqueChoices[winner] : "No winner",
    );
  });

  // Create processed votes array for the table
  const processedVotes: VoteResult[] = sortedVotes.map((vote) => ({
    choice: vote.choice[0], // Use first choice for display
    choiceText: uniqueChoices[vote.choice[0]] || "Unknown Choice",
    votingPower: vote.votingPower,
    voterAddress: vote.voterAddress,
    timestamp: new Date(vote.timestamp),
    color: choiceColors[vote.choice[0]], // Use the precomputed color
  }));

  const totalVotingPower = processedVotes.reduce(
    (sum, vote) => sum + vote.votingPower,
    0,
  );

  // Determine the final winner
  const finalVoteCounts = new Map<number, number>();
  uniqueChoices.forEach((_, index) => {
    finalVoteCounts.set(index, 0);
  });

  sortedVotes.forEach((vote) => {
    const validChoice = vote.choice.find(
      (choice) => !finalVoteCounts.has(choice),
    );
    if (validChoice !== undefined) {
      finalVoteCounts.set(
        validChoice,
        (finalVoteCounts.get(validChoice) || 0) + vote.votingPower,
      );
    }
  });

  const winner = Array.from(finalVoteCounts.entries()).reduce((a, b) =>
    a[1] > b[1] ? a : b,
  )[0];

  return {
    votes: processedVotes,
    proposal,
    timeSeriesData,
    choices: uniqueChoices,
    choiceColors, // Include choice colors
    totalVotingPower,
    quorum: proposal.quorum ? Number(proposal.quorum) : null,
    quorumChoices: (proposal.metadata as ProposalMetadata).quorumChoices ?? [],
    winner: Number(winner),
  };
}

// Process quadratic votes
function processQuadraticVotes(
  votes: Selectable<Vote>[],
  choices: string[],
  proposal: Selectable<Proposal>,
): ProcessedResults {
  const choiceColors = choices.map((choice) => getColorForChoice(choice)); // Add this line

  // Temporary fallback to basic processing
  const result = processBasicVotes(votes, choices, proposal);

  // Include choice colors in the result
  return {
    ...result,
    choiceColors, // Include choice colors
  };
}

// Main processResults function
export async function processResults(
  proposal: Selectable<Proposal>,
): Promise<ProcessedResults> {
  return otel("process-results", async () => {
    const startTime = Date.now();

    const votes = await db
      .selectFrom("vote")
      .selectAll()
      .where("proposalId", "=", proposal.id)
      .execute();

    const choices = proposal.choices as string[];
    const metadata = proposal.metadata as ProposalMetadata;
    const voteType = metadata.voteType || "basic";

    let result: ProcessedResults;

    switch (voteType) {
      case "weighted":
        result = processWeightedVotes(votes, choices, proposal);
        break;
      case "approval":
        result = processApprovalVotes(votes, choices, proposal);
        break;
      case "ranked-choice":
        result = processRankedChoiceVotes(votes, choices, proposal);
        break;
      case "quadratic":
        result = processQuadraticVotes(votes, choices, proposal);
        break;
      default:
        result = processBasicVotes(votes, choices, proposal);
        break;
    }

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    if (processingTime < 5000) {
      const remainingTime = 5000 - processingTime;
      await new Promise((resolve) => setTimeout(resolve, remainingTime));
    }

    return result;
  });
}
