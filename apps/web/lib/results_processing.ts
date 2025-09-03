import type { ProposalMetadata } from '@/lib/types';
import type { Proposal, Selectable, Vote } from '@proposalsapp/db';
import { format, toZonedTime } from 'date-fns-tz';

export type VoteType =
  | 'single-choice'
  | 'weighted'
  | 'approval'
  | 'basic'
  | 'quadratic'
  | 'ranked-choice';

export interface ProcessedVote
  extends Pick<
    Selectable<Vote>,
    | 'createdAt'
    | 'proposalId'
    | 'reason'
    | 'voterAddress'
    | 'votingPower'
    | 'id'
  > {
  choice: {
    choiceIndex: number;
    weight: number;
    text: string;
    color: string;
  }[];
  aggregate?: boolean;
  relativeVotingPower?: number;
}

export interface TimeSeriesPoint {
  timestamp: Date;
  values: { [choice: number]: number };
}

export interface ProcessedResults {
  proposal: Selectable<Proposal>;
  choices: string[];
  choiceColors: string[];
  totalVotingPower: number;
  quorum: number | null;
  quorumChoices: number[];
  voteType: VoteType;
  votes?: ProcessedVote[]; // Optional, only included if withVotes is true
  timeSeriesData?: TimeSeriesPoint[]; // Optional, only included if withTimeseries is true
  finalResults: { [choice: number]: number };
  totalDelegatedVp?: number;
  hiddenVote: boolean;
  scoresState: string;
}

export const DEFAULT_CHOICE_COLOR = '#CBD5E1';
/**
 * Function to get a color for a given choice.
 * @param choice - The choice text.
 * @returns A color code based on the choice text.
 */
export function getColorForChoice(choice: string | undefined | null): string {
  if (!choice) return DEFAULT_CHOICE_COLOR; // Default grey color
  const lowerCaseChoice = choice.toLowerCase();
  if (/^(for|yes|yae)/.test(lowerCaseChoice)) return '#69E000'; // Green
  if (/^(against|no|nay)/.test(lowerCaseChoice)) return '#FF4C42'; // Red
  if (lowerCaseChoice === 'abstain') return '#FFCC33'; // Yellow
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

/**
 * Function to get the total delegated voting power from a proposal's metadata.
 * @param proposal - The proposal object.
 * @returns The total delegated voting power or undefined if not available.
 */
// No DB access here; totalDelegatedVp should be provided by server code

const ACCUMULATE_VOTING_POWER_THRESHOLD = 50000;

// Internal result structure returned by specific processors
interface IntermediateProcessingResult {
  processedVotes: ProcessedVote[];
  finalResults: { [choice: number]: number };
  timeSeriesData?: TimeSeriesPoint[];
  totalVotingPower: number;
}

/**
 * Process basic (single-choice) votes.
 * @param votes - The list of votes to process.
 * @param choices - The list of possible choices for the proposal.
 * @param choiceColors - The array of choice colors.
 * @param withTimeseries - Whether to include time series data in the result.
 * @returns An object containing the processed votes, final results, time series data, and total voting power.
 */
async function processBasicVotes(
  votes: Pick<
    Selectable<Vote>,
    | 'choice'
    | 'createdAt'
    | 'proposalId'
    | 'reason'
    | 'voterAddress'
    | 'votingPower'
    | 'id'
  >[],
  choices: string[],
  choiceColors: string[],
  withTimeseries: boolean
): Promise<IntermediateProcessingResult> {
  const processedVotes: ProcessedVote[] = votes.map((vote) => {
    const choiceIndex = typeof vote.choice === 'number' ? vote.choice : 0;
    return {
      ...vote,
      choice: [
        {
          choiceIndex,
          weight: 100, // 100% of the voting power goes to this choice in basic voting
          text: choices[choiceIndex] || 'Unknown Choice',
          color: choiceColors[choiceIndex] || DEFAULT_CHOICE_COLOR,
        },
      ],
      createdAt: new Date(vote.createdAt),
    };
  });

  const timeSeriesData: TimeSeriesPoint[] = [];
  if (withTimeseries) {
    const sortedVotes = [...processedVotes].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    // Accumulate voting power separately for each choice
    const accumulatedVotingPower: { [choice: number]: number } = {};
    choices.forEach((_, index) => {
      accumulatedVotingPower[index] = 0;
    });

    let lastAccumulatedTimestamp: Date | null = null;

    sortedVotes.forEach((vote) => {
      const choice = vote.choice[0].choiceIndex;

      if (vote.votingPower >= ACCUMULATE_VOTING_POWER_THRESHOLD) {
        // Create a new time series point for this vote
        timeSeriesData.push({
          timestamp: vote.createdAt,
          values: { [choice]: vote.votingPower },
        });
      } else {
        // Accumulate voting power for this choice
        accumulatedVotingPower[choice] += vote.votingPower;
        lastAccumulatedTimestamp = vote.createdAt;

        if (
          accumulatedVotingPower[choice] >= ACCUMULATE_VOTING_POWER_THRESHOLD
        ) {
          // Create a new time series point for the accumulated votes for this choice
          timeSeriesData.push({
            timestamp: lastAccumulatedTimestamp,
            values: { [choice]: accumulatedVotingPower[choice] },
          });
          accumulatedVotingPower[choice] = 0; // Reset accumulation for this choice
        }
      }
    });

    // If there's any remaining accumulated voting power for any choice, add it to the last timestamp
    if (lastAccumulatedTimestamp) {
      const remainingValues: { [choice: number]: number } = {};
      let hasRemainingPower = false;

      choices.forEach((_, index) => {
        if (accumulatedVotingPower[index] > 0) {
          remainingValues[index] = accumulatedVotingPower[index];
          hasRemainingPower = true;
        }
      });

      if (hasRemainingPower) {
        timeSeriesData.push({
          timestamp: lastAccumulatedTimestamp,
          values: remainingValues,
        });
      }
    }
  }

  // Calculate final results
  const finalResults: { [choice: number]: number } = {};
  choices.forEach((_, index) => {
    finalResults[index] = 0;
  });

  processedVotes.forEach((vote) => {
    finalResults[vote.choice[0].choiceIndex] =
      finalResults[vote.choice[0].choiceIndex] + vote.votingPower;
  });

  // Calculate total voting power from *processed* valid votes
  const totalVotingPower = processedVotes.reduce(
    (sum, vote) => sum + vote.votingPower,
    0
  );

  return {
    processedVotes,
    finalResults,
    timeSeriesData: withTimeseries ? timeSeriesData : undefined,
    totalVotingPower,
  };
}

/**
 * Process weighted votes.
 * @param votes - The list of votes to process.
 * @param choices - The list of possible choices for the proposal.
 * @param choiceColors - The array of choice colors.
 * @param withTimeseries - Whether to include time series data in the result.
 * @returns An object containing the processed votes, final results, time series data, and total voting power.
 */
async function processWeightedVotes(
  votes: Pick<
    Selectable<Vote>,
    | 'choice'
    | 'createdAt'
    | 'proposalId'
    | 'reason'
    | 'voterAddress'
    | 'votingPower'
    | 'id'
  >[],
  choices: string[],
  choiceColors: string[],
  withTimeseries: boolean
): Promise<IntermediateProcessingResult> {
  const processedVotes: ProcessedVote[] = [];

  votes.forEach((vote) => {
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

      const processedChoice = Object.entries(weightedChoices).map(
        ([choiceIndex, weight]) => {
          const index = parseInt(choiceIndex) - 1; // Convert to 0-based index
          const normalizedWeight =
            totalWeight > 0 ? (weight / totalWeight) * 100 : 0; // Normalize to percentage, handle zero totalWeight

          return {
            choiceIndex: index,
            weight: normalizedWeight,
            text: choices[index] || 'Unknown Choice',
            color: choiceColors[index] || DEFAULT_CHOICE_COLOR,
          };
        }
      );

      processedVotes.push({
        ...vote,
        choice: processedChoice,
        createdAt: new Date(vote.createdAt),
      });
    } else {
      // Fallback for non-object choices (should be rare in weighted voting)
      // Or handle cases where choice might be a single number representing the choice index
      let choiceIndex = -1; // Default to invalid index
      if (typeof vote.choice === 'number') {
        choiceIndex = vote.choice - 1; // Assuming 1-based index from DB
      } else if (
        typeof vote.choice === 'string' &&
        !isNaN(parseInt(vote.choice))
      ) {
        choiceIndex = parseInt(vote.choice) - 1; // Assuming 1-based index as string
      }

      processedVotes.push({
        ...vote,
        choice: [
          {
            choiceIndex,
            weight: 100,
            text: choices[choiceIndex] || 'Unknown Choice',
            color: choiceColors[choiceIndex] || DEFAULT_CHOICE_COLOR,
          },
        ],
        createdAt: new Date(vote.createdAt),
      });
    }
  });

  // Time series data processing
  const timeSeriesData: TimeSeriesPoint[] = [];
  if (withTimeseries) {
    const sortedVotes = [...processedVotes].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    const accumulatedVotingPower: { [choice: number]: number } = {};
    choices.forEach((_, index) => {
      accumulatedVotingPower[index] = 0;
    });

    let lastAccumulatedTimestamp: Date | null = null;

    sortedVotes.forEach((vote) => {
      const timestamp = vote.createdAt;

      vote.choice.forEach((choice) => {
        // Ensure choiceIndex is valid before proceeding
        if (choice.choiceIndex >= 0 && choice.choiceIndex < choices.length) {
          const normalizedPower = (vote.votingPower * choice.weight) / 100;
          const choiceIndex = choice.choiceIndex;

          if (normalizedPower >= ACCUMULATE_VOTING_POWER_THRESHOLD) {
            // Create a new time series point for this significant vote part
            timeSeriesData.push({
              timestamp,
              values: { [choiceIndex]: normalizedPower },
            });
          } else {
            // Accumulate voting power
            accumulatedVotingPower[choiceIndex] += normalizedPower;
            lastAccumulatedTimestamp = timestamp;

            if (
              accumulatedVotingPower[choiceIndex] >=
              ACCUMULATE_VOTING_POWER_THRESHOLD
            ) {
              // Add accumulated power as a time series point
              timeSeriesData.push({
                timestamp: lastAccumulatedTimestamp,
                values: { [choiceIndex]: accumulatedVotingPower[choiceIndex] },
              });

              accumulatedVotingPower[choiceIndex] = 0; // Reset accumulation
            }
          }
        }
      });
    });

    // Add any remaining accumulated power
    if (lastAccumulatedTimestamp) {
      const remainingValues: { [choice: number]: number } = {};
      let hasRemainingPower = false;

      choices.forEach((_, index) => {
        if (accumulatedVotingPower[index] > 0) {
          remainingValues[index] = accumulatedVotingPower[index];
          hasRemainingPower = true;
        }
      });

      if (hasRemainingPower) {
        timeSeriesData.push({
          timestamp: lastAccumulatedTimestamp,
          values: remainingValues,
        });
      }
    }
  }

  // Calculate final results
  const finalResults: { [choice: number]: number } = {};
  choices.forEach((_, index) => {
    finalResults[index] = 0;
  });

  processedVotes.forEach((vote) => {
    vote.choice.forEach((choice) => {
      // Ensure choiceIndex is valid before adding to results
      if (choice.choiceIndex >= 0 && choice.choiceIndex < choices.length) {
        const normalizedPower = (vote.votingPower * choice.weight) / 100;
        finalResults[choice.choiceIndex] =
          (finalResults[choice.choiceIndex] || 0) + normalizedPower; // Initialize if needed
      }
    });
  });

  // Calculate total voting power from *processed* valid votes
  const totalVotingPower = processedVotes.reduce(
    (sum, vote) => sum + vote.votingPower,
    0
  );

  return {
    processedVotes,
    finalResults,
    timeSeriesData: withTimeseries ? timeSeriesData : undefined,
    totalVotingPower,
  };
}

/**
 * Process approval votes.
 * @param votes - The list of votes to process.
 * @param choices - The list of possible choices for the proposal.
 * @param choiceColors - The array of choice colors.
 * @param withTimeseries - Whether to include time series data in the result.
 * @returns An object containing the processed votes, final results, time series data, and total voting power.
 */
async function processApprovalVotes(
  votes: Pick<
    Selectable<Vote>,
    | 'choice'
    | 'createdAt'
    | 'proposalId'
    | 'reason'
    | 'voterAddress'
    | 'votingPower'
    | 'id'
  >[],
  choices: string[],
  choiceColors: string[],
  withTimeseries: boolean
): Promise<IntermediateProcessingResult> {
  const processedVotes: ProcessedVote[] = [];

  votes.forEach((vote) => {
    // Convert the choice to an array if it's not already
    const approvedChoicesInput = Array.isArray(vote.choice)
      ? (vote.choice as (number | string)[])
      : vote.choice !== null && vote.choice !== undefined
        ? [vote.choice as number | string]
        : [];

    // Create a choice entry for each approved choice
    // In approval voting, each choice gets 100% of the weight
    const processedChoice = approvedChoicesInput
      .map((choiceInput) => {
        let choiceIndex = -1;
        if (typeof choiceInput === 'number') {
          choiceIndex = choiceInput - 1; // Assume 1-based index
        } else if (
          typeof choiceInput === 'string' &&
          !isNaN(parseInt(choiceInput))
        ) {
          choiceIndex = parseInt(choiceInput) - 1; // Assume 1-based index as string
        }

        // Validate index
        if (choiceIndex >= 0 && choiceIndex < choices.length) {
          return {
            choiceIndex,
            weight: 100, // Each choice gets 100% of voting power in approval voting
            text: choices[choiceIndex] || 'Unknown Choice',
            color: choiceColors[choiceIndex] || DEFAULT_CHOICE_COLOR,
          };
        }
        return null; // Invalid choice index
      })
      .filter((c): c is Exclude<typeof c, null> => c !== null); // Filter out nulls

    // Only add vote if it has valid choices
    if (processedChoice.length > 0) {
      processedVotes.push({
        ...vote,
        choice: processedChoice,
        createdAt: new Date(vote.createdAt),
      });
    }
  });

  const timeSeriesData: TimeSeriesPoint[] = [];
  if (withTimeseries) {
    const sortedVotes = [...processedVotes].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    const accumulatedVotingPower: { [choice: number]: number } = {};
    choices.forEach((_, index) => {
      accumulatedVotingPower[index] = 0;
    });

    let lastAccumulatedTimestamp: Date | null = null;

    sortedVotes.forEach((vote) => {
      const timestamp = vote.createdAt;

      vote.choice.forEach((choice) => {
        // Choice index already validated during processedVotes creation
        const choiceIndex = choice.choiceIndex;
        const votePower = vote.votingPower; // Full voting power for each choice in approval voting

        if (votePower >= ACCUMULATE_VOTING_POWER_THRESHOLD) {
          // Create a new time series point for this vote
          timeSeriesData.push({
            timestamp,
            values: { [choiceIndex]: votePower },
          });
        } else {
          // Accumulate voting power
          accumulatedVotingPower[choiceIndex] += votePower;
          lastAccumulatedTimestamp = timestamp;

          if (
            accumulatedVotingPower[choiceIndex] >=
            ACCUMULATE_VOTING_POWER_THRESHOLD
          ) {
            // Add accumulated power as a time series point
            timeSeriesData.push({
              timestamp: lastAccumulatedTimestamp,
              values: { [choiceIndex]: accumulatedVotingPower[choiceIndex] },
            });

            accumulatedVotingPower[choiceIndex] = 0; // Reset accumulation
          }
        }
      });
    });

    // Add any remaining accumulated power
    if (lastAccumulatedTimestamp) {
      const remainingValues: { [choice: number]: number } = {};
      let hasRemainingPower = false;

      choices.forEach((_, index) => {
        if (accumulatedVotingPower[index] > 0) {
          remainingValues[index] = accumulatedVotingPower[index];
          hasRemainingPower = true;
        }
      });

      if (hasRemainingPower) {
        timeSeriesData.push({
          timestamp: lastAccumulatedTimestamp,
          values: remainingValues,
        });
      }
    }
  }

  // Calculate final results
  const finalResults: { [choice: number]: number } = {};
  choices.forEach((_, index) => {
    finalResults[index] = 0;
  });

  processedVotes.forEach((vote) => {
    vote.choice.forEach((choice) => {
      // Ensure choiceIndex is valid before adding to results
      if (choice.choiceIndex >= 0 && choice.choiceIndex < choices.length) {
        const normalizedPower = (vote.votingPower * choice.weight) / 100;
        finalResults[choice.choiceIndex] =
          (finalResults[choice.choiceIndex] || 0) + normalizedPower; // Initialize if needed
      }
    });
  });

  // Calculate total voting power from *processed* valid votes
  const totalVotingPower = processedVotes.reduce(
    (sum, vote) => sum + vote.votingPower,
    0
  );

  return {
    processedVotes,
    finalResults,
    timeSeriesData: withTimeseries ? timeSeriesData : undefined,
    totalVotingPower,
  };
}

/** Helper function for IRV calculation (synchronous) */
const calculateIRVSync = (
  currentVotes: ProcessedVote[],
  choices: string[]
): {
  winner: number | undefined;
  finalVoteCounts: Map<number, number>;
  eliminatedChoices: Set<number>;
} => {
  const eliminatedChoices = new Set<number>();
  let roundVoteCounts = new Map<number, number>();
  let winner: number | undefined;
  const numChoices = choices.length;

  while (winner === undefined && eliminatedChoices.size < numChoices - 1) {
    const currentRoundCounts = new Map<number, number>();
    let totalVotesInRound = 0;

    // Initialize counts for active choices
    choices.forEach((_, index) => {
      if (!eliminatedChoices.has(index)) {
        currentRoundCounts.set(index, 0);
      }
    });

    // Tally first available preferences for this round
    currentVotes.forEach((vote) => {
      const validChoice = vote.choice.find(
        (c) =>
          !eliminatedChoices.has(c.choiceIndex) &&
          c.choiceIndex >= 0 &&
          c.choiceIndex < numChoices // Ensure valid index
      );

      if (validChoice) {
        const choiceIndex = validChoice.choiceIndex;
        currentRoundCounts.set(
          choiceIndex,
          (currentRoundCounts.get(choiceIndex) || 0) + vote.votingPower
        );
        totalVotesInRound += vote.votingPower;
      }
      // else: vote is exhausted or only contains eliminated/invalid choices
    });

    roundVoteCounts = new Map(currentRoundCounts); // Store counts for this round

    // If no votes were tallied (e.g., all exhausted), break
    if (totalVotesInRound === 0) {
      break;
    }

    const majorityThreshold = totalVotesInRound / 2;
    const activeChoiceIndices = Array.from(currentRoundCounts.keys());

    // Check for winner
    let potentialWinner: number | undefined = undefined;
    for (const choiceIndex of activeChoiceIndices) {
      if ((currentRoundCounts.get(choiceIndex) || 0) > majorityThreshold) {
        potentialWinner = choiceIndex;
        break;
      }
    }

    if (potentialWinner !== undefined) {
      winner = potentialWinner;
      break; // Winner found
    }

    // If only one choice is left active, it's the winner
    if (activeChoiceIndices.length === 1) {
      winner = activeChoiceIndices[0];
      break;
    }

    // No winner yet, find choice(s) to eliminate
    let minVotes = Infinity;
    activeChoiceIndices.forEach((choiceIndex) => {
      minVotes = Math.min(minVotes, currentRoundCounts.get(choiceIndex) || 0);
    });

    const choicesToEliminate = activeChoiceIndices.filter(
      (choiceIndex) => (currentRoundCounts.get(choiceIndex) || 0) === minVotes
    );

    // If all remaining active choices are tied for the minimum, we can't eliminate fairly.
    // Treat the one with the highest vote count in this tied group as the winner (or break tie arbitrarily if needed)
    // Or, simpler: if all active choices have the same vote count, break the loop.
    if (
      choicesToEliminate.length === activeChoiceIndices.length &&
      activeChoiceIndices.length > 0
    ) {
      break; // Unbreakable tie among all remaining
    }

    // Eliminate the choice(s) with the minimum votes
    choicesToEliminate.forEach((choiceIndex) => {
      eliminatedChoices.add(choiceIndex);
    });

    // Check if elimination resulted in a winner (only one choice left)
    const remainingActive = choices.filter(
      (_, index) => !eliminatedChoices.has(index)
    ).length;
    if (remainingActive === 1) {
      winner = choices.findIndex((_, index) => !eliminatedChoices.has(index));
      // Keep the roundVoteCounts from the round *before* this final elimination determined the winner
      break;
    }
  } // End while loop

  // If loop exited without a clear winner (e.g., unbreakable tie), determine winner from last round counts
  if (winner === undefined && roundVoteCounts.size > 0) {
    let maxVotes = -1;
    let potentialWinnerFromLastRound: number | undefined = undefined;
    // Consider only choices active in the last round calculation
    roundVoteCounts.forEach((votes, choiceIndex) => {
      // No need to check eliminatedChoices here as roundVoteCounts only contains active ones for that round
      if (votes > maxVotes) {
        maxVotes = votes;
        potentialWinnerFromLastRound = choiceIndex;
      }
      // Basic tie-breaking: last one found with max votes wins. Could implement more robust tie-breaking if needed.
    });
    winner = potentialWinnerFromLastRound;
  } else if (
    winner === undefined &&
    numChoices > 0 &&
    eliminatedChoices.size === numChoices - 1
  ) {
    // Edge case: If exactly one choice remains after loop but wasn't declared winner
    winner = choices.findIndex((_, index) => !eliminatedChoices.has(index));
  } else if (
    winner === undefined &&
    numChoices > 0 &&
    currentVotes.length > 0 &&
    roundVoteCounts.size === 0
  ) {
    // Edge case: All votes exhausted, pick winner from the last non-empty round? Or handle as tie?
    // For now, let's leave winner undefined or pick based on last known state if possible.
    // This requires storing previous round counts, adding complexity. Let's assume roundVoteCounts holds the last meaningful state.
    let maxVotes = -1;
    let potentialWinnerFromLastRound: number | undefined = undefined;
    roundVoteCounts.forEach((votes, choiceIndex) => {
      if (votes > maxVotes) {
        maxVotes = votes;
        potentialWinnerFromLastRound = choiceIndex;
      }
    });
    winner = potentialWinnerFromLastRound;
  }

  // Return the vote counts from the *last computed round*
  return { winner, finalVoteCounts: roundVoteCounts, eliminatedChoices };
};

/**
 * Process ranked-choice votes using the Instant Runoff Voting (IRV) method.
 * @param votes - The list of votes to process.
 * @param choices - The list of possible choices for the proposal.
 * @param choiceColors - The array of choice colors.
 * @param withTimeseries - Whether to include time series data in the result.
 * @returns An object containing the processed votes, final results, time series data, and total voting power.
 */
async function processRankedChoiceVotes(
  votes: Pick<
    Selectable<Vote>,
    | 'choice'
    | 'createdAt'
    | 'proposalId'
    | 'reason'
    | 'voterAddress'
    | 'votingPower'
    | 'id'
  >[],
  choices: string[],
  choiceColors: string[],
  withTimeseries: boolean
): Promise<IntermediateProcessingResult> {
  const numChoices = choices.length;

  // Process votes: Ensure choice indices are valid (0-based) and filter invalid ranks
  const processedVotes: ProcessedVote[] = votes
    .map((vote) => {
      const rankChoicesInput = Array.isArray(vote.choice)
        ? (vote.choice as (number | string)[])
        : vote.choice !== null && vote.choice !== undefined
          ? [vote.choice as number | string]
          : [];

      const uniqueValidChoices = new Set<number>(); // Ensure a choice isn't ranked multiple times

      const processedChoice = rankChoicesInput
        .map((choiceInput) => {
          let choiceIndex = -1;
          if (typeof choiceInput === 'number') {
            choiceIndex = choiceInput - 1; // Assume 1-based index
          } else if (
            typeof choiceInput === 'string' &&
            !isNaN(parseInt(choiceInput))
          ) {
            choiceIndex = parseInt(choiceInput) - 1; // Assume 1-based index as string
          }

          // Validate index and uniqueness
          if (
            choiceIndex >= 0 &&
            choiceIndex < numChoices &&
            !uniqueValidChoices.has(choiceIndex)
          ) {
            uniqueValidChoices.add(choiceIndex);
            return {
              choiceIndex,
              weight: 100, // Weight isn't used directly in IRV logic but kept for consistency
              text: choices[choiceIndex] || 'Unknown Choice',
              color: choiceColors[choiceIndex] || DEFAULT_CHOICE_COLOR,
            };
          }
          return null; // Invalid or duplicate choice index for this rank
        })
        .filter((c): c is Exclude<typeof c, null> => c !== null); // Filter out nulls

      // Only include vote if it has at least one valid rank
      if (processedChoice.length > 0) {
        return {
          ...vote,
          choice: processedChoice,
          createdAt: new Date(vote.createdAt),
        };
      }
      return null; // Vote is invalid/empty
    })
    .filter((v): v is ProcessedVote => v !== null); // Filter out invalid votes

  let timeSeriesData: TimeSeriesPoint[] = [];
  if (withTimeseries && processedVotes.length > 0) {
    const timeSeriesMap = new Map<string, TimeSeriesPoint>();
    const runningVotes: ProcessedVote[] = [];
    let accumulatedVotingPower = 0; // Track total VP added since last point
    let lastProcessedTimestamp: number | null = null;

    // Sort votes chronologically
    const sortedVotes = [...processedVotes].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    for (const vote of sortedVotes) {
      runningVotes.push(vote);
      // Accumulate total VP, not just the individual vote's VP, to decide when to compute point
      accumulatedVotingPower += vote.votingPower;
      lastProcessedTimestamp = vote.createdAt.getTime();

      // Compute a timeseries point if threshold reached OR it's the very last vote
      if (
        accumulatedVotingPower >= ACCUMULATE_VOTING_POWER_THRESHOLD ||
        runningVotes.length === sortedVotes.length
      ) {
        // Run synchronous IRV calculation on all votes up to this point
        const { finalVoteCounts: roundCounts } = calculateIRVSync(
          runningVotes,
          choices
        );

        const timestampKey = format(
          toZonedTime(new Date(lastProcessedTimestamp), 'UTC'),
          'yyyy-MM-dd HH:mm:ss.SSS' // Increase precision to avoid conflicts
        );

        const values: Record<number | string, number> = {};
        let totalVotesInFinalRound = 0;

        // Store the vote counts for choices active in the *last calculated round*
        roundCounts.forEach((count, choiceIndex) => {
          // We only care about counts from the final round's perspective in `roundCounts`
          values[choiceIndex] = count;
          totalVotesInFinalRound += count;
        });

        // Add 'Winning threshold' based on the total votes in that final simulated round
        values['Winning threshold'] = totalVotesInFinalRound / 2;

        timeSeriesMap.set(timestampKey, {
          timestamp: new Date(lastProcessedTimestamp),
          values,
        });

        // Reset accumulation *after* processing the point
        accumulatedVotingPower = 0;
      }
    }
    timeSeriesData = Array.from(timeSeriesMap.values()).sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    ); // Ensure sorted
  }

  // Calculate final results by running IRV on *all* processed votes
  const { finalVoteCounts: finalRoundCounts } = calculateIRVSync(
    processedVotes,
    choices
  );

  // Final results should reflect the state of the last round of IRV
  // Use the corrected type { [choice: number | string]: number }
  const finalResults: { [choice: number | string]: number } = {};
  choices.forEach((_, index) => {
    finalResults[index] = finalRoundCounts.get(index) || 0; // Use counts from the last round map
  });

  // Add the winning threshold to the final results as well, calculated from the final round
  let totalVotesInVeryFinalRound = 0;
  finalRoundCounts.forEach((count) => (totalVotesInVeryFinalRound += count));
  // This assignment is now type-correct
  finalResults['Winning threshold'] = totalVotesInVeryFinalRound / 2;

  // Calculate total voting power from *processed* valid votes
  const totalVotingPower = processedVotes.reduce(
    (sum, vote) => sum + vote.votingPower,
    0
  );

  return {
    processedVotes,
    finalResults,
    timeSeriesData: withTimeseries ? timeSeriesData : undefined,
    totalVotingPower,
  };
}

/**
 * Process quadratic votes.
 * @param votes - The list of votes to process.
 * @param choices - The list of possible choices for the proposal.
 * @param choiceColors - The array of choice colors.
 * @param withTimeseries - Whether to include time series data in the result.
 * @returns An object containing the processed votes, final results, time series data, and total voting power.
 */
async function processQuadraticVotes(
  votes: Pick<
    Selectable<Vote>,
    | 'choice'
    | 'createdAt'
    | 'proposalId'
    | 'reason'
    | 'voterAddress'
    | 'votingPower'
    | 'id'
  >[],
  choices: string[],
  choiceColors: string[],
  withTimeseries: boolean
): Promise<IntermediateProcessingResult> {
  const processedVotes: ProcessedVote[] = votes.map((vote) => {
    // Quadratic voting usually implies multiple choices with credits,
    // but snapshot's implementation often simplifies it to single choice
    // where the voter implicitly uses all their VP. Let's assume the latter based on `vote.choice` type.
    let choiceIndex = -1;
    if (typeof vote.choice === 'number') {
      choiceIndex = vote.choice - 1; // Assuming 1-based index
    } else if (
      typeof vote.choice === 'string' &&
      !isNaN(parseInt(vote.choice))
    ) {
      choiceIndex = parseInt(vote.choice) - 1; // Assuming 1-based index as string
    } else if (
      typeof vote.choice === 'object' &&
      vote.choice !== null &&
      !Array.isArray(vote.choice)
    ) {
      // If choice is an object like {"1": 100}, extract the key as the choice index
      const keys = Object.keys(vote.choice);
      if (keys.length === 1 && !isNaN(parseInt(keys[0]))) {
        choiceIndex = parseInt(keys[0]) - 1;
      }
    }

    // If choice index is invalid, create a placeholder or skip? Let's create a placeholder for now.
    if (choiceIndex < 0 || choiceIndex >= choices.length) {
      // Assign to a default/invalid index or handle appropriately
      // For now, let's still create the vote object but results/timeseries won't use it effectively
      choiceIndex = -1; // Or perhaps 0 if choices[0] is a reasonable default?
    }

    return {
      ...vote,
      choice: [
        {
          choiceIndex,
          weight: 100, // Weight is not really applicable here, but keep structure
          text: choices[choiceIndex] || 'Unknown Choice',
          color: choiceColors[choiceIndex] || DEFAULT_CHOICE_COLOR,
        },
      ],
      createdAt: new Date(vote.createdAt),
    };
  });

  const timeSeriesData: TimeSeriesPoint[] = [];
  if (withTimeseries) {
    const sortedVotes = [...processedVotes].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    // Accumulate *quadratic* voting power separately for each choice
    const accumulatedQuadraticPower: { [choice: number]: number } = {};
    choices.forEach((_, index) => {
      accumulatedQuadraticPower[index] = 0;
    });

    let lastAccumulatedTimestamp: Date | null = null;

    sortedVotes.forEach((vote) => {
      if (!vote.choice[0] || vote.choice[0].choiceIndex < 0) return; // Skip votes with invalid choice index

      const choice = vote.choice[0].choiceIndex;
      const quadraticPower = Math.sqrt(vote.votingPower); // Calculate quadratic contribution

      // Thresholding based on quadratic power might be misleading.
      // Let's threshold based on original voting power for consistency?
      // Or threshold based on accumulated quadratic power. Let's try accumulated quadratic power.
      const effectiveThreshold = Math.sqrt(ACCUMULATE_VOTING_POWER_THRESHOLD); // Threshold for quadratic power

      if (quadraticPower >= effectiveThreshold) {
        // Check if individual vote's quadratic power is significant
        // Create a new time series point for this vote's quadratic contribution
        timeSeriesData.push({
          timestamp: vote.createdAt,
          values: { [choice]: quadraticPower },
        });
      } else {
        // Accumulate quadratic power for this choice
        accumulatedQuadraticPower[choice] =
          (accumulatedQuadraticPower[choice] || 0) + quadraticPower;
        lastAccumulatedTimestamp = vote.createdAt;

        if (accumulatedQuadraticPower[choice] >= effectiveThreshold) {
          // Create a new time series point for the accumulated quadratic power for this choice
          timeSeriesData.push({
            timestamp: lastAccumulatedTimestamp,
            values: { [choice]: accumulatedQuadraticPower[choice] },
          });
          accumulatedQuadraticPower[choice] = 0; // Reset accumulation for this choice
        }
      }
    });

    // If there's any remaining accumulated quadratic power, add it
    if (lastAccumulatedTimestamp) {
      const remainingValues: { [choice: number]: number } = {};
      let hasRemainingPower = false;

      choices.forEach((_, index) => {
        if (accumulatedQuadraticPower[index] > 0) {
          remainingValues[index] = accumulatedQuadraticPower[index];
          hasRemainingPower = true;
        }
      });

      if (hasRemainingPower) {
        timeSeriesData.push({
          timestamp: lastAccumulatedTimestamp,
          values: remainingValues,
        });
      }
    }
  }

  // Calculate final results (sum of square roots of voting power)
  const finalResults: { [choice: number]: number } = {};
  choices.forEach((_, index) => {
    finalResults[index] = 0;
  });

  processedVotes.forEach((vote) => {
    if (vote.choice[0] && vote.choice[0].choiceIndex >= 0) {
      const choiceIndex = vote.choice[0].choiceIndex;
      const quadraticPower = Math.sqrt(vote.votingPower);
      finalResults[choiceIndex] =
        (finalResults[choiceIndex] || 0) + quadraticPower;
    }
  });

  // Calculate total voting power from *processed* valid votes
  const totalVotingPower = processedVotes.reduce(
    (sum, vote) => sum + vote.votingPower,
    0
  );

  return {
    processedVotes,
    finalResults,
    timeSeriesData: withTimeseries ? timeSeriesData : undefined,
    totalVotingPower,
  };
}

export interface ProcessingConfig {
  withVotes?: boolean;
  withTimeseries?: boolean;
  aggregatedVotes?: boolean;
  totalDelegatedVpAtStart?: number;
}

/**
 * Main function to process votes for a given proposal.
 * @param proposal - The proposal object to process results for.
 * @param votes - The list of votes associated with the proposal.
 * @param withVotes - Whether to include processed votes in the result. Defaults to true.
 * @param withTimeseries - Whether to include time series data in the result. Defaults to true.
 * @param aggregatedVotes - Whether to aggregate small votes between large ones. Defaults to false.
 * @param totalDelegatedVpAtStart - Optional normalized denominator for bars; the DAO-wide
 *        total delegated voting power at or before proposal start. Must be computed server-side.
 * @returns A promise that resolves to the processed results.
 */
export async function processResultsAction(
  proposal: Selectable<Proposal>,
  votes: Pick<
    Selectable<Vote>,
    | 'choice'
    | 'createdAt'
    | 'proposalId'
    | 'reason'
    | 'voterAddress'
    | 'votingPower'
    | 'id'
  >[],
  {
    withVotes = true,
    withTimeseries = true,
    aggregatedVotes = false,
    totalDelegatedVpAtStart,
  }: ProcessingConfig
): Promise<ProcessedResults> {
  // --- Common Setup ---
  const processedProposal = {
    ...proposal,
    startAt: new Date(proposal.startAt),
    endAt: new Date(proposal.endAt),
    createdAt: new Date(proposal.createdAt),
  };

  // Ensure choices is always an array of strings, provide default if necessary
  const choices = Array.isArray(proposal.choices)
    ? (proposal.choices as string[]).map(String) // Ensure all elements are strings
    : [];

  const metadata = (proposal.metadata || {}) as ProposalMetadata; // Use default empty object
  const voteType = (metadata.voteType || 'basic') as VoteType;
  const quorum = proposal.quorum ? Number(proposal.quorum) : null;
  const quorumChoices = metadata.quorumChoices ?? [];
  const totalDelegatedVp =
    typeof totalDelegatedVpAtStart === 'number'
      ? totalDelegatedVpAtStart
      : undefined;
  const hiddenVote = metadata.hiddenVote ?? false;
  const scoresState = metadata.scoresState ?? 'unknown';

  // Handle cases where choices might be missing or malformed early
  if (choices.length === 0) {
    console.warn(`Proposal ${proposal.id} has no valid choices defined.`);
    return {
      proposal: processedProposal,
      choices: [],
      choiceColors: [],
      totalVotingPower: 0,
      quorum,
      quorumChoices,
      voteType: 'basic',
      votes: withVotes ? [] : undefined,
      timeSeriesData: withTimeseries ? [] : undefined,
      finalResults: {},
      totalDelegatedVp,
      hiddenVote,
      scoresState,
    };
  }

  const choiceColors = choices.map((choice) => getColorForChoice(choice));

  // Filter out votes with non-positive voting power before processing
  const validVotes = votes.filter((vote) => vote.votingPower > 0);

  // --- Type-Specific Processing ---
  let intermediateResult: IntermediateProcessingResult;

  switch (voteType) {
    case 'basic':
    case 'single-choice':
      intermediateResult = await processBasicVotes(
        validVotes,
        choices,
        choiceColors, // Pass colors
        withTimeseries
      );
      break;
    case 'weighted':
      intermediateResult = await processWeightedVotes(
        validVotes,
        choices,
        choiceColors, // Pass colors
        withTimeseries
      );
      break;
    case 'approval':
      intermediateResult = await processApprovalVotes(
        validVotes,
        choices,
        choiceColors, // Pass colors
        withTimeseries
      );
      break;
    case 'ranked-choice':
      intermediateResult = await processRankedChoiceVotes(
        validVotes,
        choices,
        choiceColors, // Pass colors
        withTimeseries
      );
      break;
    case 'quadratic':
      intermediateResult = await processQuadraticVotes(
        validVotes,
        choices,
        choiceColors, // Pass colors
        withTimeseries
      );
      break;
    default:
      console.warn(
        `Unknown vote type "${voteType}" for proposal ${proposal.id}. Defaulting to basic.`
      );
      intermediateResult = await processBasicVotes(
        validVotes,
        choices,
        choiceColors, // Pass colors
        withTimeseries
      );
      break;
  }

  // --- Post-Processing & Final Structure ---
  let finalProcessedVotes = intermediateResult.processedVotes;
  let finalTimeSeriesData = intermediateResult.timeSeriesData;
  let finalResults = intermediateResult.finalResults;
  const totalVotingPower = intermediateResult.totalVotingPower;

  // Aggregation logic
  if (withVotes && aggregatedVotes && finalProcessedVotes.length > 0) {
    const aggregatedResults: ProcessedVote[] = [];
    let currentAggregation: {
      [choice: number]: { power: number; count: number };
    } = {};
    let aggregationStartTime: Date | null = null;

    // Ensure votes are sorted by time for aggregation logic
    const sortedVotes = [...finalProcessedVotes].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    for (let i = 0; i < sortedVotes.length; i++) {
      const voteItem = sortedVotes[i];

      if (voteItem.votingPower >= ACCUMULATE_VOTING_POWER_THRESHOLD) {
        // End current aggregation window if open
        if (
          Object.keys(currentAggregation).length > 0 &&
          aggregationStartTime
        ) {
          for (const choiceIndexStr in currentAggregation) {
            const choiceIndex = Number(choiceIndexStr);
            const aggregatedData = currentAggregation[choiceIndex];

            if (aggregatedData.power > 0) {
              aggregatedResults.push({
                proposalId: processedProposal.id,
                reason: `Aggregated ${aggregatedData.count} votes`,
                votingPower: aggregatedData.power,
                aggregate: true,
                createdAt: voteItem.createdAt,
                choice: [
                  {
                    choiceIndex,
                    weight: 100,
                    text: choices[choiceIndex] || 'Unknown Choice',
                    color: choiceColors[choiceIndex] || DEFAULT_CHOICE_COLOR,
                  },
                ],
                voterAddress: 'aggregated',
                id: `aggregated-${aggregationStartTime.toISOString()}-${choiceIndex}`,
              });
            }
          }
          currentAggregation = {};
          aggregationStartTime = null;
        }

        // Add the significant vote
        aggregatedResults.push({ ...voteItem, aggregate: false });
      } else {
        // Start or continue aggregation window
        if (!aggregationStartTime) {
          aggregationStartTime = voteItem.createdAt;
        }

        // Distribute voting power based on choices and weights
        voteItem.choice.forEach((choiceItem) => {
          const choiceIndex = choiceItem.choiceIndex;
          if (choiceIndex >= 0 && choiceIndex < choices.length) {
            const proportionalPower =
              (voteItem.votingPower * choiceItem.weight) / 100;
            if (!currentAggregation[choiceIndex]) {
              currentAggregation[choiceIndex] = { power: 0, count: 0 };
            }
            currentAggregation[choiceIndex].power += proportionalPower;
            currentAggregation[choiceIndex].count += 1; // Count votes being aggregated per choice
          }
        });
      }
    }

    // Handle any remaining aggregation at the end
    if (Object.keys(currentAggregation).length > 0 && aggregationStartTime) {
      const finalTimestamp =
        sortedVotes[sortedVotes.length - 1]?.createdAt ?? new Date();
      for (const choiceIndexStr in currentAggregation) {
        const choiceIndex = Number(choiceIndexStr);
        const aggregatedData = currentAggregation[choiceIndex];

        if (aggregatedData.power > 0) {
          aggregatedResults.push({
            proposalId: processedProposal.id,
            reason: `Aggregated ${aggregatedData.count} votes (final)`,
            votingPower: aggregatedData.power,
            aggregate: true,
            createdAt: finalTimestamp, // Timestamp of the last vote in the list
            choice: [
              {
                choiceIndex,
                weight: 100,
                text: choices[choiceIndex] || 'Unknown Choice',
                color: choiceColors[choiceIndex] || DEFAULT_CHOICE_COLOR,
              },
            ],
            voterAddress: 'aggregated',
            id: `aggregated-final-${aggregationStartTime.toISOString()}-${choiceIndex}`,
          });
        }
      }
    }

    finalProcessedVotes = aggregatedResults;
  }

  // Calculate relativeVotingPower
  if (withVotes && finalProcessedVotes) {
    // Find max power among non-aggregated votes if aggregation happened, otherwise all votes
    const relevantVotes = aggregatedVotes
      ? finalProcessedVotes.filter((v) => !v.aggregate)
      : finalProcessedVotes;
    const maxIndividualVotingPower = Math.max(
      ...relevantVotes.map((vote) => vote.votingPower),
      0
    );

    finalProcessedVotes.forEach((vote) => {
      vote.relativeVotingPower =
        maxIndividualVotingPower > 0
          ? vote.votingPower / maxIndividualVotingPower
          : 0;
      // Clamp relative power for aggregated votes if they exceed max individual
      if (vote.aggregate && vote.relativeVotingPower > 1) {
        vote.relativeVotingPower = 1;
      }
    });
  }

  // Handle hidden votes
  if (hiddenVote && scoresState !== 'final') {
    // Invalidate final results
    finalResults = choices.reduce(
      (acc, _, index) => {
        acc[index] = 0;
        return acc;
      },
      { [-1]: totalVotingPower } as Record<number, number> // Use calculated total VP
    ); // Assign all power to choice -1

    // Invalidate timeseries
    finalTimeSeriesData = finalTimeSeriesData?.map((point) => {
      const totalPowerInPoint = Object.values(point.values).reduce(
        (sum, power) => sum + power,
        0
      );
      return {
        timestamp: point.timestamp,
        values: { [-1]: totalPowerInPoint }, // Aggregate all power in the point to choice -1
      };
    });

    // Add a placeholder color for the hidden choice if needed
    // We need to make sure choiceColors is mutable or handled correctly if accessed by index -1 elsewhere
    // For simplicity, let's assume components handle missing colors.
    // choiceColors[-1] = DEFAULT_CHOICE_COLOR; // Avoid modifying array with negative index directly
  }

  // Final data type consistency checks (Dates)
  if (finalTimeSeriesData) {
    finalTimeSeriesData = finalTimeSeriesData.map((point) => ({
      ...point,
      timestamp: new Date(point.timestamp), // Ensure Date object
    }));
  }

  if (finalProcessedVotes) {
    finalProcessedVotes = finalProcessedVotes.map((vote) => ({
      ...vote,
      createdAt: new Date(vote.createdAt), // Ensure Date object
    }));
  }

  // Construct the final ProcessedResults object
  const result: ProcessedResults = {
    proposal: processedProposal,
    choices,
    choiceColors,
    totalVotingPower, // Use the value calculated by the specific processor
    quorum,
    quorumChoices,
    voteType,
    votes: withVotes ? finalProcessedVotes : undefined,
    timeSeriesData: withTimeseries ? finalTimeSeriesData : undefined,
    finalResults,
    totalDelegatedVp,
    hiddenVote,
    scoresState,
  };

  return result;
}
