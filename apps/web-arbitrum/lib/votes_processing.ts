import { ProposalMetadata } from '@/app/types';
import { otel } from '@/lib/otel';
import { Proposal, Selectable, Vote } from '@proposalsapp/db';
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
    | 'choice'
    | 'createdAt'
    | 'proposalId'
    | 'reason'
    | 'voterAddress'
    | 'votingPower'
    | 'id'
  > {
  choice: number | number[];
  choiceText: string;
  color: string | string[];
  aggregate?: boolean;
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

/**
 * Function to get a color for a given choice.
 * @param choice - The choice text.
 * @returns A color code based on the choice text.
 */
export function getColorForChoice(choice: string | undefined | null): string {
  if (!choice) return '#CBD5E1'; // Default grey color
  const lowerCaseChoice = choice.toLowerCase();
  if (/^(for|yes|yae)/.test(lowerCaseChoice)) return '#56B200'; // Green
  if (/^(against|no|nay)/.test(lowerCaseChoice)) return '#FF4242'; // Red
  if (lowerCaseChoice === 'abstain') return '#FFBC1F'; // Yellow
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
    const choice = vote.choice as number;
    return {
      ...vote,
      choice,
      choiceText: choices[choice] || 'Unknown Choice',
      color: choiceColors[choice],
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
      const choice = vote.choice as number;

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
    finalResults[vote.choice as number] =
      (finalResults[vote.choice as number] || 0) + vote.votingPower;
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

  let processedVotes: ProcessedVote[] | undefined;
  if (withVotes) {
    processedVotes = [];
  }

  let timeSeriesData: TimeSeriesPoint[] | undefined;
  if (withTimeseries) {
    timeSeriesData = [];
  }

  const accumulatedVotingPower: { [choice: number]: number } = {};
  choices.forEach((_, index) => {
    accumulatedVotingPower[index] = 0;
  });

  let lastAccumulatedTimestamp: Date | null = null;

  // Sort votes by timestamp
  const sortedVotes = [...votes].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  sortedVotes.forEach((vote) => {
    const timestamp = new Date(vote.createdAt);

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

      const colorList = Object.entries(weightedChoices).map(([choiceIndex]) => {
        const choice = parseInt(choiceIndex) - 1; // Convert to 0-based index
        return choiceColors[choice];
      });

      if (withVotes) {
        processedVotes?.push({
          ...vote,
          choice: -1,
          choiceText: combinedChoiceName,
          color: colorList,
        });
      }

      // Process each choice in the weighted vote
      Object.entries(weightedChoices).forEach(([choiceIndex, weight]) => {
        const choice = parseInt(choiceIndex) - 1; // Convert to 0-based index
        const normalizedPower =
          (Number(vote.votingPower) * weight) / totalWeight;

        // Accumulate voting power for each choice
        accumulatedVotingPower[choice] += normalizedPower;
      });

      // Check if any accumulated voting power exceeds the threshold
      const shouldCreateTimeSeriesPoint = Object.values(
        accumulatedVotingPower
      ).some((power) => power >= ACCUMULATE_VOTING_POWER_THRESHOLD);

      if (shouldCreateTimeSeriesPoint && withTimeseries) {
        // Create a new time series point for the accumulated votes
        const values: { [choice: number]: number } = {};
        choices.forEach((_, index) => {
          values[index] = accumulatedVotingPower[index];
        });

        timeSeriesData?.push({
          timestamp: timestamp,
          values,
        });

        // Reset accumulation for all choices
        choices.forEach((_, index) => {
          accumulatedVotingPower[index] = 0;
        });
      }

      lastAccumulatedTimestamp = timestamp;
    } else {
      // Handle non-weighted votes (fallback to basic processing)
      const choice = (vote.choice as number) - 1; // Convert to 0-based index

      if (withVotes) {
        processedVotes?.push({
          ...vote,
          choice,
          choiceText: choices[choice] || 'Unknown Choice',
          color: choiceColors[choice],
        });
      }

      if (
        Number(vote.votingPower) >= ACCUMULATE_VOTING_POWER_THRESHOLD &&
        withTimeseries
      ) {
        // Create a new time series point for this vote
        timeSeriesData?.push({
          timestamp: timestamp,
          values: { [choice]: Number(vote.votingPower) },
        });
      } else {
        // Accumulate voting power
        accumulatedVotingPower[choice] += Number(vote.votingPower);
        lastAccumulatedTimestamp = timestamp;

        if (
          accumulatedVotingPower[choice] >= ACCUMULATE_VOTING_POWER_THRESHOLD &&
          withTimeseries
        ) {
          // Create a new time series point for the accumulated votes
          timeSeriesData?.push({
            timestamp: lastAccumulatedTimestamp,
            values: { [choice]: accumulatedVotingPower[choice] },
          });

          accumulatedVotingPower[choice] = 0; // Reset accumulation
        }
      }
    }
  });

  // If there's any remaining accumulated voting power, add it to the last timestamp
  if (lastAccumulatedTimestamp && withTimeseries) {
    const values: { [choice: number]: number } = {};
    let hasRemainingPower = false;

    choices.forEach((_, index) => {
      if (accumulatedVotingPower[index] > 0) {
        hasRemainingPower = true;
      }
      values[index] = accumulatedVotingPower[index];
    });

    if (hasRemainingPower) {
      timeSeriesData?.push({
        timestamp: lastAccumulatedTimestamp,
        values,
      });
    }

    // Reset the accumulated voting power after pushing the remaining values
    choices.forEach((_, index) => {
      accumulatedVotingPower[index] = 0;
    });
  }

  // Calculate final results
  const finalResults: { [choice: number]: number } = {};
  choices.forEach((_, index) => {
    finalResults[index] = 0;
  });

  (processedVotes ?? votes).forEach((vote) => {
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
      finalResults[vote.choice as number] =
        (finalResults[vote.choice as number] || 0) + vote.votingPower;
    }
  });

  return {
    proposal,
    choices,
    choiceColors,
    totalVotingPower: (processedVotes ?? votes).reduce(
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

  let processedVotes: ProcessedVote[] | undefined;
  if (withVotes) {
    processedVotes = [];
  }

  let timeSeriesData: TimeSeriesPoint[] | undefined;
  if (withTimeseries) {
    timeSeriesData = [];
  }

  const accumulatedVotingPower: { [choice: number]: number } = {};
  choices.forEach((_, index) => {
    accumulatedVotingPower[index] = 0;
  });

  let lastAccumulatedTimestamp: Date | null = null;

  // Sort votes by timestamp
  const sortedVotes = [...votes].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  sortedVotes.forEach((vote) => {
    const approvedChoices = Array.isArray(vote.choice)
      ? (vote.choice as number[])
      : [vote.choice as number];
    const timestamp = new Date(vote.createdAt);

    // Create a single processed vote with all choices
    const choiceText = approvedChoices
      .map((choice) => choices[choice - 1] || 'Unknown Choice')
      .join(', ');
    const colorList = approvedChoices.map((choice) => choiceColors[choice - 1]);

    if (withVotes) {
      processedVotes?.push({
        ...vote,
        choice: approvedChoices[0], // Use the first choice as the primary choice
        choiceText, // Include all choices in the choiceText
        color: colorList,
      });
    }

    // Accumulate voting power for each choice
    approvedChoices.forEach((choice) => {
      const choiceIndex = choice - 1; // Convert to 0-based index
      accumulatedVotingPower[choiceIndex] += Number(vote.votingPower);
      lastAccumulatedTimestamp = timestamp;

      if (
        accumulatedVotingPower[choiceIndex] >=
          ACCUMULATE_VOTING_POWER_THRESHOLD &&
        withTimeseries
      ) {
        // Create a new time series point for the accumulated votes
        const values: { [choice: number]: number } = {};
        choices.forEach((_, index) => {
          values[index] = accumulatedVotingPower[index];
        });

        timeSeriesData?.push({
          timestamp: lastAccumulatedTimestamp,
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
  if (lastAccumulatedTimestamp && withTimeseries) {
    const values: { [choice: number]: number } = {};
    choices.forEach((_, index) => {
      values[index] = accumulatedVotingPower[index];
    });

    timeSeriesData?.push({
      timestamp: lastAccumulatedTimestamp,
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
      finalResults[choiceIndex] += vote.votingPower;
    });
  });

  return {
    proposal,
    choices,
    choiceColors,
    totalVotingPower: (processedVotes ?? votes).reduce(
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

  // Pre-process votes
  const processedVotes = withVotes
    ? votes
        .filter((vote) => vote.createdAt && Array.isArray(vote.choice))
        .map((vote) => ({
          ...vote,
          choice: (vote.choice as number[]).map((c) => c - 1),
          choiceText: (vote.choice as number[])
            .map((c) => choices[c - 1] || 'Unknown Choice')
            .join(', '),
          color: (vote.choice as number[]).map((c) => choiceColors[c]),
        }))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    : undefined;

  // Create a promise-based chunked IRV calculation
  const calculateIRV = async (
    currentVotes: typeof processedVotes
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
          currentVotes?.forEach((vote) => {
            if (Array.isArray(vote.choice)) {
              const validChoice = vote.choice.find(
                (choice) => !eliminatedChoices.has(choice)
              );
              if (validChoice !== undefined) {
                const currentCount = voteCounts.get(validChoice) || 0;
                voteCounts.set(validChoice, currentCount + vote.votingPower);
                totalVotes += vote.votingPower;
              }
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
    const runningVotes: typeof processedVotes = [];
    let accumulatedVotingPower = 0;
    let lastAccumulatedTimestamp: number | null = null;

    for (const vote of processedVotes ?? []) {
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
        new Date(processedVotes![processedVotes!.length - 1]?.createdAt),
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
      timestamp: new Date(
        processedVotes![processedVotes!.length - 1]?.createdAt
      ),
      values,
    });
    timeSeriesData = Array.from(timeSeriesMap.values());
  }

  const totalVotingPower = processedVotes
    ? processedVotes.reduce((sum, vote) => sum + vote.votingPower, 0)
    : votes.reduce((sum, vote) => sum + vote.votingPower, 0);

  // Convert final vote counts to a plain object
  let finalResults: { [choice: number]: number } = {};
  if (withTimeseries && timeSeriesData?.length > 0) {
    const latestPoint = timeSeriesData[timeSeriesData.length - 1];
    finalResults = latestPoint.values;
  } else {
    choices.forEach((_, index) => {
      finalResults[index] = 0;
    });
    votes.forEach((vote) => {
      if (Array.isArray(vote.choice)) {
        const firstChoice = vote.choice[0] as number;
        finalResults[firstChoice - 1] += vote.votingPower;
      }
    });
  }

  return {
    proposal,
    choices,
    choiceColors,
    totalVotingPower,
    quorum: proposal.quorum ? Number(proposal.quorum) : null,
    quorumChoices: (proposal.metadata as ProposalMetadata).quorumChoices ?? [],
    voteType: 'ranked-choice',
    votes: withVotes
      ? processedVotes?.map((vote) => ({
          ...vote,
          choice: Array.isArray(vote.choice) ? vote.choice[0] : vote.choice,
          choiceText: vote.choiceText,
        }))
      : undefined,
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
  // Temporary fallback to basic processing
  const result = await processBasicVotes(
    votes,
    choices,
    proposal,
    withVotes,
    withTimeseries
  );

  return {
    ...result,
    voteType: 'quadratic',
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
  'use server';
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

      result.votes.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );

      for (let i = 0; i < result.votes.length || 0; i++) {
        const vote = result.votes![i];
        if (vote.votingPower > ACCUMULATE_VOTING_POWER_THRESHOLD) {
          // If we encounter a large vote, end the current aggregation window
          if (inAggregationWindow) {
            for (const choice in currentAggregation) {
              aggregatedResults.push({
                ...vote,
                reason: 'Aggregated votes',
                votingPower: currentAggregation[choice],
                aggregate: true,
                createdAt: vote.createdAt, // Use the timestamp of the last large vote
                choice: Number(choice),
              });
            }
            inAggregationWindow = false;
            currentAggregation = {};
          }
          aggregatedResults.push({
            ...vote,
            aggregate: false,
          });
        } else {
          // Aggregate small votes between large ones
          inAggregationWindow = true;
          if (!currentAggregation[vote.choice as number]) {
            currentAggregation[vote.choice as number] = 0;
          }
          currentAggregation[vote.choice as number] += vote.votingPower;
        }
      }

      // Handle any remaining aggregated votes at the end of the list
      if (inAggregationWindow) {
        for (const choice in currentAggregation) {
          const lastVote = result.votes![result.votes!.length - 1];
          aggregatedResults.push({
            ...lastVote, // Use last large vote's timestamp or another reference point
            reason: 'Aggregated votes',
            votingPower: currentAggregation[choice],
            aggregate: true,
            createdAt: lastVote.createdAt, // Use the timestamp of the last large vote
            choice: Number(choice),
          });
        }
      }

      result.votes = aggregatedResults;
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

    return result;
  });
}
