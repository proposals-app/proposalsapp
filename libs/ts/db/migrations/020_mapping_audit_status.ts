import { type Kysely, sql } from 'kysely';
import { type DB } from '../src';

export async function up(db: Kysely<DB>): Promise<void> {
  await sql`
    DROP TABLE IF EXISTS public.mapping_delegate_decision
  `.execute(db);

  await sql`
    DROP TABLE IF EXISTS public.mapping_proposal_decision
  `.execute(db);

  await sql`
    CREATE TABLE public.mapping_proposal_decision (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dao_id UUID NOT NULL REFERENCES public.dao(id) ON DELETE CASCADE,
      proposal_id UUID NOT NULL REFERENCES public.proposal(id) ON DELETE CASCADE,
      target_group_id UUID REFERENCES public.proposal_group(id) ON DELETE CASCADE,
      decision_source TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('accepted', 'declined', 'rejected')),
      confidence DOUBLE PRECISION,
      reason TEXT NOT NULL,
      evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_mapping_proposal_decision_lookup
    ON public.mapping_proposal_decision (dao_id, proposal_id, created_at DESC)
  `.execute(db);

  await sql`
    CREATE TABLE public.mapping_delegate_decision (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dao_id UUID NOT NULL REFERENCES public.dao(id) ON DELETE CASCADE,
      delegate_id UUID NOT NULL REFERENCES public.delegate(id) ON DELETE CASCADE,
      mapping_type TEXT NOT NULL,
      target_discourse_user_id UUID REFERENCES public.discourse_user(id) ON DELETE CASCADE,
      target_voter_id UUID REFERENCES public.voter(id) ON DELETE CASCADE,
      decision_source TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('accepted', 'declined', 'rejected')),
      confidence DOUBLE PRECISION,
      reason TEXT NOT NULL,
      evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_mapping_delegate_decision_lookup
    ON public.mapping_delegate_decision (dao_id, delegate_id, created_at DESC)
  `.execute(db);
}

export async function down(db: Kysely<DB>): Promise<void> {
  await sql`
    DROP TABLE IF EXISTS public.mapping_delegate_decision
  `.execute(db);

  await sql`
    DROP TABLE IF EXISTS public.mapping_proposal_decision
  `.execute(db);

  await sql`
    CREATE TABLE public.mapping_proposal_decision (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dao_id UUID NOT NULL REFERENCES public.dao(id) ON DELETE CASCADE,
      proposal_id UUID NOT NULL REFERENCES public.proposal(id) ON DELETE CASCADE,
      target_group_id UUID REFERENCES public.proposal_group(id) ON DELETE CASCADE,
      decision_source TEXT NOT NULL,
      accepted BOOLEAN NOT NULL DEFAULT FALSE,
      declined BOOLEAN NOT NULL DEFAULT FALSE,
      confidence DOUBLE PRECISION,
      reason TEXT NOT NULL,
      evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_mapping_proposal_decision_lookup
    ON public.mapping_proposal_decision (dao_id, proposal_id, created_at DESC)
  `.execute(db);

  await sql`
    CREATE TABLE public.mapping_delegate_decision (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dao_id UUID NOT NULL REFERENCES public.dao(id) ON DELETE CASCADE,
      delegate_id UUID NOT NULL REFERENCES public.delegate(id) ON DELETE CASCADE,
      mapping_type TEXT NOT NULL,
      target_discourse_user_id UUID REFERENCES public.discourse_user(id) ON DELETE CASCADE,
      target_voter_id UUID REFERENCES public.voter(id) ON DELETE CASCADE,
      decision_source TEXT NOT NULL,
      accepted BOOLEAN NOT NULL DEFAULT FALSE,
      declined BOOLEAN NOT NULL DEFAULT FALSE,
      confidence DOUBLE PRECISION,
      reason TEXT NOT NULL,
      evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_mapping_delegate_decision_lookup
    ON public.mapping_delegate_decision (dao_id, delegate_id, created_at DESC)
  `.execute(db);
}
