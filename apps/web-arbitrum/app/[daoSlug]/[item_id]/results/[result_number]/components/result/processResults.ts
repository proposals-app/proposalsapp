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

type ProposalMetadata = {
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

// Process ranked choice votes
function processRankedChoiceVotes(
  votes: Selectable<Vote>[],
  choices: string[],
  proposal: Selectable<Proposal>,
): ProcessedResults {
  const processedVotes: VoteResult[] = [];
  const timeSeriesData: TimeSeriesPoint[] = [];
  let totalVotingPower = 0;

  // Sort votes by timestamp
  const sortedVotes = votes
    .filter((vote) => vote.timeCreated && Array.isArray(vote.choice))
    .map((vote) => ({
      timestamp: new Date(vote.timeCreated!),
      votingPower: Number(vote.votingPower),
      choice: (vote.choice as number[]).map((c) => c - 1), // Convert to 0-based index
      voterAddress: vote.voterAddress,
    }))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  if (sortedVotes.length === 0) {
    return {
      votes: [],
      proposal,
      timeSeriesData: [],
      choices,
      totalVotingPower: 0,
      quorum: proposal.quorum ? Number(proposal.quorum) : null,
      quorumChoices: (proposal.metadata as any)?.quorumChoices ?? [],
    };
  }

  // Initialize hourly data
  const hourlyData = new Map<string, { [choice: number]: number }>();
  const startTime = new Date(proposal.timeStart);
  const endTime = sortedVotes[sortedVotes.length - 1].timestamp;
  let currentHour = startOfHour(startTime);

  while (currentHour <= endTime) {
    const hourKey = format(currentHour, "yyyy-MM-dd HH:mm");
    const hourData: { [choice: number]: number } = {};
    choices.forEach((_, index) => {
      hourData[index] = 0;
    });
    hourlyData.set(hourKey, hourData);
    currentHour = new Date(currentHour.getTime() + 60 * 60 * 1000);
  }

  // Function to run one round of IRV counting
  function countIRVRound(
    currentVotes: typeof sortedVotes,
    eliminatedChoices: number[],
  ): {
    voteCounts: { [choice: number]: number };
    eliminated: number[];
    winner?: number;
  } {
    const voteCounts: { [key: number]: number } = {};
    let totalPower = 0;

    // Count first-choice votes that haven't been eliminated
    currentVotes.forEach((vote) => {
      const validChoice = vote.choice.find(
        (c) => !eliminatedChoices.includes(c),
      );
      if (validChoice !== undefined) {
        voteCounts[validChoice] =
          (voteCounts[validChoice] || 0) + vote.votingPower;
        totalPower += vote.votingPower;
      }
    });

    // Check for majority winner
    const majorityThreshold = totalPower / 2;
    let winner: number | undefined;
    Object.entries(voteCounts).forEach(([choice, votes]) => {
      if (votes > majorityThreshold) {
        winner = parseInt(choice);
      }
    });

    // If no winner, eliminate choice with fewest votes
    let toEliminate: number | undefined;
    if (!winner) {
      let minVotes = Infinity;
      Object.entries(voteCounts).forEach(([choice, votes]) => {
        const choiceNum = parseInt(choice);
        if (votes < minVotes && !eliminatedChoices.includes(choiceNum)) {
          minVotes = votes;
          toEliminate = choiceNum;
        }
      });
    }

    return {
      voteCounts,
      eliminated:
        toEliminate !== undefined
          ? [...eliminatedChoices, toEliminate]
          : eliminatedChoices,
      winner,
    };
  }

  // Process votes for each timestamp
  sortedVotes.forEach((vote) => {
    const hourKey = format(startOfHour(vote.timestamp), "yyyy-MM-dd HH:mm");
    const currentVotes = sortedVotes.filter(
      (v) => v.timestamp.getTime() <= vote.timestamp.getTime(),
    );

    let eliminated: number[] = [];
    let result: ReturnType<typeof countIRVRound>;
    let finalVoteCounts: { [key: number]: number } = {};

    // Run IRV rounds until we have a winner or no more choices to eliminate
    do {
      result = countIRVRound(currentVotes, eliminated);
      finalVoteCounts = result.voteCounts;
      eliminated = result.eliminated;
    } while (!result.winner && eliminated.length < choices.length - 1);

    // Update hourly data
    const hourData = hourlyData.get(hourKey) || {};
    choices.forEach((_, index) => {
      hourData[index] = finalVoteCounts[index] || 0;
    });
    hourlyData.set(hourKey, hourData);

    // Add to processed votes
    processedVotes.push({
      choice: vote.choice[0], // Use first choice for display
      choiceText: choices[vote.choice[0]] || "Unknown Choice",
      votingPower: vote.votingPower,
      voterAddress: vote.voterAddress,
      timestamp: vote.timestamp,
      color: getColorForChoice(choices[vote.choice[0]]),
    });

    totalVotingPower += vote.votingPower;
  });

  // Convert hourly data to time series format
  const timeSeriesPoints = Array.from(hourlyData.entries()).map(
    ([timestamp, values]) => ({
      timestamp,
      values,
    }),
  );

  return {
    votes: processedVotes,
    proposal,
    timeSeriesData: timeSeriesPoints,
    choices,
    totalVotingPower,
    quorum: proposal.quorum ? Number(proposal.quorum) : null,
    quorumChoices: (proposal.metadata as any)?.quorumChoices ?? [],
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
