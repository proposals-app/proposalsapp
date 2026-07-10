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

export interface ProcessedVote extends Pick<
  Selectable<Vote>,
  'createdAt' | 'proposalId' | 'reason' | 'voterAddress' | 'votingPower' | 'id'
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

type VoteInput = Pick<
  Selectable<Vote>,
  | 'choice'
  | 'createdAt'
  | 'proposalId'
  | 'reason'
  | 'voterAddress'
  | 'votingPower'
  | 'id'
>;

function isValidChoiceIndex(choiceIndex: number, choiceCount: number): boolean {
  return (
    Number.isInteger(choiceIndex) &&
    choiceIndex >= 0 &&
    choiceIndex < choiceCount
  );
}

function createEmptyResults(choiceCount: number): Record<number, number> {
  return Object.fromEntries(
    Array.from({ length: choiceCount }, (_, index) => [index, 0])
  );
}

function calculateFinalResults(
  processedVotes: ProcessedVote[],
  choiceCount: number,
  contribution: (vote: ProcessedVote, weight: number) => number = (
    vote,
    weight
  ) => (vote.votingPower * weight) / 100
): Record<number, number> {
  const finalResults = createEmptyResults(choiceCount);

  for (const vote of processedVotes) {
    for (const choice of vote.choice) {
      if (isValidChoiceIndex(choice.choiceIndex, choiceCount)) {
        finalResults[choice.choiceIndex] += contribution(vote, choice.weight);
      }
    }
  }

  return finalResults;
}

function buildTimeSeries(
  processedVotes: ProcessedVote[],
  choiceCount: number,
  threshold = ACCUMULATE_VOTING_POWER_THRESHOLD,
  contribution: (vote: ProcessedVote, weight: number) => number = (
    vote,
    weight
  ) => (vote.votingPower * weight) / 100
): TimeSeriesPoint[] {
  const points: TimeSeriesPoint[] = [];
  const accumulated = createEmptyResults(choiceCount);
  let lastAccumulatedTimestamp: Date | null = null;

  const sortedVotes = [...processedVotes].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  for (const vote of sortedVotes) {
    for (const choice of vote.choice) {
      if (!isValidChoiceIndex(choice.choiceIndex, choiceCount)) continue;

      const power = contribution(vote, choice.weight);
      if (!Number.isFinite(power) || power <= 0) continue;

      if (power >= threshold) {
        points.push({
          timestamp: vote.createdAt,
          values: { [choice.choiceIndex]: power },
        });
        continue;
      }

      accumulated[choice.choiceIndex] += power;
      lastAccumulatedTimestamp = vote.createdAt;
      if (accumulated[choice.choiceIndex] >= threshold) {
        points.push({
          timestamp: vote.createdAt,
          values: {
            [choice.choiceIndex]: accumulated[choice.choiceIndex],
          },
        });
        accumulated[choice.choiceIndex] = 0;
      }
    }
  }

  if (lastAccumulatedTimestamp) {
    const remainingValues = Object.fromEntries(
      Object.entries(accumulated).filter(([, power]) => power > 0)
    ) as Record<number, number>;
    if (Object.keys(remainingValues).length > 0) {
      points.push({
        timestamp: lastAccumulatedTimestamp,
        values: remainingValues,
      });
    }
  }

  return points;
}

function sumVotingPower(processedVotes: ProcessedVote[]): number {
  return processedVotes.reduce((sum, vote) => sum + vote.votingPower, 0);
}

/**
 * Process basic (single-choice) votes.
 * @param votes - The list of votes to process.
 * @param choices - The list of possible choices for the proposal.
 * @param choiceColors - The array of choice colors.
 * @param withTimeseries - Whether to include time series data in the result.
 * @returns An object containing the processed votes, final results, time series data, and total voting power.
 */
function processBasicVotes(
  votes: VoteInput[],
  choices: string[],
  choiceColors: string[],
  withTimeseries: boolean
): IntermediateProcessingResult {
  const processedVotes: ProcessedVote[] = votes.flatMap((vote) => {
    // Numeric choices are normalized to zero-based indices during ingestion.
    const choiceIndex = typeof vote.choice === 'number' ? vote.choice : -1;
    if (!isValidChoiceIndex(choiceIndex, choices.length)) return [];

    return [
      {
        ...vote,
        choice: [
          {
            choiceIndex,
            weight: 100,
            text: choices[choiceIndex],
            color: choiceColors[choiceIndex] || DEFAULT_CHOICE_COLOR,
          },
        ],
        createdAt: new Date(vote.createdAt),
      },
    ];
  });

  return {
    processedVotes,
    finalResults: calculateFinalResults(processedVotes, choices.length),
    timeSeriesData: withTimeseries
      ? buildTimeSeries(processedVotes, choices.length)
      : undefined,
    totalVotingPower: sumVotingPower(processedVotes),
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
function processWeightedVotes(
  votes: VoteInput[],
  choices: string[],
  choiceColors: string[],
  withTimeseries: boolean
): IntermediateProcessingResult {
  const processedVotes: ProcessedVote[] = votes.flatMap((vote) => {
    if (
      typeof vote.choice !== 'object' ||
      vote.choice === null ||
      Array.isArray(vote.choice)
    ) {
      return [];
    }

    const allocations = Object.entries(
      vote.choice as Record<string, unknown>
    ).map(([rawIndex, rawWeight]) => ({
      choiceIndex: Number(rawIndex) - 1,
      weight: rawWeight,
    }));

    const isValid =
      allocations.length > 0 &&
      allocations.every(
        ({ choiceIndex, weight }) =>
          isValidChoiceIndex(choiceIndex, choices.length) &&
          typeof weight === 'number' &&
          Number.isFinite(weight) &&
          weight >= 0
      ) &&
      allocations.some(({ weight }) => Number(weight) > 0);
    if (!isValid) return [];

    const totalWeight = allocations.reduce(
      (sum, { weight }) => sum + Number(weight),
      0
    );
    const processedChoice = allocations.map(({ choiceIndex, weight }) => ({
      choiceIndex,
      weight: (Number(weight) / totalWeight) * 100,
      text: choices[choiceIndex],
      color: choiceColors[choiceIndex] || DEFAULT_CHOICE_COLOR,
    }));

    return [
      {
        ...vote,
        choice: processedChoice,
        createdAt: new Date(vote.createdAt),
      },
    ];
  });

  return {
    processedVotes,
    finalResults: calculateFinalResults(processedVotes, choices.length),
    timeSeriesData: withTimeseries
      ? buildTimeSeries(processedVotes, choices.length)
      : undefined,
    totalVotingPower: sumVotingPower(processedVotes),
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
function processApprovalVotes(
  votes: VoteInput[],
  choices: string[],
  choiceColors: string[],
  withTimeseries: boolean
): IntermediateProcessingResult {
  const processedVotes: ProcessedVote[] = votes.flatMap((vote) => {
    if (!Array.isArray(vote.choice) || vote.choice.length === 0) return [];

    const choiceIndices = vote.choice.map((choice) => Number(choice) - 1);
    if (
      choiceIndices.some(
        (choiceIndex) => !isValidChoiceIndex(choiceIndex, choices.length)
      ) ||
      new Set(choiceIndices).size !== choiceIndices.length
    ) {
      return [];
    }

    return [
      {
        ...vote,
        choice: choiceIndices.map((choiceIndex) => ({
          choiceIndex,
          weight: 100,
          text: choices[choiceIndex],
          color: choiceColors[choiceIndex] || DEFAULT_CHOICE_COLOR,
        })),
        createdAt: new Date(vote.createdAt),
      },
    ];
  });

  return {
    processedVotes,
    finalResults: calculateFinalResults(processedVotes, choices.length),
    timeSeriesData: withTimeseries
      ? buildTimeSeries(processedVotes, choices.length)
      : undefined,
    totalVotingPower: sumVotingPower(processedVotes),
  };
}

/** Snapshot-compatible instant-runoff calculation. */
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

  while (true) {
    const activeFirstChoices = currentVotes
      .map((vote) =>
        vote.choice.find(
          ({ choiceIndex }) =>
            isValidChoiceIndex(choiceIndex, choices.length) &&
            !eliminatedChoices.has(choiceIndex)
        )
      )
      .filter((choice): choice is ProcessedVote['choice'][number] => !!choice)
      .map(({ choiceIndex }) => choiceIndex);
    const activeCandidates = [...new Set(activeFirstChoices)];
    const currentRoundCounts = new Map(
      activeCandidates.map((choiceIndex) => [choiceIndex, 0])
    );

    for (const vote of currentVotes) {
      const activeChoice = vote.choice.find(
        ({ choiceIndex }) =>
          currentRoundCounts.has(choiceIndex) &&
          !eliminatedChoices.has(choiceIndex)
      );
      if (activeChoice) {
        currentRoundCounts.set(
          activeChoice.choiceIndex,
          (currentRoundCounts.get(activeChoice.choiceIndex) ?? 0) +
            vote.votingPower
        );
      }
    }

    roundVoteCounts = currentRoundCounts;
    if (roundVoteCounts.size === 0) break;

    const sortedCandidates = [...roundVoteCounts.entries()].sort(
      (a, b) => b[1] - a[1]
    );
    const totalVotesInRound = sortedCandidates.reduce(
      (sum, [, votingPower]) => sum + votingPower,
      0
    );
    const [topCandidate, topVotingPower] = sortedCandidates[0];
    winner = topCandidate;

    if (topVotingPower > totalVotesInRound / 2 || sortedCandidates.length < 3) {
      break;
    }

    // Snapshot eliminates one candidate per round. Ties are resolved by the
    // first candidate encountered in vote order, matching its stable reducer.
    const [bottomCandidate] = [...roundVoteCounts.entries()].reduce(
      (lowest, candidate) => (candidate[1] < lowest[1] ? candidate : lowest)
    );
    eliminatedChoices.add(bottomCandidate);
  }

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
function processRankedChoiceVotes(
  votes: VoteInput[],
  choices: string[],
  choiceColors: string[],
  withTimeseries: boolean
): IntermediateProcessingResult {
  const numChoices = choices.length;

  // Process votes: Ensure choice indices are valid (0-based) and filter invalid ranks
  const processedVotes: ProcessedVote[] = votes
    .map((vote) => {
      const rankChoicesInput = Array.isArray(vote.choice) ? vote.choice : [];

      if (rankChoicesInput.length !== numChoices) return null;

      const uniqueValidChoices = new Set<number>(); // Ensure a choice isn't ranked multiple times

      const processedChoice = rankChoicesInput
        .map((choiceInput) => {
          const choiceIndex =
            typeof choiceInput === 'number' ? choiceInput - 1 : -1;

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
    .filter((v): v is ProcessedVote => v !== null)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  let timeSeriesData: TimeSeriesPoint[] = [];
  if (withTimeseries && processedVotes.length > 0) {
    const timeSeriesMap = new Map<string, TimeSeriesPoint>();
    const runningVotes: ProcessedVote[] = [];
    let accumulatedVotingPower = 0; // Track total VP added since last point

    // Sort votes chronologically
    const sortedVotes = [...processedVotes].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    for (const vote of sortedVotes) {
      runningVotes.push(vote);
      // Accumulate total VP, not just the individual vote's VP, to decide when to compute point
      accumulatedVotingPower += vote.votingPower;
      const lastProcessedTimestamp = vote.createdAt.getTime();

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
function calculateQuadraticResults(
  processedVotes: ProcessedVote[],
  choiceCount: number
): Record<number, number> {
  const squareRootSums = createEmptyResults(choiceCount);

  for (const vote of processedVotes) {
    for (const choice of vote.choice) {
      squareRootSums[choice.choiceIndex] += Math.sqrt(
        (choice.weight / 100) * vote.votingPower
      );
    }
  }

  const quadraticScores = Object.values(squareRootSums).map(
    (rootSum) => rootSum * rootSum
  );
  const quadraticTotal = quadraticScores.reduce((sum, score) => sum + score, 0);
  const totalVotingPower = sumVotingPower(processedVotes);

  return Object.fromEntries(
    quadraticScores.map((score, choiceIndex) => [
      choiceIndex,
      quadraticTotal > 0 ? (score / quadraticTotal) * totalVotingPower : 0,
    ])
  );
}

function buildQuadraticTimeSeries(
  processedVotes: ProcessedVote[],
  choiceCount: number
): TimeSeriesPoint[] {
  const sortedVotes = [...processedVotes].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );
  const runningVotes: ProcessedVote[] = [];
  const previousResults = createEmptyResults(choiceCount);
  const points: TimeSeriesPoint[] = [];
  let accumulatedVotingPower = 0;

  sortedVotes.forEach((vote, index) => {
    runningVotes.push(vote);
    accumulatedVotingPower += vote.votingPower;
    const isLastVote = index === sortedVotes.length - 1;

    if (
      accumulatedVotingPower < ACCUMULATE_VOTING_POWER_THRESHOLD &&
      !isLastVote
    ) {
      return;
    }

    const currentResults = calculateQuadraticResults(runningVotes, choiceCount);
    const values = Object.fromEntries(
      Object.entries(currentResults).map(([choiceIndex, value]) => [
        choiceIndex,
        value - previousResults[Number(choiceIndex)],
      ])
    ) as Record<number, number>;

    points.push({ timestamp: vote.createdAt, values });
    Object.assign(previousResults, currentResults);
    accumulatedVotingPower = 0;
  });

  return points;
}

function processQuadraticVotes(
  votes: VoteInput[],
  choices: string[],
  choiceColors: string[],
  withTimeseries: boolean
): IntermediateProcessingResult {
  const processedVotes: ProcessedVote[] = votes.flatMap((vote) => {
    if (
      typeof vote.choice !== 'object' ||
      vote.choice === null ||
      Array.isArray(vote.choice)
    ) {
      return [];
    }

    const allocations = Object.entries(
      vote.choice as Record<string, unknown>
    ).map(([rawIndex, rawAllocation]) => ({
      choiceIndex: Number(rawIndex) - 1,
      allocation: rawAllocation,
    }));
    const isValid =
      allocations.length > 0 &&
      allocations.every(
        ({ choiceIndex, allocation }) =>
          isValidChoiceIndex(choiceIndex, choices.length) &&
          typeof allocation === 'number' &&
          Number.isFinite(allocation) &&
          allocation >= 0
      ) &&
      allocations.some(({ allocation }) => Number(allocation) > 0);
    if (!isValid) return [];

    const totalAllocation = allocations.reduce(
      (sum, { allocation }) => sum + Number(allocation),
      0
    );

    return [
      {
        ...vote,
        choice: allocations.map(({ choiceIndex, allocation }) => ({
          choiceIndex,
          weight: (Number(allocation) / totalAllocation) * 100,
          text: choices[choiceIndex],
          color: choiceColors[choiceIndex] || DEFAULT_CHOICE_COLOR,
        })),
        createdAt: new Date(vote.createdAt),
      },
    ];
  });

  return {
    processedVotes,
    finalResults: calculateQuadraticResults(processedVotes, choices.length),
    timeSeriesData: withTimeseries
      ? buildQuadraticTimeSeries(processedVotes, choices.length)
      : undefined,
    totalVotingPower: sumVotingPower(processedVotes),
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
export function processResultsAction(
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
): ProcessedResults {
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
      intermediateResult = processBasicVotes(
        validVotes,
        choices,
        choiceColors, // Pass colors
        withTimeseries
      );
      break;
    case 'weighted':
      intermediateResult = processWeightedVotes(
        validVotes,
        choices,
        choiceColors, // Pass colors
        withTimeseries
      );
      break;
    case 'approval':
      intermediateResult = processApprovalVotes(
        validVotes,
        choices,
        choiceColors, // Pass colors
        withTimeseries
      );
      break;
    case 'ranked-choice':
      intermediateResult = processRankedChoiceVotes(
        validVotes,
        choices,
        choiceColors, // Pass colors
        withTimeseries
      );
      break;
    case 'quadratic':
      intermediateResult = processQuadraticVotes(
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
      intermediateResult = processBasicVotes(
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
