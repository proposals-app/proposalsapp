import {
  countTokenOverlap,
  getEnsStem,
  normalizeText,
  tokenizeText,
} from '../shared/normalize';

export interface DelegateRecord {
  id: string;
  daoId: string;
  discourseUserIds: string[];
  voterIds: string[];
}

export interface DiscourseUserRecord {
  id: string;
  daoId: string;
  username: string;
  name: string | null;
}

export interface VoterRecord {
  id: string;
  daoId: string;
  address: string;
  ens: string | null;
}

export interface DiscourseSeedCandidate {
  discourseUserId: string;
  username: string;
  proposalCategoryPostCount: number;
  historicalDelegateIds: string[];
  repairDelegateId?: string;
  ambiguousHistoricalDelegateIds?: string[];
}

export type DelegateCase =
  | {
      delegateId: string;
      missingSide: 'voter';
      sourceDiscourseUserId: string;
    }
  | {
      delegateId: string;
      missingSide: 'discourse_user';
      sourceVoterId: string;
    };

export interface RankedCandidate {
  id: string;
  score: number;
  reason: string;
}

export function buildDelegateCases(
  delegates: DelegateRecord[]
): DelegateCase[] {
  const cases: DelegateCase[] = [];

  for (const delegate of delegates) {
    const hasDiscourseUser = delegate.discourseUserIds.length > 0;
    const hasVoter = delegate.voterIds.length > 0;

    if (hasDiscourseUser && !hasVoter) {
      cases.push({
        delegateId: delegate.id,
        missingSide: 'voter',
        sourceDiscourseUserId: delegate.discourseUserIds[0]!,
      });
    } else if (!hasDiscourseUser && hasVoter) {
      cases.push({
        delegateId: delegate.id,
        missingSide: 'discourse_user',
        sourceVoterId: delegate.voterIds[0]!,
      });
    }
  }

  return cases;
}

export function buildDiscourseSeedCandidates(input: {
  discourseUsers: DiscourseUserRecord[];
  proposalCategoryPostCounts: Map<string, number>;
  delegates: DelegateRecord[];
  historicalDelegateIdsByDiscourseUserId?: Map<string, string[]>;
}): DiscourseSeedCandidate[] {
  const activeDiscourseUserIds = new Set(
    input.delegates.flatMap((delegate) => delegate.discourseUserIds)
  );

  return input.discourseUsers
    .map((user) => {
      const proposalCategoryPostCount =
        input.proposalCategoryPostCounts.get(user.id) ?? 0;
      const historicalDelegateIds =
        input.historicalDelegateIdsByDiscourseUserId?.get(user.id) ?? [];

      if (
        proposalCategoryPostCount <= 10 ||
        activeDiscourseUserIds.has(user.id)
      ) {
        return null;
      }

      return {
        discourseUserId: user.id,
        username: user.username,
        proposalCategoryPostCount,
        historicalDelegateIds,
        ...(historicalDelegateIds.length === 1
          ? {
              repairDelegateId: historicalDelegateIds[0],
            }
          : historicalDelegateIds.length > 1
            ? {
                ambiguousHistoricalDelegateIds: historicalDelegateIds,
              }
            : {}),
      };
    })
    .filter(
      (candidate): candidate is DiscourseSeedCandidate => candidate !== null
    )
    .sort((left, right) => {
      if (right.proposalCategoryPostCount !== left.proposalCategoryPostCount) {
        return right.proposalCategoryPostCount - left.proposalCategoryPostCount;
      }

      const usernameComparison = left.username.localeCompare(right.username);
      if (usernameComparison !== 0) {
        return usernameComparison;
      }

      return left.discourseUserId.localeCompare(right.discourseUserId);
    });
}

export function prioritizeDelegateCases(input: {
  cases: DelegateCase[];
  proposalCategoryPostCounts: Map<string, number>;
}): DelegateCase[] {
  return [...input.cases].sort((left, right) => {
    const leftPriority =
      left.missingSide === 'voter'
        ? (input.proposalCategoryPostCounts.get(left.sourceDiscourseUserId) ??
          0)
        : -1;
    const rightPriority =
      right.missingSide === 'voter'
        ? (input.proposalCategoryPostCounts.get(right.sourceDiscourseUserId) ??
          0)
        : -1;

    return rightPriority - leftPriority;
  });
}

function buildSourceTokensFromDiscourseUser(
  sourceUser: DiscourseUserRecord
): string[] {
  return [
    ...tokenizeText(sourceUser.username),
    ...tokenizeText(sourceUser.name),
  ];
}

function buildSourceTokensFromVoter(sourceVoter: VoterRecord): string[] {
  return [
    ...tokenizeText(sourceVoter.address),
    ...tokenizeText(sourceVoter.ens),
    ...tokenizeText(getEnsStem(sourceVoter.ens)),
  ];
}

export function rankVoterCandidates(
  currentCase: Extract<DelegateCase, { missingSide: 'voter' }>,
  sourceUser: DiscourseUserRecord,
  voters: VoterRecord[]
): RankedCandidate[] {
  const sourceUsername = normalizeText(sourceUser.username);
  const sourceName = normalizeText(sourceUser.name);
  const sourceTokens = buildSourceTokensFromDiscourseUser(sourceUser);

  return voters
    .map((voter) => {
      const ensStem = getEnsStem(voter.ens);
      const overlap =
        countTokenOverlap(sourceTokens, tokenizeText(voter.ens)) +
        countTokenOverlap(sourceTokens, tokenizeText(voter.address));

      let score = overlap;
      const reasons: string[] = [];

      if (ensStem && ensStem === sourceUsername) {
        score += 10;
        reasons.push('ENS stem matches discourse username');
      }

      if (sourceName && ensStem && ensStem === sourceName) {
        score += 6;
        reasons.push('ENS stem matches discourse display name');
      }

      if (overlap > 0) {
        reasons.push(`token overlap score ${overlap}`);
      }

      return {
        id: voter.id,
        score,
        reason:
          reasons.join('; ') ||
          `candidate for ${currentCase.delegateId} with no local overlap`,
      };
    })
    .sort((left, right) => right.score - left.score);
}

export function rankDiscourseUserCandidates(
  currentCase: Extract<DelegateCase, { missingSide: 'discourse_user' }>,
  sourceVoter: VoterRecord,
  discourseUsers: DiscourseUserRecord[]
): RankedCandidate[] {
  const ensStem = getEnsStem(sourceVoter.ens);
  const sourceTokens = buildSourceTokensFromVoter(sourceVoter);

  return discourseUsers
    .map((discourseUser) => {
      const normalizedUsername = normalizeText(discourseUser.username);
      const overlap =
        countTokenOverlap(sourceTokens, tokenizeText(discourseUser.username)) +
        countTokenOverlap(sourceTokens, tokenizeText(discourseUser.name));

      let score = overlap;
      const reasons: string[] = [];

      if (ensStem && ensStem === normalizedUsername) {
        score += 10;
        reasons.push('discourse username matches voter ENS stem');
      }

      if (overlap > 0) {
        reasons.push(`token overlap score ${overlap}`);
      }

      return {
        id: discourseUser.id,
        score,
        reason:
          reasons.join('; ') ||
          `candidate for ${currentCase.delegateId} with no local overlap`,
      };
    })
    .sort((left, right) => right.score - left.score);
}
