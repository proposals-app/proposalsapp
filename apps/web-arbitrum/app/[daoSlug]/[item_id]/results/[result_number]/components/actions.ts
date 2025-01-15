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

export function getColorForChoice(choice: string | undefined | null): string {
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
}

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
async function processBasicVotes(
  votes: Selectable<Vote>[],
  choices: string[],
  proposal: Selectable<Proposal>,
): Promise<ProcessedResults> {
  const ACCUMULATED_VOTING_POWER_THRESHOLD = 5000;

  const choiceColors = choices.map((choice) => getColorForChoice(choice));

  const processedVotes: VoteResult[] = votes.map((vote) => {
    const choice = vote.choice as number;
    return {
      choice,
      choiceText: choices[choice] || "Unknown Choice",
      votingPower: Number(vote.votingPower),
      voterAddress: vote.voterAddress,
      timestamp: new Date(vote.timeCreated!),
      color: choiceColors[choice],
    };
  });

  const sortedVotes = [...processedVotes].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );

  const timeSeriesData: TimeSeriesPoint[] = [];
  let accumulatedVotingPower = 0;
  let lastAccumulatedTimestamp: Date | null = null;

  sortedVotes.forEach((vote) => {
    if (vote.votingPower >= ACCUMULATED_VOTING_POWER_THRESHOLD) {
      // Create a new time series point for this vote
      timeSeriesData.push({
        timestamp: format(vote.timestamp, "yyyy-MM-dd HH:mm:ss"),
        values: { [vote.choice]: vote.votingPower },
      });
    } else {
      // Accumulate voting power
      accumulatedVotingPower += vote.votingPower;
      lastAccumulatedTimestamp = vote.timestamp;

      if (accumulatedVotingPower >= ACCUMULATED_VOTING_POWER_THRESHOLD) {
        // Create a new time series point for the accumulated votes
        timeSeriesData.push({
          timestamp: format(lastAccumulatedTimestamp, "yyyy-MM-dd HH:mm:ss"),
          values: { [vote.choice]: accumulatedVotingPower },
        });
        accumulatedVotingPower = 0; // Reset accumulation
      }
    }
  });

  // If there's any remaining accumulated voting power, add it to the last timestamp
  if (accumulatedVotingPower > 0 && lastAccumulatedTimestamp) {
    timeSeriesData.push({
      timestamp: format(lastAccumulatedTimestamp, "yyyy-MM-dd HH:mm:ss"),
      values: {
        [sortedVotes[sortedVotes.length - 1].choice]: accumulatedVotingPower,
      },
    });
  }

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
    timeSeriesData,
    choices,
    choiceColors,
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
async function processWeightedVotes(
  votes: Selectable<Vote>[],
  choices: string[],
  proposal: Selectable<Proposal>,
): Promise<ProcessedResults> {
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

async function processApprovalVotes(
  votes: Selectable<Vote>[],
  choices: string[],
  proposal: Selectable<Proposal>,
): Promise<ProcessedResults> {
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

async function processRankedChoiceVotes(
  votes: Selectable<Vote>[],
  choices: string[],
  proposal: Selectable<Proposal>,
  intervalSeconds: number = 60 * 5,
): Promise<ProcessedResults> {
  const choiceColors = choices.map((choice) => getColorForChoice(choice));

  // Early return for empty votes
  if (!votes.length) {
    return {
      votes: [],
      proposal,
      timeSeriesData: [],
      choices,
      choiceColors,
      totalVotingPower: 0,
      quorum: proposal.quorum ? Number(proposal.quorum) : null,
      quorumChoices:
        (proposal.metadata as ProposalMetadata).quorumChoices ?? [],
      winner: null,
    };
  }

  // Pre-process votes
  const processedVotes = votes
    .filter((vote) => vote.timeCreated && Array.isArray(vote.choice))
    .map((vote) => ({
      timestamp: new Date(vote.timeCreated!).getTime(),
      votingPower: Number(vote.votingPower),
      choice: (vote.choice as number[]).map((c) => c - 1),
      voterAddress: vote.voterAddress,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  // Create a promise-based chunked IRV calculation
  const calculateIRV = (currentVotes: typeof processedVotes) => {
    return new Promise<{
      winner: number | undefined;
      finalVoteCounts: Map<number, number>;
      eliminatedChoices: Set<number>;
    }>((resolve) => {
      const eliminatedChoices = new Set<number>();
      const voteCounts = new Map<number, number>();
      let winner: number | undefined;

      // Initialize vote counts
      choices.forEach((_, index) => voteCounts.set(index, 0));

      let round = 0;
      const processRound = () => {
        setTimeout(() => {
          if (winner || eliminatedChoices.size >= choices.length - 1) {
            // If no winner found, use the choice with most votes
            if (!winner) {
              winner = Array.from(voteCounts.entries())
                .filter(([choice]) => !eliminatedChoices.has(choice))
                .reduce((a, b) => (a[1] > b[1] ? a : b))[0];
            }
            resolve({ winner, finalVoteCounts: voteCounts, eliminatedChoices });
            return;
          }

          // Reset vote counts for active choices
          voteCounts.forEach((_, key) => voteCounts.set(key, 0));

          // Count votes in this round
          let totalVotes = 0;
          currentVotes.forEach((vote) => {
            const validChoice = vote.choice.find(
              (choice) => !eliminatedChoices.has(choice),
            );
            if (validChoice !== undefined) {
              const currentCount = voteCounts.get(validChoice) || 0;
              voteCounts.set(validChoice, currentCount + vote.votingPower);
              totalVotes += vote.votingPower;
            }
          });

          const majorityThreshold = totalVotes / 2;

          // Find winner or choice to eliminate
          let minVotes = Infinity;
          let choiceToEliminate = -1;
          let maxVotes = 0;

          voteCounts.forEach((votes, choice) => {
            if (eliminatedChoices.has(choice)) return;

            if (votes > majorityThreshold) {
              winner = choice;
            }
            if (votes < minVotes) {
              minVotes = votes;
              choiceToEliminate = choice;
            }
            if (votes > maxVotes) {
              maxVotes = votes;
            }
          });

          if (!winner && choiceToEliminate !== -1) {
            eliminatedChoices.add(choiceToEliminate);
          }

          round++;
          processRound(); // Process next round
        }, 1);
      };

      processRound(); // Start processing rounds
    });
  };

  // Generate time series data with non-blocking calculations
  const timeSeriesMap = new Map<string, TimeSeriesPoint>();
  let runningVotes: typeof processedVotes = [];

  // Calculate the interval in milliseconds
  const intervalMs = intervalSeconds * 1000;

  // Initialize the first interval
  let nextIntervalTime = processedVotes[0].timestamp + intervalMs;

  for (const vote of processedVotes) {
    runningVotes.push(vote);

    // Check if the vote timestamp exceeds the next interval time
    if (vote.timestamp >= nextIntervalTime) {
      const { finalVoteCounts, eliminatedChoices } =
        await calculateIRV(runningVotes);

      const timestampKey = new Date(nextIntervalTime).toISOString();
      const values: Record<number | string, number> = {};

      // Calculate total votes for this interval
      let totalVotes = 0;

      finalVoteCounts.forEach((count, choice) => {
        if (!eliminatedChoices.has(choice)) {
          values[choice] = count;
          totalVotes += count; // Accumulate total votes
        }
      });

      // Add the total votes as a special key "Total"
      values["Winning threshold"] = totalVotes / 2;

      timeSeriesMap.set(timestampKey, { timestamp: timestampKey, values });

      // Update the next interval time
      nextIntervalTime += intervalMs;
    }
  }

  // Calculate final result
  const { winner, finalVoteCounts } = await calculateIRV(processedVotes);
  const totalVotingPower = processedVotes.reduce(
    (sum, vote) => sum + vote.votingPower,
    0,
  );

  return {
    votes: processedVotes.map((vote) => ({
      choice: vote.choice[0],
      choiceText: choices[vote.choice[0]] || "Unknown Choice",
      votingPower: vote.votingPower,
      voterAddress: vote.voterAddress,
      timestamp: new Date(vote.timestamp),
      color: choiceColors[vote.choice[0]],
    })),
    proposal,
    timeSeriesData: Array.from(timeSeriesMap.values()),
    choices,
    choiceColors,
    totalVotingPower,
    quorum: proposal.quorum ? Number(proposal.quorum) : null,
    quorumChoices: (proposal.metadata as ProposalMetadata).quorumChoices ?? [],
    winner: winner !== undefined ? Number(winner) : null,
  };
}

// Process quadratic votes
async function processQuadraticVotes(
  votes: Selectable<Vote>[],
  choices: string[],
  proposal: Selectable<Proposal>,
): Promise<ProcessedResults> {
  const choiceColors = choices.map((choice) => getColorForChoice(choice)); // Add this line

  // Temporary fallback to basic processing
  const result = await processBasicVotes(votes, choices, proposal);

  // Include choice colors in the result
  return {
    ...result,
    choiceColors, // Include choice colors
  };
}

export async function getVotesAction(proposalId: string) {
  "use server";
  const votes = await db
    .selectFrom("vote")
    .selectAll()
    .where("proposalId", "=", proposalId)
    .execute();
  return votes;
}

// Main processResults function
export async function processResultsAction(
  proposal: Selectable<Proposal>,
  votes: Selectable<Vote>[],
): Promise<ProcessedResults> {
  "use server";
  return otel("process-results", async () => {
    const choices = proposal.choices as string[];
    const metadata = proposal.metadata as ProposalMetadata;
    const voteType = metadata.voteType || "basic";

    let result: ProcessedResults;

    switch (voteType) {
      case "weighted":
        result = await processWeightedVotes(votes, choices, proposal);
        break;
      case "approval":
        result = await processApprovalVotes(votes, choices, proposal);
        break;
      case "ranked-choice":
        result = await processRankedChoiceVotes(votes, choices, proposal);
        break;
      case "quadratic":
        result = await processQuadraticVotes(votes, choices, proposal);
        break;
      default:
        result = await processBasicVotes(votes, choices, proposal);
        break;
    }

    return result;
  });
}

export type DelegateInfo = {
  name: string | null;
} | null;

export async function getDelegateForVoter(
  voterAddress: string,
  daoSlug: string,
  proposalId: string,
): Promise<DelegateInfo> {
  return otel("get-delegate-for-voter", async () => {
    const dao = await db
      .selectFrom("dao")
      .where("slug", "=", daoSlug)
      .selectAll()
      .executeTakeFirst();

    if (!dao) return null;

    // Get the proposal to determine the time range
    const proposal = await db
      .selectFrom("proposal")
      .selectAll()
      .where("id", "=", proposalId)
      .executeTakeFirst();

    if (!proposal) return null;

    // Get the voter
    const voter = await db
      .selectFrom("voter")
      .where("address", "=", voterAddress)
      .selectAll()
      .executeTakeFirst();

    if (!voter) return null;

    // Try to get delegate information
    const delegateData = await db
      .selectFrom("delegate")
      .innerJoin("delegateToVoter", "delegate.id", "delegateToVoter.delegateId")
      .where("delegateToVoter.voterId", "=", voter.id)
      .where("delegate.daoId", "=", dao.id)
      .select("delegate.id")
      .executeTakeFirst();

    if (!delegateData) return null;

    // Try to get discourse user first
    const discourseUser = await db
      .selectFrom("delegateToDiscourseUser")
      .where("delegateId", "=", delegateData.id)
      .leftJoin(
        "discourseUser",
        "discourseUser.id",
        "delegateToDiscourseUser.discourseUserId",
      )
      .where("periodStart", "<=", proposal.timeStart)
      .where("periodEnd", ">=", proposal.timeEnd)
      .selectAll()
      .executeTakeFirst();

    if (discourseUser) {
      return {
        name: discourseUser.name || discourseUser.username,
      };
    }

    // Fallback to ENS
    const ens = await db
      .selectFrom("delegateToVoter")
      .where("delegateId", "=", delegateData.id)
      .leftJoin("voter", "voter.id", "delegateToVoter.voterId")
      .where("periodStart", "<=", proposal.timeStart)
      .where("periodEnd", ">=", proposal.timeEnd)
      .select("voter.ens")
      .executeTakeFirst();

    if (ens?.ens) {
      return {
        name: ens.ens,
      };
    }

    // Fallback to address
    return {
      name: `${voterAddress.slice(0, 6)}...${voterAddress.slice(-4)}`,
    };
  });
}
