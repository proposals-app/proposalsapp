import { Proposal, Selectable, Vote } from "@proposalsapp/db";
import { startOfHour, format } from "date-fns";

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
  totalVotingPower: number;
  quorum: number | null;
  quorumChoices: number[];
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
  const processedVotes: VoteResult[] = votes.map((vote) => {
    const choice = vote.choice as number;
    return {
      choice,
      choiceText: choices[choice] || "Unknown Choice",
      votingPower: Number(vote.votingPower),
      voterAddress: vote.voterAddress,
      timestamp: new Date(vote.timeCreated!),
      color: getColorForChoice(choices[choice]),
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

  return {
    votes: processedVotes,
    proposal,
    timeSeriesData: Object.entries(hourlyData).map(([timestamp, values]) => ({
      timestamp,
      values,
    })),
    choices,
    totalVotingPower: processedVotes.reduce(
      (sum, vote) => sum + vote.votingPower,
      0,
    ),
    quorum: proposal.quorum ? Number(proposal.quorum) : null,
    quorumChoices: (proposal.metadata as ProposalMetadata).quorumChoices ?? [],
  };
}

// Process weighted votes
function processWeightedVotes(
  votes: Selectable<Vote>[],
  choices: string[],
  proposal: Selectable<Proposal>,
): ProcessedResults {
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
          color: getColorForChoice(choices[choice]),
        });

        // Accumulate in hourly data
        hourlyData[hourKey][choice] =
          (hourlyData[hourKey][choice] || 0) + normalizedPower;
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
        color: getColorForChoice(choices[choice]),
      });

      hourlyData[hourKey][choice] =
        (hourlyData[hourKey][choice] || 0) + Number(vote.votingPower);
    }
  });

  return {
    votes: processedVotes,
    proposal,
    timeSeriesData: Object.entries(hourlyData).map(([timestamp, values]) => ({
      timestamp,
      values,
    })),
    choices,
    totalVotingPower: processedVotes.reduce(
      (sum, vote) => sum + vote.votingPower,
      0,
    ),
    quorum: proposal.quorum ? Number(proposal.quorum) : null,
    quorumChoices: (proposal.metadata as ProposalMetadata).quorumChoices ?? [],
  };
}

// Process approval votes
function processApprovalVotes(
  votes: Selectable<Vote>[],
  choices: string[],
  proposal: Selectable<Proposal>,
): ProcessedResults {
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
        color: getColorForChoice(choices[choiceIndex]),
      });

      // Accumulate in hourly data
      hourlyData[hourKey][choiceIndex] =
        (hourlyData[hourKey][choiceIndex] || 0) + Number(vote.votingPower);
    });
  });

  return {
    votes: processedVotes,
    proposal,
    timeSeriesData: Object.entries(hourlyData).map(([timestamp, values]) => ({
      timestamp,
      values,
    })),
    choices,
    totalVotingPower: processedVotes.reduce(
      (sum, vote) => sum + vote.votingPower,
      0,
    ),
    quorum: proposal.quorum ? Number(proposal.quorum) : null,
    quorumChoices: (proposal.metadata as ProposalMetadata).quorumChoices ?? [],
  };
}

function processRankedChoiceVotes(
  votes: Selectable<Vote>[],
  choices: string[],
  proposal: Selectable<Proposal>,
): ProcessedResults {
  const DEBUG = false;
  const log = (...args: any[]) => {
    if (DEBUG) console.log(...args);
  };

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
      choices,
      totalVotingPower: 0,
      quorum: proposal.quorum ? Number(proposal.quorum) : null,
      quorumChoices:
        (proposal.metadata as ProposalMetadata).quorumChoices ?? [],
    };
  }

  // Helper function to run IRV rounds
  const runIRV = (currentVotes: typeof sortedVotes) => {
    let eliminatedChoices: number[] = [];
    let winner: number | undefined;
    let finalVoteCounts: { [key: number]: number } = {};

    do {
      const voteCounts: { [key: number]: number } = {};

      // Initialize vote counts to 0 for all choices
      choices.forEach((_, index) => {
        voteCounts[index] = 0;
      });

      // Count votes for the highest-ranked non-eliminated choice for each voter
      currentVotes.forEach((vote) => {
        // Find the first non-eliminated choice in the voter's ranking
        const validChoice = vote.choice.find(
          (choice) => !eliminatedChoices.includes(choice),
        );
        if (validChoice !== undefined) {
          voteCounts[validChoice] =
            (voteCounts[validChoice] || 0) + vote.votingPower;
        }
      });

      // Set eliminated choices to 0 votes
      eliminatedChoices.forEach((choice) => {
        voteCounts[choice] = 0;
      });

      const totalVotes = Object.values(voteCounts).reduce(
        (sum, count) => sum + count,
        0,
      );
      const majorityThreshold = totalVotes / 2;

      log("Round Summary:");
      log("Total Votes:", totalVotes);
      log("Majority Threshold:", majorityThreshold);
      log(
        "Current Vote Counts:",
        Object.entries(voteCounts).map(
          ([choice, count]) =>
            `${choices[Number(choice)]}: ${count} (${((count / totalVotes) * 100).toFixed(2)}%)`,
        ),
      );
      log(
        "Eliminated Choices:",
        eliminatedChoices.map((c) => choices[c]).join(", "),
      );

      // Check for a winner
      const winningEntry = Object.entries(voteCounts)
        .filter(([choice]) => !eliminatedChoices.includes(Number(choice)))
        .find(([_, votes]) => votes > majorityThreshold);

      if (winningEntry) {
        winner = Number(winningEntry[0]);
        finalVoteCounts = voteCounts;
        break;
      }

      // Find the choice with the fewest votes to eliminate
      const activeChoices = Object.entries(voteCounts)
        .filter(([choice]) => !eliminatedChoices.includes(Number(choice)))
        .map(([choice, votes]) => ({
          choice: Number(choice),
          votes,
        }));

      if (activeChoices.length > 0) {
        const minVotes = Math.min(...activeChoices.map((c) => c.votes));
        const toEliminate = activeChoices.find((c) => c.votes === minVotes);

        if (toEliminate) {
          eliminatedChoices.push(toEliminate.choice);
          log(
            "Eliminating:",
            choices[toEliminate.choice],
            `(${toEliminate.votes} votes)`,
          );
        }
      }

      finalVoteCounts = voteCounts;
    } while (!winner && eliminatedChoices.length < choices.length - 1);

    return { winner, finalVoteCounts };
  };

  // Initialize hourly data
  const startTime = new Date(proposal.timeStart);
  const endTime = new Date(
    Math.max(
      ...sortedVotes.map((v) => v.timestamp),
      new Date(proposal.timeEnd).getTime(),
    ),
  );
  const hourlyData = initializeHourlyData(startTime, endTime, choices);

  // Process votes hourly
  Object.keys(hourlyData).forEach((hourKey) => {
    const hourTimestamp = new Date(hourKey).getTime();
    log("\n=== Processing hour:", hourKey, "===");

    // Filter votes up to this hour
    const currentVotes = sortedVotes.filter(
      (v) => v.timestamp <= hourTimestamp,
    );

    if (currentVotes.length === 0) {
      log("No votes in this hour.");
      return;
    }

    // Run IRV for this hour
    const { winner, finalVoteCounts } = runIRV(currentVotes);

    // Verify we have a winner
    const totalVotes = Object.values(finalVoteCounts).reduce(
      (sum, count) => sum + count,
      0,
    );
    const winningVotes = winner !== undefined ? finalVoteCounts[winner] : 0;
    const winningPercentage = (winningVotes / totalVotes) * 100;

    log("Final Result:");
    log(`Winner: ${winner !== undefined ? choices[winner] : "No winner"}`);
    log(`Winning Percentage: ${winningPercentage.toFixed(2)}%`);

    if (winner === undefined || winningPercentage <= 50) {
      log("WARNING: No majority winner found at this hour!");
    }

    // Update hourly data with final vote counts
    choices.forEach((_, index) => {
      hourlyData[hourKey][index] = finalVoteCounts[index] || 0;
    });
  });

  // Convert hourly data to timeSeriesData format
  const timeSeriesData: TimeSeriesPoint[] = Object.entries(hourlyData)
    .map(([timestamp, values]) => ({
      timestamp,
      values,
    }))
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

  // Create processed votes array for the table
  const processedVotes: VoteResult[] = sortedVotes.map((vote) => ({
    choice: vote.choice[0], // Use first choice for display
    choiceText: choices[vote.choice[0]] || "Unknown Choice",
    votingPower: vote.votingPower,
    voterAddress: vote.voterAddress,
    timestamp: new Date(vote.timestamp),
    color: getColorForChoice(choices[vote.choice[0]]),
  }));

  const totalVotingPower = processedVotes.reduce(
    (sum, vote) => sum + vote.votingPower,
    0,
  );

  return {
    votes: processedVotes,
    proposal,
    timeSeriesData,
    choices,
    totalVotingPower,
    quorum: proposal.quorum ? Number(proposal.quorum) : null,
    quorumChoices: (proposal.metadata as ProposalMetadata).quorumChoices ?? [],
  };
}

// Process quadratic votes
function processQuadraticVotes(
  votes: Selectable<Vote>[],
  choices: string[],
  proposal: Selectable<Proposal>,
): ProcessedResults {
  // Will add the implementation in the next response due to length
  return processBasicVotes(votes, choices, proposal); // Temporary fallback
}

// Main processResults function
export function processResults(
  proposal: Selectable<Proposal>,
  votes: Selectable<Vote>[],
): ProcessedResults {
  const choices = proposal.choices as string[];
  const metadata = proposal.metadata as ProposalMetadata;
  const voteType = metadata.voteType || "basic";

  switch (voteType) {
    case "weighted":
      return processWeightedVotes(votes, choices, proposal);
    case "approval":
      return processApprovalVotes(votes, choices, proposal);
    case "ranked-choice":
      return processRankedChoiceVotes(votes, choices, proposal);
    case "quadratic":
      return processQuadraticVotes(votes, choices, proposal);
    default:
      return processBasicVotes(votes, choices, proposal);
  }
}
