/**
 * Type definitions for materialized views
 * Since kysely-codegen doesn't generate types for materialized views,
 * we define them manually here.
 */

export interface ProposalGroupSummary {
  id: string;
  name: string;
  daoId: string;
  groupCreatedAt: Date;
  proposalsCount: bigint;
  topicsCount: bigint;
  votesCount: bigint;
  postsCount: bigint;
  latestActivityAt: Date;
  hasActiveProposal: boolean;
  earliestEndTime: Date | null;
  authorName: string;
  authorAvatarUrl: string;
}

// Extended database interface that includes materialized views
export interface MaterializedViews {
  proposalGroupSummary: ProposalGroupSummary;
}