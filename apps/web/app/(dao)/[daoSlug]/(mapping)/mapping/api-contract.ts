import { z } from 'zod';
import type { EditableProposalGroup } from '@/lib/types';

const uuid = z.uuid();
const boundedIdList = z.array(uuid).max(500);

const proposalItemSchema = z.object({
  type: z.literal('proposal'),
  name: z.string().trim().min(1).max(1_000),
  externalId: z.string().min(1).max(500),
  governorId: uuid,
  indexerName: z.string().max(500).optional(),
});

const topicItemSchema = z.object({
  type: z.literal('topic'),
  name: z.string().trim().min(1).max(1_000),
  externalId: z.string().min(1).max(100),
  daoDiscourseId: uuid,
  indexerName: z.string().max(500).optional(),
});

const proposalGroupSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1).max(500),
  items: z
    .array(z.discriminatedUnion('type', [proposalItemSchema, topicItemSchema]))
    .max(1_000),
  daoId: uuid,
  createdAt: z.coerce.date(),
});

export const mappingRequestSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('groups.search'),
    query: z.string().trim().min(1).max(200),
  }),
  z.object({
    operation: z.literal('groups.save'),
    groups: z.array(proposalGroupSchema).min(1).max(500),
  }),
  z.object({ operation: z.literal('groups.create') }),
  z.object({ operation: z.literal('groups.delete'), groupId: uuid }),
  z.object({
    operation: z.literal('delegates.searchDiscourseUsers'),
    query: z.string().trim().min(1).max(200),
    excludeIds: boundedIdList.default([]),
  }),
  z.object({
    operation: z.literal('delegates.searchVoters'),
    query: z.string().trim().min(1).max(200),
    excludeIds: boundedIdList.default([]),
  }),
  z.object({
    operation: z.literal('delegates.mapDiscourseUser'),
    delegateId: uuid,
    discourseUserId: uuid,
  }),
  z.object({
    operation: z.literal('delegates.unmapDiscourseUser'),
    delegateId: uuid,
    discourseUserId: uuid,
  }),
  z.object({
    operation: z.literal('delegates.mapVoter'),
    delegateId: uuid,
    voterId: uuid,
  }),
  z.object({
    operation: z.literal('delegates.unmapVoter'),
    delegateId: uuid,
    voterId: uuid,
  }),
  z.object({ operation: z.literal('delegates.create') }),
  z.object({
    operation: z.literal('delegates.delete'),
    delegateId: uuid,
  }),
]);

export type MappingRequest = z.input<typeof mappingRequestSchema>;
export type ValidatedMappingRequest = z.output<typeof mappingRequestSchema>;

export interface FuzzySearchResult {
  type: 'proposal' | 'topic';
  name: string;
  external_id?: string;
  dao_discourse_id?: string;
  governor_id?: string;
  indexerName?: string;
  score: number;
}

export interface DiscourseUserSummary {
  id: string;
  username: string;
  name: string | null;
}

export interface VoterSummary {
  id: string;
  address: string;
  ens: string | null;
}

export type SaveableProposalGroup = EditableProposalGroup;
