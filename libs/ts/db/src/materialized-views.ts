/**
 * Type definitions for materialized views
 * Since kysely-codegen doesn't generate types for materialized views,
 * we define them manually here.
 */

import type { Json, Timestamp } from './kysely_db';

export interface ProposalGroupSummary {
  id: string;
  name: string;
  daoId: string;
  groupCreatedAt: Timestamp;
  proposalsCount: bigint;
  topicsCount: bigint;
  votesCount: bigint;
  postsCount: bigint;
  latestActivityAt: Timestamp;
  hasActiveProposal: boolean;
  earliestEndTime: Timestamp | null;
  authorName: string;
  authorAvatarUrl: string;
}

export interface ProposalVotesWithVoters {
  voteId: string;
  voterAddress: string;
  choice: Json;
  votingPower: number;
  reason: string | null;
  createdAt: Timestamp;
  blockCreatedAt: number | null;
  txid: string | null;
  proposalId: string;
  proposalExternalId: string;
  daoId: string;
  governorId: string;
  voterId: string;
  ens: string | null;
  avatar: string | null;
  latestVotingPower: number | null;
  discourseUsername: string | null;
  discourseAvatarTemplate: string | null;
  computedAvatar: string;
}

export interface ProposalNonVoters {
  proposalId: string;
  daoId: string;
  voterAddress: string;
  voterId: string;
  votingPowerAtStart: number;
  ens: string | null;
  avatar: string | null;
  currentVotingPower: number;
  discourseUsername: string | null;
  discourseAvatarTemplate: string | null;
  computedAvatar: string;
}

/**
 * Extended database interface that includes materialized views.
 *
 * Currently empty - materialized views are disabled.
 * The type definitions above (ProposalGroupSummary, etc.) are kept
 * for reference and can be re-enabled when materialized views are needed.
 *
 * To enable a materialized view:
 * 1. Create the view in a database migration
 * 2. Uncomment the corresponding property below
 * 3. The view will then be queryable via db.selectFrom('viewName')
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface MaterializedViews {
  // Uncomment to enable:
  // proposalGroupSummary: ProposalGroupSummary;
  // proposalVotesWithVoters: ProposalVotesWithVoters;
  // proposalNonVoters: ProposalNonVoters;
}
