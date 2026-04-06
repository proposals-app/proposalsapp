import { db, sql } from '@proposalsapp/db';
import { isDryRunEnabled } from './dry-run';

export type MappingDecisionStatus = 'accepted' | 'declined' | 'rejected';

export interface ProposalDecisionAuditInput {
  daoId: string;
  proposalId: string;
  targetGroupId?: string | null;
  decisionSource: 'deterministic' | 'agent';
  status: MappingDecisionStatus;
  confidence?: number | null;
  reason: string;
  evidenceIds?: string[];
  metadata?: Record<string, unknown>;
  sessionTrace?: unknown[];
  sessionStats?: unknown;
}

export interface DelegateDecisionAuditInput {
  daoId: string;
  delegateId: string;
  mappingType: 'delegate_to_discourse_user' | 'delegate_to_voter';
  targetDiscourseUserId?: string | null;
  targetVoterId?: string | null;
  decisionSource: 'deterministic' | 'agent';
  status: MappingDecisionStatus;
  confidence?: number | null;
  reason: string;
  evidenceIds?: string[];
  metadata?: Record<string, unknown>;
  sessionTrace?: unknown[];
  sessionStats?: unknown;
}

function jsonb(value: unknown) {
  return sql`CAST(${JSON.stringify(value)} AS jsonb)`;
}

export async function recordProposalDecision(
  input: ProposalDecisionAuditInput
): Promise<void> {
  if (isDryRunEnabled()) {
    return;
  }

  await sql`
    INSERT INTO public.mapping_proposal_decision (
      dao_id,
      proposal_id,
      target_group_id,
      decision_source,
      status,
      confidence,
      reason,
      evidence_ids,
      metadata,
      session_trace,
      session_stats
    ) VALUES (
      ${input.daoId},
      ${input.proposalId},
      ${input.targetGroupId ?? null},
      ${input.decisionSource},
      ${input.status},
      ${input.confidence ?? null},
      ${input.reason},
      ${jsonb(input.evidenceIds ?? [])},
      ${jsonb(input.metadata ?? {})},
      ${jsonb(input.sessionTrace ?? [])},
      ${jsonb(input.sessionStats ?? {})}
    )
  `.execute(db);
}

export async function recordDelegateDecision(
  input: DelegateDecisionAuditInput
): Promise<void> {
  if (isDryRunEnabled()) {
    return;
  }

  await sql`
    INSERT INTO public.mapping_delegate_decision (
      dao_id,
      delegate_id,
      mapping_type,
      target_discourse_user_id,
      target_voter_id,
      decision_source,
      status,
      confidence,
      reason,
      evidence_ids,
      metadata,
      session_trace,
      session_stats
    ) VALUES (
      ${input.daoId},
      ${input.delegateId},
      ${input.mappingType},
      ${input.targetDiscourseUserId ?? null},
      ${input.targetVoterId ?? null},
      ${input.decisionSource},
      ${input.status},
      ${input.confidence ?? null},
      ${input.reason},
      ${jsonb(input.evidenceIds ?? [])},
      ${jsonb(input.metadata ?? {})},
      ${jsonb(input.sessionTrace ?? [])},
      ${jsonb(input.sessionStats ?? {})}
    )
  `.execute(db);
}

export async function attachLatestProposalDecisionSession(input: {
  daoId: string;
  proposalId: string;
  decisionSource: 'deterministic' | 'agent';
  startedAt: string;
  sessionTrace: unknown[];
  sessionStats: unknown;
}): Promise<void> {
  if (isDryRunEnabled()) {
    return;
  }

  await sql`
    UPDATE public.mapping_proposal_decision
    SET
      session_trace = ${jsonb(input.sessionTrace)},
      session_stats = ${jsonb(input.sessionStats)}
    WHERE dao_id = ${input.daoId}
      AND proposal_id = ${input.proposalId}
      AND decision_source = ${input.decisionSource}
      AND created_at >= ${input.startedAt}::timestamptz
  `.execute(db);
}

export async function attachLatestDelegateDecisionSession(input: {
  daoId: string;
  delegateId: string;
  decisionSource: 'deterministic' | 'agent';
  startedAt: string;
  sessionTrace: unknown[];
  sessionStats: unknown;
}): Promise<void> {
  if (isDryRunEnabled()) {
    return;
  }

  await sql`
    UPDATE public.mapping_delegate_decision
    SET
      session_trace = ${jsonb(input.sessionTrace)},
      session_stats = ${jsonb(input.sessionStats)}
    WHERE dao_id = ${input.daoId}
      AND delegate_id = ${input.delegateId}
      AND decision_source = ${input.decisionSource}
      AND created_at >= ${input.startedAt}::timestamptz
  `.execute(db);
}
