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

// Extended database interface that includes materialized views
export interface MaterializedViews {
  proposalGroupSummary: ProposalGroupSummary;
  proposalVotesWithVoters: ProposalVotesWithVoters;
  proposalNonVoters: ProposalNonVoters;
}
