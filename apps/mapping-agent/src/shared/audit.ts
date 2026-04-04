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
      metadata
    ) VALUES (
      ${input.daoId},
      ${input.proposalId},
      ${input.targetGroupId ?? null},
      ${input.decisionSource},
      ${input.status},
      ${input.confidence ?? null},
      ${input.reason},
      ${jsonb(input.evidenceIds ?? [])},
      ${jsonb(input.metadata ?? {})}
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
      metadata
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
      ${jsonb(input.metadata ?? {})}
    )
  `.execute(db);
}
