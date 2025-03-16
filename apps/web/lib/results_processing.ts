import { ProposalMetadata } from '@/app/types';
import { otel } from '@/lib/otel';
import { Proposal, Selectable, Vote } from '@proposalsapp/db-indexer';
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
  relativeVotingPower?: number; // Added relativeVotingPower
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
function getTotalDelegatedVp(
  proposal: Selectable<Proposal>
): number | undefined {
  const metadata = proposal.metadata as ProposalMetadata;
  return metadata.totalDelegatedVp
    ? Number(metadata.totalDelegatedVp)
    : undefined;
}

const ACCUMULATE_VOTING_POWER_THRESHOLD = 50000;

/**
 * Process basic (single-choice) votes.
 * @param votes - The list of votes to process.
 * @param choices - The list of possible choices for the proposal.
 * @param proposal - The proposal object.
 * @param withVotes - Whether to include processed votes in the result.
 * @param withTimeseries - Whether to include time series data in the result.
 * @returns A promise that resolves to the processed results.
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
  proposal: Selectable<Proposal>,
  withVotes: boolean,
  withTimeseries: boolean
): Promise<ProcessedResults> {
  const choiceColors = choices.map((choice) => getColorForChoice(choice));

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
      (finalResults[vote.choice[0].choiceIndex] || 0) + vote.votingPower;
  });

  const processedProposal = {
    ...proposal,
    startAt: new Date(proposal.startAt),
    endAt: new Date(proposal.endAt),
    createdAt: new Date(proposal.createdAt),
  };

  return {
    proposal: processedProposal,
    choices,
    choiceColors,
    totalVotingPower: processedVotes.reduce(
      (sum, vote) => sum + vote.votingPower,
      0
    ),
    quorum: proposal.quorum ? Number(proposal.quorum) : null,
    quorumChoices: (proposal.metadata as ProposalMetadata).quorumChoices ?? [],
    voteType: 'basic',
    votes: withVotes ? processedVotes : undefined,
    timeSeriesData: withTimeseries ? timeSeriesData : undefined,
    finalResults,
    totalDelegatedVp: getTotalDelegatedVp(proposal),
    hiddenVote: (proposal.metadata as ProposalMetadata).hiddenVote,
    scoresState: (proposal.metadata as ProposalMetadata).scoresState,
  };
}

/**
 * Process weighted votes.
 * @param votes - The list of votes to process.
 * @param choices - The list of possible choices for the proposal.
 * @param proposal - The proposal object.
 * @param withVotes - Whether to include processed votes in the result.
 * @param withTimeseries - Whether to include time series data in the result.
 * @returns A promise that resolves to the processed results.
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
  proposal: Selectable<Proposal>,
  withVotes: boolean,
  withTimeseries: boolean
): Promise<ProcessedResults> {
  const choiceColors = choices.map((choice) => getColorForChoice(choice));

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
          const normalizedWeight = (weight / totalWeight) * 100; // Normalize to percentage

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
      const choiceIndex = typeof vote.choice === 'number' ? vote.choice - 1 : 0;
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
      const normalizedPower = (vote.votingPower * choice.weight) / 100;
      finalResults[choice.choiceIndex] =
        (finalResults[choice.choiceIndex] || 0) + normalizedPower;
    });
  });

  const processedProposal = {
    ...proposal,
    startAt: new Date(proposal.startAt),
    endAt: new Date(proposal.endAt),
    createdAt: new Date(proposal.createdAt),
  };

  return {
    proposal: processedProposal,
    choices,
    choiceColors,
    totalVotingPower: processedVotes.reduce(
      (sum, vote) => sum + vote.votingPower,
      0
    ),
    quorum: proposal.quorum ? Number(proposal.quorum) : null,
    quorumChoices: (proposal.metadata as ProposalMetadata).quorumChoices ?? [],
    voteType: 'weighted',
    votes: withVotes ? processedVotes : undefined,
    timeSeriesData: withTimeseries ? timeSeriesData : undefined,
    finalResults,
    totalDelegatedVp: getTotalDelegatedVp(proposal),
    hiddenVote: (proposal.metadata as ProposalMetadata).hiddenVote,
    scoresState: (proposal.metadata as ProposalMetadata).scoresState,
  };
}

/**
 * Process approval votes.
 * @param votes - The list of votes to process.
 * @param choices - The list of possible choices for the proposal.
 * @param proposal - The proposal object.
 * @param withVotes - Whether to include processed votes in the result.
 * @param withTimeseries - Whether to include time series data in the result.
 * @returns A promise that resolves to the processed results.
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
  proposal: Selectable<Proposal>,
  withVotes: boolean,
  withTimeseries: boolean
): Promise<ProcessedResults> {
  const choiceColors = choices.map((choice) => getColorForChoice(choice));

  const processedVotes: ProcessedVote[] = [];

  votes.forEach((vote) => {
    // Convert the choice to an array if it's not already
    const approvedChoices = Array.isArray(vote.choice)
      ? (vote.choice as number[])
      : [vote.choice as number];

    // Create a choice entry for each approved choice
    // In approval voting, each choice gets 100% of the weight
    const processedChoice = approvedChoices.map((choice) => {
      const choiceIndex = typeof choice === 'number' ? choice - 1 : 0; // Convert to 0-based index
      return {
        choiceIndex,
        weight: 100, // Each choice gets 100% of voting power in approval voting
        text: choices[choiceIndex] || 'Unknown Choice',
        color: choiceColors[choiceIndex] || DEFAULT_CHOICE_COLOR,
      };
    });

    processedVotes.push({
      ...vote,
      choice: processedChoice,
      createdAt: new Date(vote.createdAt),
    });
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
      finalResults[choice.choiceIndex] =
        (finalResults[choice.choiceIndex] || 0) + vote.votingPower;
    });
  });

  const processedProposal = {
    ...proposal,
    startAt: new Date(proposal.startAt),
    endAt: new Date(proposal.endAt),
    createdAt: new Date(proposal.createdAt),
  };

  return {
    proposal: processedProposal,
    choices,
    choiceColors,
    totalVotingPower: processedVotes.reduce(
      (sum, vote) => sum + vote.votingPower,
      0
    ),
    quorum: proposal.quorum ? Number(proposal.quorum) : null,
    quorumChoices: (proposal.metadata as ProposalMetadata).quorumChoices ?? [],
    voteType: 'approval',
    votes: withVotes ? processedVotes : undefined,
    timeSeriesData: withTimeseries ? timeSeriesData : undefined,
    finalResults,
    totalDelegatedVp: getTotalDelegatedVp(proposal),
    hiddenVote: (proposal.metadata as ProposalMetadata).hiddenVote,
    scoresState: (proposal.metadata as ProposalMetadata).scoresState,
  };
}

/**
 * Process ranked-choice votes using the Instant Runoff Voting (IRV) method.
 * @param votes - The list of votes to process.
 * @param choices - The list of possible choices for the proposal.
 * @param proposal - The proposal object.
 * @param withVotes - Whether to include processed votes in the result.
 * @param withTimeseries - Whether to include time series data in the result.
 * @returns A promise that resolves to the processed results.
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
  proposal: Selectable<Proposal>,
  withVotes: boolean,
  withTimeseries: boolean
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
      votes: withVotes ? [] : undefined,
      timeSeriesData: withTimeseries ? [] : undefined,
      finalResults: {},
      totalDelegatedVp: getTotalDelegatedVp(proposal),
      hiddenVote: (proposal.metadata as ProposalMetadata).hiddenVote,
      scoresState: (proposal.metadata as ProposalMetadata).scoresState,
    };
  }

  // Process votes
  const processedVotes: ProcessedVote[] = votes.map((vote) => {
    const rankChoices = Array.isArray(vote.choice)
      ? (vote.choice as number[])
      : [vote.choice as number];

    // Convert to the new format
    const processedChoice = rankChoices.map((choice, rankIndex) => {
      const choiceIndex = typeof choice === 'number' ? choice - 1 : 0; // Convert to 0-based index
      return {
        choiceIndex,
        weight: 100, // Each ranked choice gets 100% of the voting power (but is applied in order)
        text: choices[choiceIndex] || 'Unknown Choice',
        color: choiceColors[choiceIndex] || DEFAULT_CHOICE_COLOR,
      };
    });

    return {
      ...vote,
      choice: processedChoice,
      createdAt: new Date(vote.createdAt),
    };
  });

  // Create a promise-based chunked IRV calculation
  const calculateIRV = async (
    currentVotes: ProcessedVote[]
  ): Promise<{
    winner: number | undefined;
    finalVoteCounts: Map<number, number>;
    eliminatedChoices: Set<number>;
  }> => {
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
            // Find the first non-eliminated choice in the ranking
            const validChoice = vote.choice.find(
              (choice) => !eliminatedChoices.has(choice.choiceIndex)
            );

            if (validChoice) {
              const currentCount = voteCounts.get(validChoice.choiceIndex) || 0;
              voteCounts.set(
                validChoice.choiceIndex,
                currentCount + vote.votingPower
              );
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

  let timeSeriesData: TimeSeriesPoint[] = [];
  if (withTimeseries) {
    const timeSeriesMap = new Map<string, TimeSeriesPoint>();
    const runningVotes: ProcessedVote[] = [];
    let accumulatedVotingPower = 0;
    let lastAccumulatedTimestamp: number | null = null;

    for (const vote of processedVotes) {
      runningVotes.push(vote);
      accumulatedVotingPower += vote.votingPower;
      lastAccumulatedTimestamp = vote.createdAt.getTime();

      if (accumulatedVotingPower >= ACCUMULATE_VOTING_POWER_THRESHOLD) {
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

        timeSeriesMap.set(timestampKey, {
          timestamp: new Date(lastAccumulatedTimestamp),
          values,
        });

        // Reset accumulation
        accumulatedVotingPower = 0;
      }
    }

    // One final round with all votes
    const { finalVoteCounts, eliminatedChoices } =
      await calculateIRV(processedVotes);

    const timestampKey = format(
      toZonedTime(
        new Date(processedVotes[processedVotes.length - 1]?.createdAt),
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

    timeSeriesMap.set(timestampKey, {
      timestamp: new Date(processedVotes[processedVotes.length - 1]?.createdAt),
      values,
    });
    timeSeriesData = Array.from(timeSeriesMap.values());
  }

  const totalVotingPower = processedVotes.reduce(
    (sum, vote) => sum + vote.votingPower,
    0
  );

  // Convert final vote counts to a plain object
  let finalResults: { [choice: number]: number } = {};
  if (withTimeseries && timeSeriesData?.length > 0) {
    const latestPoint = timeSeriesData[timeSeriesData.length - 1];
    finalResults = latestPoint.values;
  } else {
    // If we don't have time series data, calculate the final results directly
    choices.forEach((_, index) => {
      finalResults[index] = 0;
    });

    const { finalVoteCounts } = await calculateIRV(processedVotes);
    finalVoteCounts.forEach((count, choice) => {
      finalResults[choice] = count;
    });
  }

  const processedProposal = {
    ...proposal,
    startAt: new Date(proposal.startAt),
    endAt: new Date(proposal.endAt),
    createdAt: new Date(proposal.createdAt),
  };

  return {
    proposal: processedProposal,
    choices,
    choiceColors,
    totalVotingPower,
    quorum: proposal.quorum ? Number(proposal.quorum) : null,
    quorumChoices: (proposal.metadata as ProposalMetadata).quorumChoices ?? [],
    voteType: 'ranked-choice',
    votes: withVotes ? processedVotes : undefined,
    timeSeriesData: withTimeseries ? timeSeriesData : undefined,
    finalResults,
    totalDelegatedVp: getTotalDelegatedVp(proposal),
    hiddenVote: (proposal.metadata as ProposalMetadata).hiddenVote,
    scoresState: (proposal.metadata as ProposalMetadata).scoresState,
  };
}

/**
 * Process quadratic votes.
 * @param votes - The list of votes to process.
 * @param choices - The list of possible choices for the proposal.
 * @param proposal - The proposal object.
 * @param withVotes - Whether to include processed votes in the result.
 * @param withTimeseries - Whether to include time series data in the result.
 * @returns A promise that resolves to the processed results.
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
  proposal: Selectable<Proposal>,
  withVotes: boolean,
  withTimeseries: boolean
): Promise<ProcessedResults> {
  const choiceColors = choices.map((choice) => getColorForChoice(choice));

  // For quadratic voting, we use a simplified model where each vote's power is the square root
  // of the voting power used, but we return the full power in the results
  const processedVotes: ProcessedVote[] = votes.map((vote) => {
    const choiceIndex = typeof vote.choice === 'number' ? vote.choice : 0;
    return {
      ...vote,
      choice: [
        {
          choiceIndex,
          weight: 100, // 100% of the voting power goes to this choice
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
      // Calculate quadratic voting power - square root of the voting power
      const quadraticPower = Math.sqrt(vote.votingPower);

      if (quadraticPower >= ACCUMULATE_VOTING_POWER_THRESHOLD) {
        // Create a new time series point for this vote
        timeSeriesData.push({
          timestamp: vote.createdAt,
          values: { [choice]: quadraticPower },
        });
      } else {
        // Accumulate voting power for this choice
        accumulatedVotingPower[choice] += quadraticPower;
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
    // Use quadratic voting formula: power = sqrt(tokens)
    const quadraticPower = Math.sqrt(vote.votingPower);
    finalResults[vote.choice[0].choiceIndex] =
      (finalResults[vote.choice[0].choiceIndex] || 0) + quadraticPower;
  });

  const processedProposal = {
    ...proposal,
    startAt: new Date(proposal.startAt),
    endAt: new Date(proposal.endAt),
    createdAt: new Date(proposal.createdAt),
  };

  return {
    proposal: processedProposal,
    choices,
    choiceColors,
    totalVotingPower: processedVotes.reduce(
      (sum, vote) => sum + vote.votingPower,
      0
    ),
    quorum: proposal.quorum ? Number(proposal.quorum) : null,
    quorumChoices: (proposal.metadata as ProposalMetadata).quorumChoices ?? [],
    voteType: 'quadratic',
    votes: withVotes ? processedVotes : undefined,
    timeSeriesData: withTimeseries ? timeSeriesData : undefined,
    finalResults,
    totalDelegatedVp: getTotalDelegatedVp(proposal),
    hiddenVote: (proposal.metadata as ProposalMetadata).hiddenVote,
    scoresState: (proposal.metadata as ProposalMetadata).scoresState,
  };
}

export interface ProcessingConfig {
  withVotes?: boolean;
  withTimeseries?: boolean;
  aggregatedVotes?: boolean;
}

/**
 * Main function to process votes for a given proposal.
 * @param proposal - The proposal object to process results for.
 * @param votes - The list of votes associated with the proposal.
 * @param withVotes - Whether to include processed votes in the result. Defaults to true.
 * @param withTimeseries - Whether to include time series data in the result. Defaults to true.
 * @param aggregatedVotes - Whether to aggregate small votes between large ones. Defaults to false.
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
  }: ProcessingConfig
): Promise<ProcessedResults> {
  return otel('process-results', async () => {
    const choices = proposal.choices as string[];
    const metadata = proposal.metadata as ProposalMetadata;
    const voteType = metadata.voteType || 'basic';

    let result: ProcessedResults;

    switch (voteType) {
      case 'basic':
      case 'single-choice':
        result = await processBasicVotes(
          votes,
          choices,
          proposal,
          withVotes,
          withTimeseries
        );
        break;
      case 'weighted':
        result = await processWeightedVotes(
          votes,
          choices,
          proposal,
          withVotes,
          withTimeseries
        );
        break;
      case 'approval':
        result = await processApprovalVotes(
          votes,
          choices,
          proposal,
          withVotes,
          withTimeseries
        );
        break;
      case 'ranked-choice':
        result = await processRankedChoiceVotes(
          votes,
          choices,
          proposal,
          withVotes,
          withTimeseries
        );
        break;
      case 'quadratic':
        result = await processQuadraticVotes(
          votes,
          choices,
          proposal,
          withVotes,
          withTimeseries
        );
        break;
      default:
        result = await processBasicVotes(
          votes,
          choices,
          proposal,
          withVotes,
          withTimeseries
        );
        break;
    }

    if (withVotes && aggregatedVotes && result.votes) {
      const aggregatedResults: ProcessedVote[] = [];
      let currentAggregation: { [choice: number]: number } = {};
      let inAggregationWindow = false;

      // Sort votes by timestamp
      const sortedVotes = [...result.votes].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );

      for (let i = 0; i < sortedVotes.length; i++) {
        // Using proper type declaration and separate variable to avoid self-reference error
        const voteItem: ProcessedVote = sortedVotes[i];

        if (voteItem.votingPower > ACCUMULATE_VOTING_POWER_THRESHOLD) {
          // If we encounter a large vote, end the current aggregation window
          if (inAggregationWindow) {
            for (const choice in currentAggregation) {
              const choiceIndex = Number(choice);
              const choiceText = choices[choiceIndex] || 'Unknown Choice';
              const choiceColor =
                result.choiceColors[choiceIndex] || DEFAULT_CHOICE_COLOR;

              aggregatedResults.push({
                proposalId: voteItem.proposalId,
                reason: 'Aggregated votes',
                votingPower: currentAggregation[choiceIndex],
                aggregate: true,
                createdAt: voteItem.createdAt, // Use the timestamp of the last large vote
                choice: [
                  {
                    choiceIndex,
                    weight: 100,
                    text: choiceText,
                    color: choiceColor,
                  },
                ],
                voterAddress: 'aggregated', // Mark as aggregated
                id: `aggregated-${voteItem.id}-${choiceIndex}`,
              });
            }
            inAggregationWindow = false;
            currentAggregation = {};
          }
          aggregatedResults.push({
            ...voteItem,
            aggregate: false,
          });
        } else {
          // Aggregate small votes between large ones
          inAggregationWindow = true;

          // Check if vote has choice array and it's not empty
          if (voteItem.choice && voteItem.choice.length > 0) {
            // Handle weighted votes by distributing the voting power according to weights
            voteItem.choice.forEach((choiceItem) => {
              if (choiceItem && typeof choiceItem.choiceIndex === 'number') {
                const choiceIndex = choiceItem.choiceIndex;
                // Calculate the proportional voting power based on weight
                const proportionalVotingPower =
                  (voteItem.votingPower * choiceItem.weight) / 100;

                if (!currentAggregation[choiceIndex]) {
                  currentAggregation[choiceIndex] = 0;
                }
                currentAggregation[choiceIndex] += proportionalVotingPower;
              }
            });
          } else {
            // Fallback for votes with missing or empty choice array
            // console.warn(
            //   `Vote ${voteItem.id} has no valid choices, skipping aggregation. ${JSON.stringify(voteItem)}`
            // );
          }
        }
      }

      // Handle any remaining aggregated votes at the end of the list
      if (inAggregationWindow && sortedVotes.length > 0) {
        for (const choice in currentAggregation) {
          const choiceIndex = Number(choice);
          const choiceText = choices[choiceIndex] || 'Unknown Choice';
          const choiceColor =
            result.choiceColors[choiceIndex] || DEFAULT_CHOICE_COLOR;

          const lastVote = sortedVotes[sortedVotes.length - 1];
          aggregatedResults.push({
            proposalId: lastVote.proposalId,
            reason: 'Aggregated votes',
            votingPower: currentAggregation[choiceIndex],
            aggregate: true,
            createdAt: lastVote.createdAt, // Use the timestamp of the last vote
            choice: [
              {
                choiceIndex,
                weight: 100,
                text: choiceText,
                color: choiceColor,
              },
            ],
            voterAddress: 'aggregated', // Mark as aggregated
            id: `aggregated-final-${choiceIndex}`,
          });
        }
      }

      result.votes = aggregatedResults;
    }

    // Update relativeVotingPower based on the maximum individual vote power
    if (result.votes) {
      // Find the maximum individual vote power for calculating relative voting power
      const maxIndividualVotingPower = Math.max(
        ...result.votes.map((vote) => vote.votingPower),
        0
      );

      result.votes.forEach((vote) => {
        vote.relativeVotingPower =
          maxIndividualVotingPower > 0
            ? vote.votingPower / maxIndividualVotingPower
            : 0;
      });
    }

    // Check if hiddenVote is true and scoresState is not "final"
    if (metadata.hiddenVote && metadata.scoresState !== 'final') {
      // Aggregate all voting power under choice -1
      result.timeSeriesData = result.timeSeriesData?.map((point) => {
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

    // Ensure proposal dates are Date objects
    result.proposal = {
      ...result.proposal,
      startAt: new Date(result.proposal.startAt),
      endAt: new Date(result.proposal.endAt),
      createdAt: new Date(result.proposal.createdAt),
    };

    // Ensure timeSeriesData timestamps are Date objects
    if (result.timeSeriesData) {
      result.timeSeriesData = result.timeSeriesData.map((point) => ({
        ...point,
        timestamp: new Date(point.timestamp),
      }));
    }

    return result;
  });
}
