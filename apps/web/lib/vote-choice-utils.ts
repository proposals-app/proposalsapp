/**
 * Shared utilities for vote choice handling across the platform
 * Handles conversion, validation, formatting, and processing of vote choices
 */

import type { VoteType } from '@/lib/results_processing';

// OpenZeppelin Governor standard support mapping
export const ONCHAIN_SUPPORT_MAPPING: { [key: string]: number } = {
  For: 1,
  Against: 0,
  Abstain: 2,
};

// Choice validation and conversion utilities

/**
 * Converts 1-based index to 0-based index
 * Used when converting from Snapshot (1-based) to internal processing (0-based)
 */
export function toZeroBasedIndex(oneBasedIndex: number): number {
  return oneBasedIndex - 1;
}

/**
 * Converts 0-based index to 1-based index
 * Used when converting from internal processing (0-based) to Snapshot (1-based)
 */
export function toOneBasedIndex(zeroBasedIndex: number): number {
  return zeroBasedIndex + 1;
}

/**
 * Converts array of 1-based indices to 0-based indices
 */
export function toZeroBasedIndices(oneBasedIndices: number[]): number[] {
  return oneBasedIndices.map(toZeroBasedIndex);
}

/**
 * Converts array of 0-based indices to 1-based indices
 */
export function toOneBasedIndices(zeroBasedIndices: number[]): number[] {
  return zeroBasedIndices.map(toOneBasedIndex);
}

/**
 * Validates a choice index against the number of available choices
 */
export function isValidChoiceIndex(
  choiceIndex: number,
  numChoices: number
): boolean {
  return choiceIndex >= 0 && choiceIndex < numChoices;
}

/**
 * Validates an array of choice indices
 */
export function areValidChoiceIndices(
  choiceIndices: number[],
  numChoices: number
): boolean {
  return choiceIndices.every((index) => isValidChoiceIndex(index, numChoices));
}

/**
 * Validates that choice indices are unique (no duplicates)
 */
export function areUniqueChoiceIndices(choiceIndices: number[]): boolean {
  const uniqueIndices = new Set(choiceIndices);
  return uniqueIndices.size === choiceIndices.length;
}

// Choice formatting utilities

const DEFAULT_CHOICE_COLOR = '#9CA3AF'; // Neutral grey

/**
 * Assigns colors to choices based on governance conventions
 * For/Yes = Green, Against/No = Red, Abstain = Yellow, others = hash-based
 */
export function getColorForChoice(choice: string | undefined | null): string {
  if (!choice) return DEFAULT_CHOICE_COLOR;

  const lowerCaseChoice = choice.toLowerCase();

  // Standard governance colors
  if (/^(for|yes|yae)/.test(lowerCaseChoice)) return '#69E000'; // Green
  if (/^(against|no|nay)/.test(lowerCaseChoice)) return '#FF4C42'; // Red
  if (lowerCaseChoice === 'abstain') return '#FFCC33'; // Yellow

  // Hash-based color for other choices
  let hash = 0;
  for (let i = 0; i < choice.length; i++) {
    hash = choice.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

/**
 * Formats choice text for display based on vote type
 */
export function formatChoiceText(
  choices: Array<{ text: string; weight?: number }>,
  voteType: VoteType
): string {
  if (!choices || choices.length === 0) return 'Unknown Choice';

  if (voteType === 'weighted') {
    // For weighted voting, include the weight percentage
    return choices
      .map((choice) => `${Math.round(choice.weight || 0)}% for ${choice.text}`)
      .join(', ');
  } else {
    // For other voting types, just show the choice text
    return choices.map((choice) => choice.text).join(', ');
  }
}

// Vote choice conversion utilities

/**
 * Processes a raw vote choice value into a standardized format
 * Handles different input types: number, string, array, object
 */
export function processVoteChoice(
  rawChoice: unknown,
  voteType: VoteType
): {
  choiceIndices: number[];
  weights?: Record<number, number>;
} {
  switch (voteType) {
    case 'basic':
    case 'single-choice': {
      // Single choice as number or string
      const singleIndex =
        typeof rawChoice === 'number'
          ? rawChoice
          : parseInt(String(rawChoice), 10);
      return {
        choiceIndices: isNaN(singleIndex)
          ? []
          : [toZeroBasedIndex(singleIndex)],
      };
    }

    case 'approval': {
      // Array of choice indices
      if (!Array.isArray(rawChoice)) return { choiceIndices: [] };
      const approvalIndices = rawChoice
        .map((choice) => {
          const index =
            typeof choice === 'number' ? choice : parseInt(String(choice), 10);
          return isNaN(index) ? null : toZeroBasedIndex(index);
        })
        .filter((index): index is number => index !== null);
      return { choiceIndices: approvalIndices };
    }

    case 'ranked-choice': {
      // Ordered array of choice indices
      if (!Array.isArray(rawChoice)) return { choiceIndices: [] };
      const rankedIndices = rawChoice
        .map((choice) => {
          const index =
            typeof choice === 'number' ? choice : parseInt(String(choice), 10);
          return isNaN(index) ? null : toZeroBasedIndex(index);
        })
        .filter((index): index is number => index !== null);
      return { choiceIndices: rankedIndices };
    }

    case 'weighted': {
      // Object with choice indices as keys and weights as values
      if (typeof rawChoice !== 'object' || rawChoice === null) {
        return { choiceIndices: [], weights: {} };
      }
      const weightedChoice = rawChoice as Record<string, number>;
      const choiceIndices: number[] = [];
      const weights: Record<number, number> = {};

      Object.entries(weightedChoice).forEach(([choiceKey, weight]) => {
        const oneBasedIndex = parseInt(choiceKey, 10);
        if (!isNaN(oneBasedIndex) && weight > 0) {
          const zeroBasedIndex = toZeroBasedIndex(oneBasedIndex);
          choiceIndices.push(zeroBasedIndex);
          weights[zeroBasedIndex] = weight;
        }
      });

      return { choiceIndices, weights };
    }

    case 'quadratic': {
      // Similar to weighted but with quadratic scaling
      if (typeof rawChoice !== 'object' || rawChoice === null) {
        return { choiceIndices: [], weights: {} };
      }
      const quadraticChoice = rawChoice as Record<string, number>;
      const quadraticIndices: number[] = [];
      const quadraticWeights: Record<number, number> = {};

      Object.entries(quadraticChoice).forEach(([choiceKey, allocation]) => {
        const oneBasedIndex = parseInt(choiceKey, 10);
        if (!isNaN(oneBasedIndex) && allocation > 0) {
          const zeroBasedIndex = toZeroBasedIndex(oneBasedIndex);
          quadraticIndices.push(zeroBasedIndex);
          // Quadratic weight is square of allocation
          quadraticWeights[zeroBasedIndex] = allocation * allocation;
        }
      });

      return { choiceIndices: quadraticIndices, weights: quadraticWeights };
    }

    default:
      return { choiceIndices: [] };
  }
}

/**
 * Checks if a vote includes a specific choice text
 */
export function voteIncludesChoiceText(
  voteChoices: Array<{ text: string }>,
  searchText: string
): boolean {
  if (!voteChoices || voteChoices.length === 0) return false;
  return voteChoices.some((choice) =>
    choice.text.toLowerCase().includes(searchText.toLowerCase())
  );
}

/**
 * Creates a choice payload for Snapshot voting
 * Converts from 0-based internal indices to 1-based Snapshot format
 */
export function createSnapshotChoicePayload(
  choiceIndices: number[],
  weights?: Record<number, number>,
  voteType: VoteType = 'basic'
): unknown {
  switch (voteType) {
    case 'basic':
    case 'single-choice': {
      // Single 1-based index
      return choiceIndices.length > 0 ? toOneBasedIndex(choiceIndices[0]) : 1;
    }

    case 'approval':
    case 'ranked-choice': {
      // Array of 1-based indices
      return toOneBasedIndices(choiceIndices);
    }

    case 'weighted':
    case 'quadratic': {
      // Object with 1-based indices as keys
      if (!weights) return {};
      const payload: Record<string, number> = {};
      choiceIndices.forEach((zeroBasedIndex) => {
        const oneBasedIndex = toOneBasedIndex(zeroBasedIndex);
        payload[oneBasedIndex.toString()] = weights[zeroBasedIndex] || 0;
      });
      return payload;
    }

    default:
      return choiceIndices.length > 0 ? toOneBasedIndex(choiceIndices[0]) : 1;
  }
}

/**
 * Creates an onchain vote support value
 * Converts choice to OpenZeppelin Governor support value (0=Against, 1=For, 2=Abstain)
 */
export function createOnchainSupportValue(choiceText: string): number {
  return ONCHAIN_SUPPORT_MAPPING[choiceText] ?? 1; // Default to For if not found
}

/**
 * Validates a vote choice against available choices and vote type constraints
 */
export function validateVoteChoice(
  rawChoice: unknown,
  availableChoices: string[],
  voteType: VoteType
): { isValid: boolean; error?: string } {
  const { choiceIndices, weights } = processVoteChoice(rawChoice, voteType);
  const numChoices = availableChoices.length;

  // Check if any choices were provided
  if (choiceIndices.length === 0) {
    return { isValid: false, error: 'No valid choices provided' };
  }

  // Validate choice indices are within bounds
  if (!areValidChoiceIndices(choiceIndices, numChoices)) {
    return { isValid: false, error: 'Choice index out of bounds' };
  }

  // Vote type specific validation
  switch (voteType) {
    case 'basic':
    case 'single-choice': {
      if (choiceIndices.length !== 1) {
        return {
          isValid: false,
          error: 'Basic vote must have exactly one choice',
        };
      }
      break;
    }

    case 'approval': {
      if (!areUniqueChoiceIndices(choiceIndices)) {
        return {
          isValid: false,
          error: 'Approval vote cannot have duplicate choices',
        };
      }
      break;
    }

    case 'ranked-choice': {
      if (!areUniqueChoiceIndices(choiceIndices)) {
        return {
          isValid: false,
          error: 'Ranked choice vote cannot have duplicate choices',
        };
      }
      break;
    }

    case 'weighted':
    case 'quadratic': {
      if (!weights) {
        return {
          isValid: false,
          error: 'Weighted vote must have weight values',
        };
      }
      const totalWeight = Object.values(weights).reduce(
        (sum, weight) => sum + weight,
        0
      );
      if (totalWeight <= 0) {
        return { isValid: false, error: 'Total weight must be greater than 0' };
      }
      if (voteType === 'weighted' && Math.abs(totalWeight - 100) > 0.01) {
        return { isValid: false, error: 'Weighted vote total must equal 100%' };
      }
      break;
    }
  }

  return { isValid: true };
}
