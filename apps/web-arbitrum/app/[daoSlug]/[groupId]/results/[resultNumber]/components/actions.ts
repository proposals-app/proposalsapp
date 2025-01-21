import { otel } from '@/lib/otel';
import {
  db,
  Proposal,
  ProposalState,
  Selectable,
  Vote,
} from '@proposalsapp/db';
import { format, toZonedTime } from 'date-fns-tz';

export interface VoteResult {
  choice: number;
  choiceText: string;
  votingPower: number;
  voterAddress: string;
  reason: string | null;
  timestamp: Date;
}

export interface TimeSeriesPoint {
  timestamp: string;
  values: { [choice: number]: number };
}

export interface ProcessedResults {
  proposal: Selectable<Proposal>;
  choices: string[];
  choiceColors: string[];
  totalVotingPower: number;
  quorum: number | null;
  quorumChoices: number[];
  voteType: 'basic' | 'weighted' | 'approval' | 'ranked-choice' | 'quadratic';
  votes: VoteResult[];
  timeSeriesData: TimeSeriesPoint[];
  finalResults: { [choice: number]: number };
  totalDelegatedVp?: number;
  hiddenVote: boolean;
  scoresState: string;
}

export type ProposalMetadata = {
  quorumChoices?: number[];
  voteType?: string;
  totalDelegatedVp?: string;
  hiddenVote: boolean;
  scoresState: string;
};

export function getColorForChoice(choice: string | undefined | null): string {
  if (!choice) return '#CBD5E1'; // Default grey color
  const lowerCaseChoice = choice.toLowerCase();
  if (/^(for|yes|yae)/.test(lowerCaseChoice)) return '#10B981'; // Green
  if (/^(against|no|nay)/.test(lowerCaseChoice)) return '#EF4444'; // Red
  if (lowerCaseChoice === 'abstain') return '#F59E0B'; // Yellow
  const colors = [
    '#3B82F6', // Blue
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#F97316', // Orange
    '#6EE7B7', // Teal
    '#A855F7', // Deep Purple
    '#F43F5E', // Rose
    '#14B8A6', // Cyan
    '#FBBF24', // Amber
    '#6366F1', // Indigo
    '#22C55E', // Emerald
    '#0EA5E9', // Sky Blue
    '#D946EF', // Fuchsia
    '#84CC16', // Lime
    '#2563EB', // Dark Blue
    '#7C3AED', // Dark Purple
    '#DB2777', // Dark Pink
    '#EA580C', // Dark Orange
    '#059669', // Dark Teal
    '#4F46E5', // Dark Indigo
  ];
  const hash = Array.from(lowerCaseChoice).reduce(
    (acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0,
    0
  );
  return colors[Math.abs(hash) % colors.length];
}

function getTotalDelegatedVp(
  proposal: Selectable<Proposal>
): number | undefined {
  const metadata = proposal.metadata as ProposalMetadata;
  return metadata.totalDelegatedVp
    ? Number(metadata.totalDelegatedVp)
    : undefined;
}

const ACCUMULATED_VOTING_POWER_THRESHOLD = 5000;

// Process basic (single-choice) votes
async function processBasicVotes(
  votes: Selectable<Vote>[],
  choices: string[],
  proposal: Selectable<Proposal>
): Promise<ProcessedResults> {
  const choiceColors = choices.map((choice) => getColorForChoice(choice));

  const processedVotes: VoteResult[] = votes.map((vote) => {
    const choice = vote.choice as number;
    return {
      choice,
      choiceText: choices[choice] || 'Unknown Choice',
      votingPower: Number(vote.votingPower),
      voterAddress: vote.voterAddress,
      reason: vote.reason,
      timestamp: new Date(vote.timeCreated!),
      color: choiceColors[choice],
    };
  });

  const sortedVotes = [...processedVotes].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  const timeSeriesData: TimeSeriesPoint[] = [];
  let accumulatedVotingPower = 0;
  let lastAccumulatedTimestamp: Date | null = null;

  sortedVotes.forEach((vote) => {
    if (vote.votingPower >= ACCUMULATED_VOTING_POWER_THRESHOLD) {
      // Create a new time series point for this vote
      timeSeriesData.push({
        timestamp: format(
          toZonedTime(vote.timestamp, 'UTC'),
          'yyyy-MM-dd HH:mm:ss'
        ),
        values: { [vote.choice]: vote.votingPower },
      });
    } else {
      // Accumulate voting power
      accumulatedVotingPower += vote.votingPower;
      lastAccumulatedTimestamp = vote.timestamp;

      if (accumulatedVotingPower >= ACCUMULATED_VOTING_POWER_THRESHOLD) {
        // Create a new time series point for the accumulated votes
        timeSeriesData.push({
          timestamp: format(
            toZonedTime(lastAccumulatedTimestamp, 'UTC'),
            'yyyy-MM-dd HH:mm:ss'
          ),
          values: { [vote.choice]: accumulatedVotingPower },
        });
        accumulatedVotingPower = 0; // Reset accumulation
      }
    }
  });

  // If there's any remaining accumulated voting power, add it to the last timestamp
  if (accumulatedVotingPower > 0 && lastAccumulatedTimestamp) {
    timeSeriesData.push({
      timestamp: format(
        toZonedTime(lastAccumulatedTimestamp, 'UTC'),
        'yyyy-MM-dd HH:mm:ss'
      ),
      values: {
        [sortedVotes[sortedVotes.length - 1].choice]: accumulatedVotingPower,
      },
    });
  }

  // Calculate final results
  const finalResults: { [choice: number]: number } = {};
  choices.forEach((_, index) => {
    finalResults[index] = 0;
  });

  processedVotes.forEach((vote) => {
    finalResults[vote.choice] =
      (finalResults[vote.choice] || 0) + vote.votingPower;
  });

  return {
    proposal,
    choices,
    choiceColors,
    totalVotingPower: processedVotes.reduce(
      (sum, vote) => sum + vote.votingPower,
      0
    ),
    quorum: proposal.quorum ? Number(proposal.quorum) : null,
    quorumChoices: (proposal.metadata as ProposalMetadata).quorumChoices ?? [],
    voteType: 'basic',
    votes: processedVotes,
    timeSeriesData,
    finalResults,
    totalDelegatedVp: getTotalDelegatedVp(proposal),
    hiddenVote: (proposal.metadata as ProposalMetadata).hiddenVote,
    scoresState: (proposal.metadata as ProposalMetadata).scoresState,
  };
}

// Process weighted votes
async function processWeightedVotes(
  votes: Selectable<Vote>[],
  choices: string[],
  proposal: Selectable<Proposal>
): Promise<ProcessedResults> {
  const choiceColors = choices.map((choice) => getColorForChoice(choice));

  const processedVotes: VoteResult[] = [];
  const timeSeriesData: TimeSeriesPoint[] = [];
  let accumulatedVotingPower = 0;
  let lastAccumulatedTimestamp: Date | null = null;

  // Sort votes by timestamp
  const sortedVotes = [...votes].sort(
    (a, b) =>
      new Date(a.timeCreated!).getTime() - new Date(b.timeCreated!).getTime()
  );

  sortedVotes.forEach((vote) => {
    const timestamp = new Date(vote.timeCreated!);

    if (
      typeof vote.choice === 'object' &&
      vote.choice !== null &&
      !Array.isArray(vote.choice)
    ) {
      const weightedChoices = vote.choice as Record<string, number>;
      const totalWeight = Object.values(weightedChoices).reduce(
        (sum, weight) => sum + weight,
        0
      );

      // Create a combined choice name
      const combinedChoiceName = Object.entries(weightedChoices)
        .map(([choiceIndex, weight]) => {
          const choice = parseInt(choiceIndex) - 1; // Convert to 0-based index
          const percentage = ((weight / totalWeight) * 100).toFixed(2);
          return `${choices[choice] || 'Unknown Choice'} (${percentage}%)`;
        })
        .join(', ');

      // Add to processed votes
      processedVotes.push({
        choice: -1, // Use -1 to indicate a combined choice
        choiceText: combinedChoiceName,
        votingPower: Number(vote.votingPower),
        voterAddress: vote.voterAddress,
        reason: vote.reason,
        timestamp,
      });

      // Process each choice in the weighted vote
      Object.entries(weightedChoices).forEach(([choiceIndex, weight]) => {
        const choice = parseInt(choiceIndex) - 1; // Convert to 0-based index
        const normalizedPower =
          (Number(vote.votingPower) * weight) / totalWeight;

        if (normalizedPower >= ACCUMULATED_VOTING_POWER_THRESHOLD) {
          // Create a new time series point for this vote
          timeSeriesData.push({
            timestamp: format(
              toZonedTime(timestamp, 'UTC'),
              'yyyy-MM-dd HH:mm:ss'
            ),
            values: { [choice]: normalizedPower },
          });
        } else {
          // Accumulate voting power
          accumulatedVotingPower += normalizedPower;
          lastAccumulatedTimestamp = timestamp;

          if (accumulatedVotingPower >= ACCUMULATED_VOTING_POWER_THRESHOLD) {
            // Create a new time series point for the accumulated votes
            timeSeriesData.push({
              timestamp: format(
                toZonedTime(lastAccumulatedTimestamp, 'UTC'),
                'yyyy-MM-dd HH:mm:ss'
              ),
              values: { [choice]: accumulatedVotingPower },
            });

            accumulatedVotingPower = 0; // Reset accumulation
          }
        }
      });
    } else {
      // Handle non-weighted votes (fallback to basic processing)
      const choice = (vote.choice as number) - 1; // Convert to 0-based index

      processedVotes.push({
        choice,
        choiceText: choices[choice] || 'Unknown Choice',
        votingPower: Number(vote.votingPower),
        voterAddress: vote.voterAddress,
        reason: vote.reason,
        timestamp,
      });

      if (Number(vote.votingPower) >= ACCUMULATED_VOTING_POWER_THRESHOLD) {
        // Create a new time series point for this vote
        timeSeriesData.push({
          timestamp: format(
            toZonedTime(timestamp, 'UTC'),
            'yyyy-MM-dd HH:mm:ss'
          ),
          values: { [choice]: Number(vote.votingPower) },
        });
      } else {
        // Accumulate voting power
        accumulatedVotingPower += Number(vote.votingPower);
        lastAccumulatedTimestamp = timestamp;

        if (accumulatedVotingPower >= ACCUMULATED_VOTING_POWER_THRESHOLD) {
          // Create a new time series point for the accumulated votes
          timeSeriesData.push({
            timestamp: format(
              toZonedTime(lastAccumulatedTimestamp, 'UTC'),
              'yyyy-MM-dd HH:mm:ss'
            ),
            values: { [choice]: accumulatedVotingPower },
          });

          accumulatedVotingPower = 0; // Reset accumulation
        }
      }
    }
  });

  // If there's any remaining accumulated voting power, add it to the last timestamp
  if (accumulatedVotingPower > 0 && lastAccumulatedTimestamp) {
    const lastVote = sortedVotes[sortedVotes.length - 1];
    let lastChoice = 0; // Default to first choice if we can't determine

    if (lastVote && lastVote.choice !== null && lastVote.choice !== undefined) {
      if (Array.isArray(lastVote.choice)) {
        // Handle array case (ranked-choice or approval voting)
        const firstChoice = lastVote.choice[0];
        if (typeof firstChoice === 'number') {
          lastChoice = firstChoice - 1;
        }
      } else if (typeof lastVote.choice === 'number') {
        // Handle basic voting
        lastChoice = lastVote.choice - 1;
      } else if (typeof lastVote.choice === 'object') {
        // Handle weighted voting - use the first choice
        const choices = Object.keys(lastVote.choice);
        if (choices.length > 0) {
          const firstChoiceKey = choices[0];
          const parsedChoice = parseInt(firstChoiceKey, 10);
          if (!isNaN(parsedChoice)) {
            lastChoice = parsedChoice - 1;
          }
        }
      }
    }

    timeSeriesData.push({
      timestamp: format(
        toZonedTime(lastAccumulatedTimestamp, 'UTC'),
        'yyyy-MM-dd HH:mm:ss'
      ),
      values: { [lastChoice]: accumulatedVotingPower },
    });
  }

  // Calculate final results
  const finalResults: { [choice: number]: number } = {};
  choices.forEach((_, index) => {
    finalResults[index] = 0;
  });

  processedVotes.forEach((vote) => {
    if (vote.choice === -1) {
      // Handle weighted votes
      const weightedChoices = votes.find(
        (v) => v.voterAddress === vote.voterAddress
      )?.choice as Record<string, number>;
      const totalWeight = Object.values(weightedChoices).reduce(
        (sum, weight) => sum + weight,
        0
      );

      Object.entries(weightedChoices).forEach(([choiceIndex, weight]) => {
        const choice = parseInt(choiceIndex) - 1;
        const normalizedPower =
          (Number(vote.votingPower) * weight) / totalWeight;
        finalResults[choice] = (finalResults[choice] || 0) + normalizedPower;
      });
    } else {
      // Handle non-weighted votes
      finalResults[vote.choice] =
        (finalResults[vote.choice] || 0) + vote.votingPower;
    }
  });

  return {
    proposal,
    choices,
    choiceColors,
    totalVotingPower: processedVotes.reduce(
      (sum, vote) => sum + vote.votingPower,
      0
    ),
    quorum: proposal.quorum ? Number(proposal.quorum) : null,
    quorumChoices: (proposal.metadata as ProposalMetadata).quorumChoices ?? [],
    voteType: 'weighted',
    votes: processedVotes,
    timeSeriesData,
    finalResults,
    totalDelegatedVp: getTotalDelegatedVp(proposal),
    hiddenVote: (proposal.metadata as ProposalMetadata).hiddenVote,
    scoresState: (proposal.metadata as ProposalMetadata).scoresState,
  };
}

// Process approval votes
async function processApprovalVotes(
  votes: Selectable<Vote>[],
  choices: string[],
  proposal: Selectable<Proposal>
): Promise<ProcessedResults> {
  const choiceColors = choices.map((choice) => getColorForChoice(choice));

  const processedVotes: VoteResult[] = [];
  const timeSeriesData: TimeSeriesPoint[] = [];

  // Initialize accumulated voting power for each choice
  const accumulatedVotingPower: { [choice: number]: number } = {};
  choices.forEach((_, index) => {
    accumulatedVotingPower[index] = 0;
  });

  let lastAccumulatedTimestamp: Date | null = null;

  // Sort votes by timestamp
  const sortedVotes = [...votes].sort(
    (a, b) =>
      new Date(a.timeCreated!).getTime() - new Date(b.timeCreated!).getTime()
  );

  sortedVotes.forEach((vote) => {
    const approvedChoices = Array.isArray(vote.choice)
      ? (vote.choice as number[])
      : [vote.choice as number];
    const timestamp = new Date(vote.timeCreated!);

    // Create a single processed vote with all choices
    const choiceText = approvedChoices
      .map((choice) => choices[choice - 1] || 'Unknown Choice')
      .join(', ');

    processedVotes.push({
      choice: approvedChoices[0], // Use the first choice as the primary choice
      choiceText, // Include all choices in the choiceText
      votingPower: Number(vote.votingPower),
      voterAddress: vote.voterAddress,
      reason: vote.reason,
      timestamp,
    });

    // Accumulate voting power for each choice
    approvedChoices.forEach((choice) => {
      const choiceIndex = choice - 1; // Convert to 0-based index
      accumulatedVotingPower[choiceIndex] += Number(vote.votingPower);
      lastAccumulatedTimestamp = timestamp;

      // Check if any accumulated voting power exceeds the threshold
      if (
        accumulatedVotingPower[choiceIndex] >=
        ACCUMULATED_VOTING_POWER_THRESHOLD
      ) {
        // Create a new time series point for the accumulated votes
        const values: { [choice: number]: number } = {};
        choices.forEach((_, index) => {
          values[index] = accumulatedVotingPower[index];
        });

        timeSeriesData.push({
          timestamp: format(
            toZonedTime(lastAccumulatedTimestamp, 'UTC'),
            'yyyy-MM-dd HH:mm:ss'
          ),
          values,
        });

        // Reset accumulation for all choices
        choices.forEach((_, index) => {
          accumulatedVotingPower[index] = 0;
        });
      }
    });
  });

  // If there's any remaining accumulated voting power, add it to the last timestamp
  if (lastAccumulatedTimestamp) {
    const values: { [choice: number]: number } = {};
    choices.forEach((_, index) => {
      values[index] = accumulatedVotingPower[index];
    });

    timeSeriesData.push({
      timestamp: format(
        toZonedTime(lastAccumulatedTimestamp, 'UTC'),
        'yyyy-MM-dd HH:mm:ss'
      ),
      values,
    });
  }

  // Calculate final results
  const finalResults: { [choice: number]: number } = {};
  choices.forEach((_, index) => {
    finalResults[index] = 0;
  });

  sortedVotes.forEach((vote) => {
    const approvedChoices = Array.isArray(vote.choice)
      ? (vote.choice as number[])
      : [vote.choice as number];
    approvedChoices.forEach((choice) => {
      const choiceIndex = choice - 1;
      finalResults[choiceIndex] = finalResults[choiceIndex] + vote.votingPower;
    });
  });

  return {
    proposal,
    choices,
    choiceColors,
    totalVotingPower: processedVotes.reduce(
      (sum, vote) => sum + vote.votingPower,
      0
    ),
    quorum: proposal.quorum ? Number(proposal.quorum) : null,
    quorumChoices: (proposal.metadata as ProposalMetadata).quorumChoices ?? [],
    voteType: 'approval',
    votes: processedVotes,
    timeSeriesData,
    finalResults,
    totalDelegatedVp: getTotalDelegatedVp(proposal),
    hiddenVote: (proposal.metadata as ProposalMetadata).hiddenVote,
    scoresState: (proposal.metadata as ProposalMetadata).scoresState,
  };
}

// Process ranked-choice votes
async function processRankedChoiceVotes(
  votes: Selectable<Vote>[],
  choices: string[],
  proposal: Selectable<Proposal>
): Promise<ProcessedResults> {
  const choiceColors = choices.map((choice) => getColorForChoice(choice));

  // Early return for empty votes
  if (!votes.length) {
    return {
      proposal,
      choices,
      choiceColors,
      totalVotingPower: 0,
      quorum: proposal.quorum ? Number(proposal.quorum) : null,
      quorumChoices:
        (proposal.metadata as ProposalMetadata).quorumChoices ?? [],
      voteType: 'ranked-choice',
      votes: [],
      timeSeriesData: [],
      finalResults: {},
      totalDelegatedVp: getTotalDelegatedVp(proposal),
      hiddenVote: (proposal.metadata as ProposalMetadata).hiddenVote,
      scoresState: (proposal.metadata as ProposalMetadata).scoresState,
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
      reason: vote.reason,
      choiceText: (vote.choice as number[])
        .map((c) => choices[c - 1] || 'Unknown Choice')
        .join(', '),
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
              (choice) => !eliminatedChoices.has(choice)
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

          processRound(); // Process next round
        }, 1);
      };

      processRound(); // Start processing rounds
    });
  };

  // Generate time series data with non-blocking calculations
  const timeSeriesMap = new Map<string, TimeSeriesPoint>();
  const runningVotes: typeof processedVotes = [];
  let accumulatedVotingPower = 0;
  let lastAccumulatedTimestamp: number | null = null;

  for (const vote of processedVotes) {
    runningVotes.push(vote);
    accumulatedVotingPower += vote.votingPower;
    lastAccumulatedTimestamp = vote.timestamp;

    if (accumulatedVotingPower >= ACCUMULATED_VOTING_POWER_THRESHOLD) {
      const { finalVoteCounts, eliminatedChoices } =
        await calculateIRV(runningVotes);

      const timestampKey = format(
        toZonedTime(new Date(lastAccumulatedTimestamp), 'UTC'),
        'yyyy-MM-dd HH:mm:ss'
      );
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
      values['Winning threshold'] = totalVotes / 2;

      timeSeriesMap.set(timestampKey, { timestamp: timestampKey, values });

      // Reset accumulation
      accumulatedVotingPower = 0;
    }
  }

  // One final round with all votes
  const { finalVoteCounts, eliminatedChoices } =
    await calculateIRV(processedVotes);

  const timestampKey = format(
    toZonedTime(
      new Date(processedVotes[processedVotes.length - 1]?.timestamp),
      'UTC'
    ),
    'yyyy-MM-dd HH:mm:ss'
  );
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
  values['Winning threshold'] = totalVotes / 2;

  timeSeriesMap.set(timestampKey, { timestamp: timestampKey, values });

  const totalVotingPower = processedVotes.reduce(
    (sum, vote) => sum + vote.votingPower,
    0
  );

  // Convert final vote counts to a plain object
  const finalResults: { [choice: number]: number } = {};
  finalVoteCounts.forEach((count, choice) => {
    finalResults[choice] = count;
  });

  return {
    proposal,
    choices,
    choiceColors,
    totalVotingPower,
    quorum: proposal.quorum ? Number(proposal.quorum) : null,
    quorumChoices: (proposal.metadata as ProposalMetadata).quorumChoices ?? [],
    voteType: 'ranked-choice',
    votes: processedVotes.map((vote) => ({
      choice: vote.choice[0],
      choiceText: vote.choiceText,
      votingPower: vote.votingPower,
      voterAddress: vote.voterAddress,
      reason: vote.reason,
      timestamp: new Date(vote.timestamp),
    })),
    timeSeriesData: Array.from(timeSeriesMap.values()),
    finalResults,
    totalDelegatedVp: getTotalDelegatedVp(proposal),
    hiddenVote: (proposal.metadata as ProposalMetadata).hiddenVote,
    scoresState: (proposal.metadata as ProposalMetadata).scoresState,
  };
}

// Process quadratic votes
async function processQuadraticVotes(
  votes: Selectable<Vote>[],
  choices: string[],
  proposal: Selectable<Proposal>
): Promise<ProcessedResults> {
  const choiceColors = choices.map((choice) => getColorForChoice(choice));

  // Temporary fallback to basic processing
  const result = await processBasicVotes(votes, choices, proposal);

  // Include choice colors in the result
  return {
    ...result,
    choiceColors, // Include choice colors
    voteType: 'quadratic',
  };
}

// Main processResults function
export async function processResultsAction(
  proposal: Selectable<Proposal>,
  votes: Selectable<Vote>[]
): Promise<ProcessedResults> {
  'use server';
  return otel('process-results', async () => {
    const choices = proposal.choices as string[];
    const metadata = proposal.metadata as ProposalMetadata;
    const voteType = metadata.voteType || 'basic';

    let result: ProcessedResults;

    switch (voteType) {
      case 'weighted':
        result = await processWeightedVotes(votes, choices, proposal);
        break;
      case 'approval':
        result = await processApprovalVotes(votes, choices, proposal);
        break;
      case 'ranked-choice':
        result = await processRankedChoiceVotes(votes, choices, proposal);
        break;
      case 'quadratic':
        result = await processQuadraticVotes(votes, choices, proposal);
        break;
      default:
        result = await processBasicVotes(votes, choices, proposal);
        break;
    }

    // Check if hiddenVote is true and scoresState is not "final"
    if (metadata.hiddenVote && metadata.scoresState !== 'final') {
      // Aggregate all voting power under choice -1
      result.timeSeriesData = result.timeSeriesData.map((point) => {
        const totalVotingPower = Object.values(point.values).reduce(
          (sum, power) => sum + power,
          0
        );
        return {
          timestamp: point.timestamp,
          values: { [-1]: totalVotingPower },
        };
      });
    }

    return result;
  });
}

export async function getVotesAction(proposalId: string) {
  'use server';
  const votes = await db
    .selectFrom('vote')
    .selectAll()
    .where('proposalId', '=', proposalId)
    .execute();
  return votes;
}

export type DelegateInfo = {
  name: string | null;
} | null;

export async function getDelegateForVoter(
  voterAddress: string,
  daoSlug: string,
  proposalId: string
): Promise<DelegateInfo> {
  return otel('get-delegate-for-voter', async () => {
    const dao = await db
      .selectFrom('dao')
      .where('slug', '=', daoSlug)
      .selectAll()
      .executeTakeFirst();

    if (!dao) return null;

    // Get the proposal to determine the time range
    const proposal = await db
      .selectFrom('proposal')
      .selectAll()
      .where('id', '=', proposalId)
      .executeTakeFirst();

    if (!proposal) return null;

    // Get the voter
    const voter = await db
      .selectFrom('voter')
      .where('address', '=', voterAddress)
      .selectAll()
      .executeTakeFirst();

    if (!voter) return null;

    // Try to get delegate information
    const delegateData = await db
      .selectFrom('delegate')
      .innerJoin('delegateToVoter', 'delegate.id', 'delegateToVoter.delegateId')
      .where('delegateToVoter.voterId', '=', voter.id)
      .where('delegate.daoId', '=', dao.id)
      .select('delegate.id')
      .executeTakeFirst();

    if (!delegateData)
      return {
        name: `${voterAddress}`,
      };

    // Try to get discourse user first
    let discourseUserQuery = db
      .selectFrom('delegateToDiscourseUser')
      .where('delegateId', '=', delegateData.id)
      .leftJoin(
        'discourseUser',
        'discourseUser.id',
        'delegateToDiscourseUser.discourseUserId'
      )
      .where('periodStart', '<=', proposal.timeStart);

    // Only apply the periodEnd condition if the proposal is not active
    if (proposal.proposalState !== ProposalState.ACTIVE) {
      discourseUserQuery = discourseUserQuery.where(
        'periodEnd',
        '>=',
        proposal.timeEnd
      );
    }

    const discourseUser = await discourseUserQuery
      .selectAll()
      .executeTakeFirst();

    if (discourseUser) {
      return {
        name: discourseUser.name || discourseUser.username,
      };
    }

    // Fallback to ENS
    let ensQuery = db
      .selectFrom('delegateToVoter')
      .where('delegateId', '=', delegateData.id)
      .leftJoin('voter', 'voter.id', 'delegateToVoter.voterId')
      .where('periodStart', '<=', proposal.timeStart);

    // Only apply the periodEnd condition if the proposal is not active
    if (proposal.proposalState !== ProposalState.ACTIVE) {
      ensQuery = ensQuery.where('periodEnd', '>=', proposal.timeEnd);
    }

    const ens = await ensQuery.select('voter.ens').executeTakeFirst();

    if (ens?.ens) {
      return {
        name: ens.ens,
      };
    }

    // Fallback to address
    return {
      name: `${voterAddress}`,
    };
  });
}
