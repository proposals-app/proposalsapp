import { randomUUID } from 'node:crypto';
import {
  db,
  sql,
  type Dao,
  type DaoDiscourse,
  type DiscourseTopic,
  type Json,
  type Proposal,
  type ProposalGroup,
  type Selectable,
} from '@proposalsapp/db';
import { recordProposalDecision } from '../shared/audit';
import { isDryRunEnabled } from '../shared/dry-run';
import {
  appendProposalGroupItemIfMissing,
  getProposalItemKey,
  normalizeStoredGroupItems,
  type ProposalGroupItem,
} from '../shared/group-items';
import {
  buildJsonReadOnlySqlRelation,
  executeReadOnlySqlQuery,
  type ReadOnlySqlQueryResult,
  type ReadOnlySqlRelation,
} from '../shared/read-only-sql';
import {
  planDeterministicProposalGrouping,
  type ProposalGroupRecord,
  type ProposalRecord,
  type TopicRecord,
} from './deterministic';

const UNKNOWN_PROPOSAL_GROUP_NAME = 'UNKNOWN';
const dryRunUnknownGroupIds = new Map<string, string>();

function jsonbValue(value: unknown) {
  return sql`CAST(${JSON.stringify(value)} AS jsonb)` as unknown as Json;
}

export interface ProposalWorkerContext {
  dao: Selectable<Dao>;
  daoDiscourse: Selectable<DaoDiscourse> | null;
  proposals: ProposalRecord[];
  topics: TopicRecord[];
  groups: ProposalGroupRecord[];
}

export interface ProposalQueryInput {
  sql: string;
}

function mapTopicRecord(topic: Selectable<DiscourseTopic>): TopicRecord {
  return {
    id: topic.id,
    externalId: topic.externalId,
    daoDiscourseId: topic.daoDiscourseId,
    title: topic.title,
    slug: topic.slug,
    categoryId: topic.categoryId,
    createdAt: topic.createdAt,
  };
}

function mapProposalRecord(proposal: Selectable<Proposal>): ProposalRecord {
  return {
    id: proposal.id,
    externalId: proposal.externalId,
    governorId: proposal.governorId,
    name: proposal.name,
    discussionUrl: proposal.discussionUrl,
    createdAt: proposal.createdAt,
  };
}

function mapProposalGroupRecord(
  group: Selectable<ProposalGroup>
): ProposalGroupRecord {
  return {
    id: group.id,
    daoId: group.daoId,
    createdAt: group.createdAt,
    name: group.name,
    items: normalizeStoredGroupItems(group.items),
  };
}

export async function loadProposalWorkerContext(
  daoSlug: string
): Promise<ProposalWorkerContext | null> {
  const dao = await db
    .selectFrom('dao')
    .selectAll()
    .where('slug', '=', daoSlug)
    .executeTakeFirst();

  if (!dao) {
    return null;
  }

  const daoDiscourse = await db
    .selectFrom('daoDiscourse')
    .selectAll()
    .where('daoId', '=', dao.id)
    .executeTakeFirst();

  const proposals = await db
    .selectFrom('proposal')
    .selectAll()
    .where('daoId', '=', dao.id)
    .orderBy('createdAt', 'asc')
    .execute();

  const topics = daoDiscourse
    ? await db
        .selectFrom('discourseTopic')
        .selectAll()
        .where('daoDiscourseId', '=', daoDiscourse.id)
        .where('closed', '=', false)
        .where('archived', '=', false)
        .where('visible', '=', true)
        .orderBy('createdAt', 'asc')
        .execute()
    : [];

  const groups = await db
    .selectFrom('proposalGroup')
    .selectAll()
    .where('daoId', '=', dao.id)
    .orderBy('createdAt', 'asc')
    .execute();

  return {
    dao,
    daoDiscourse: daoDiscourse ?? null,
    proposals: proposals.map(mapProposalRecord),
    topics: topics.map(mapTopicRecord),
    groups: groups.map(mapProposalGroupRecord),
  };
}

export async function persistProposalGroups(
  groups: ProposalGroupRecord[],
  existingGroups: ProposalGroupRecord[]
): Promise<void> {
  if (isDryRunEnabled()) {
    return;
  }

  const existingById = new Map(
    existingGroups.map((group) => [group.id, group])
  );

  await db.transaction().execute(async (trx) => {
    for (const group of groups) {
      const existing = existingById.get(group.id);
      const nextItems = JSON.stringify(group.items);
      const currentItems = existing ? JSON.stringify(existing.items) : null;

      if (existing) {
        if (currentItems === nextItems && existing.name === group.name) {
          continue;
        }

        await trx
          .updateTable('proposalGroup')
          .set({
            items: jsonbValue(group.items),
            name: group.name,
          })
          .where('id', '=', group.id)
          .execute();
      } else {
        await trx
          .insertInto('proposalGroup')
          .values({
            id: group.id,
            daoId: group.daoId,
            name: group.name,
            createdAt: group.createdAt,
            items: jsonbValue(group.items),
          })
          .execute();
      }
    }
  });
}

function getEligibleTopicItem(
  group: ProposalGroupRecord
): Extract<ProposalGroupItem, { type: 'topic' }> | null {
  const topicItems = group.items.filter(
    (item): item is Extract<ProposalGroupItem, { type: 'topic' }> =>
      item.type === 'topic'
  );

  if (topicItems.length !== 1) {
    return null;
  }

  return topicItems[0];
}

function quoteSqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function getUnknownProposalGroup(
  groups: ProposalGroupRecord[]
): ProposalGroupRecord | null {
  return (
    groups
      .filter((group) => group.name === UNKNOWN_PROPOSAL_GROUP_NAME)
      .sort(
        (left, right) => left.createdAt.getTime() - right.createdAt.getTime()
      )[0] ?? null
  );
}

async function loadProposalGroupRecordById(
  groupId: string
): Promise<ProposalGroupRecord | null> {
  const group = await db
    .selectFrom('proposalGroup')
    .selectAll()
    .where('id', '=', groupId)
    .executeTakeFirst();

  return group ? mapProposalGroupRecord(group) : null;
}

async function ensureUnknownProposalGroup(
  daoId: string,
  context: ProposalWorkerContext
): Promise<{ group: ProposalGroupRecord; created: boolean }> {
  const existingGroup = getUnknownProposalGroup(context.groups);
  if (existingGroup) {
    return {
      group: existingGroup,
      created: false,
    };
  }

  if (isDryRunEnabled()) {
    let groupId = dryRunUnknownGroupIds.get(daoId);
    if (!groupId) {
      groupId = randomUUID();
      dryRunUnknownGroupIds.set(daoId, groupId);
    }

    return {
      group: {
        id: groupId,
        daoId,
        name: UNKNOWN_PROPOSAL_GROUP_NAME,
        createdAt: new Date(),
        items: [],
      },
      created: true,
    };
  }

  const createdAt = new Date();
  const insertedGroupId = randomUUID();

  try {
    await db
      .insertInto('proposalGroup')
      .values({
        id: insertedGroupId,
        daoId,
        name: UNKNOWN_PROPOSAL_GROUP_NAME,
        createdAt,
        items: jsonbValue([]),
      })
      .execute();
  } catch (error) {
    const unknownGroup = await db
      .selectFrom('proposalGroup')
      .selectAll()
      .where('daoId', '=', daoId)
      .where('name', '=', UNKNOWN_PROPOSAL_GROUP_NAME)
      .orderBy('createdAt', 'asc')
      .executeTakeFirst();

    if (!unknownGroup) {
      throw error;
    }
  }

  const persistedGroup = await db
    .selectFrom('proposalGroup')
    .selectAll()
    .where('daoId', '=', daoId)
    .where('name', '=', UNKNOWN_PROPOSAL_GROUP_NAME)
    .orderBy('createdAt', 'asc')
    .executeTakeFirst();

  if (!persistedGroup) {
    throw new Error(`Failed to ensure UNKNOWN proposal group for DAO ${daoId}`);
  }

  return {
    group: mapProposalGroupRecord(persistedGroup),
    created: persistedGroup.id === insertedGroupId,
  };
}

async function appendProposalToGroupIfMissing(params: {
  groupId: string;
  proposal: ProposalRecord;
}): Promise<void> {
  if (isDryRunEnabled()) {
    return;
  }

  await db.transaction().execute(async (trx) => {
    const lockedGroup = await trx
      .selectFrom('proposalGroup')
      .select(['id', 'items'])
      .where('id', '=', params.groupId)
      .forUpdate()
      .executeTakeFirst();

    if (!lockedGroup) {
      throw new Error(`Proposal group ${params.groupId} not found`);
    }

    const currentItems = normalizeStoredGroupItems(lockedGroup.items);
    const nextItems = appendProposalGroupItemIfMissing(currentItems, {
      name: params.proposal.name,
      externalId: params.proposal.externalId,
      governorId: params.proposal.governorId,
    });

    if (!nextItems.appended) {
      return;
    }

    await trx
      .updateTable('proposalGroup')
      .set({
        items: jsonbValue(nextItems.items),
      })
      .where('id', '=', params.groupId)
      .execute();
  });
}

function buildProposalQueryRelations(params: {
  daoId: string;
  proposalId: string;
  allowedCategoryIds: number[];
}): ReadOnlySqlRelation[] {
  return [
    buildJsonReadOnlySqlRelation({
      name: 'allowed_categories',
      columns: [
        { name: 'dao_id', pgType: 'uuid' },
        { name: 'category_id', pgType: 'integer' },
      ],
      rows: params.allowedCategoryIds.map((categoryId) => ({
        dao_id: params.daoId,
        category_id: categoryId,
      })),
    }),
    {
      name: 'current_case',
      sql: `SELECT
  p.id AS proposal_id,
  p.dao_id AS dao_id,
  d.slug AS dao_slug,
  d.name AS dao_name,
  p.governor_id AS governor_id,
  p.external_id AS external_id,
  p.name,
  p.discussion_url AS discussion_url,
  p.created_at AS created_at,
  p.url,
  p.proposal_state AS proposal_state
FROM proposal p
JOIN dao d ON d.id = p.dao_id
WHERE p.id = ${quoteSqlLiteral(params.proposalId)}`,
    },
    {
      name: 'daos',
      sql: `SELECT id, slug, name
FROM dao`,
    },
    {
      name: 'dao_discourses',
      sql: `SELECT
  id,
  dao_id,
  discourse_base_url
FROM dao_discourse`,
    },
    {
      name: 'dao_governors',
      sql: `SELECT
  id,
  dao_id,
  name,
  portal_url,
  type
FROM dao_governor`,
    },
    {
      name: 'proposals',
      sql: `SELECT
  id,
  dao_id,
  governor_id,
  external_id,
  name,
  discussion_url,
  created_at,
  url,
  proposal_state
FROM proposal`,
    },
    {
      name: 'discourse_topics',
      sql: `SELECT
  id,
  dao_discourse_id,
  external_id,
  title,
  slug,
  category_id,
  created_at,
  closed,
  archived,
  visible,
  reply_count,
  posts_count,
  last_posted_at,
  bumped_at
FROM discourse_topic`,
    },
    {
      name: 'proposal_groups',
      sql: `SELECT
  id,
  dao_id,
      name,
      created_at,
  jsonb_array_length(
    CASE
      WHEN jsonb_typeof(items) = 'array' THEN items
      ELSE '[]'::jsonb
    END
  ) AS item_count,
  (
    SELECT COUNT(*)
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(items) = 'array' THEN items
        ELSE '[]'::jsonb
      END
    ) AS item(value)
    WHERE item.value ->> 'type' = 'topic'
  ) AS topic_count,
  (
    SELECT COUNT(*)
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(items) = 'array' THEN items
        ELSE '[]'::jsonb
      END
    ) AS item(value)
    WHERE item.value ->> 'type' = 'proposal'
  ) AS proposal_count
FROM proposal_group`,
    },
    {
      name: 'proposal_group_items',
      sql: `SELECT
  pg.id AS group_id,
  pg.dao_id AS dao_id,
  pg.name AS group_name,
  pg.created_at AS group_created_at,
  item.ordinality - 1 AS item_index,
  item.value ->> 'type' AS item_type,
  item.value ->> 'name' AS item_name,
  COALESCE(item.value ->> 'externalId', item.value ->> 'external_id') AS external_id,
  COALESCE(item.value ->> 'daoDiscourseId', item.value ->> 'dao_discourse_id') AS dao_discourse_id,
  COALESCE(item.value ->> 'governorId', item.value ->> 'governor_id') AS governor_id
FROM proposal_group pg
CROSS JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN jsonb_typeof(pg.items) = 'array' THEN pg.items
    ELSE '[]'::jsonb
  END
) WITH ORDINALITY AS item(value, ordinality)`,
    },
    {
      name: 'proposal_group_topics',
      sql: `SELECT *
FROM proposal_group_items
WHERE item_type = 'topic'`,
    },
    {
      name: 'proposal_group_proposals',
      sql: `SELECT *
FROM proposal_group_items
WHERE item_type = 'proposal'`,
    },
  ];
}

export async function queryProposalMappingData(params: {
  daoId: string;
  proposalId: string;
  allowedCategoryIds: number[];
  input: ProposalQueryInput;
}): Promise<ReadOnlySqlQueryResult> {
  const result = await executeReadOnlySqlQuery({
    query: params.input.sql,
    relations: buildProposalQueryRelations({
      daoId: params.daoId,
      proposalId: params.proposalId,
      allowedCategoryIds: params.allowedCategoryIds,
    }),
  });

  return result;
}

async function loadProposalWorkerContextByDaoId(
  daoId: string
): Promise<ProposalWorkerContext | null> {
  const dao = await db
    .selectFrom('dao')
    .selectAll()
    .where('id', '=', daoId)
    .executeTakeFirst();

  if (!dao) {
    return null;
  }

  return loadProposalWorkerContext(dao.slug);
}

export async function attachProposalToGroup(input: {
  daoId: string;
  proposalId: string;
  groupId: string;
  confidence: number;
  threshold: number;
  reason: string;
  evidenceIds: string[];
  decisionSource: 'deterministic' | 'agent';
}): Promise<{ accepted: boolean; message: string }> {
  const context = await loadProposalWorkerContextByDaoId(input.daoId);
  if (!context) {
    throw new Error(`DAO ${input.daoId} not found`);
  }

  const proposal = context.proposals.find(
    (candidate) => candidate.id === input.proposalId
  );
  if (!proposal) {
    throw new Error(
      `Proposal ${input.proposalId} not found in DAO ${input.daoId}`
    );
  }

  const targetGroup = context.groups.find(
    (group) => group.id === input.groupId
  );
  if (!targetGroup) {
    await recordProposalDecision({
      daoId: input.daoId,
      proposalId: proposal.id,
      targetGroupId: input.groupId,
      decisionSource: input.decisionSource,
      accepted: false,
      declined: false,
      confidence: input.confidence,
      reason: `Rejected proposal mapping: target group not found. ${input.reason}`,
      evidenceIds: input.evidenceIds,
    });
    return { accepted: false, message: 'Target group not found' };
  }

  const topicItem = getEligibleTopicItem(targetGroup);
  if (!topicItem) {
    await recordProposalDecision({
      daoId: input.daoId,
      proposalId: proposal.id,
      targetGroupId: targetGroup.id,
      decisionSource: input.decisionSource,
      accepted: false,
      declined: false,
      confidence: input.confidence,
      reason: `Rejected proposal mapping: target group does not contain exactly one topic. ${input.reason}`,
      evidenceIds: input.evidenceIds,
    });
    return {
      accepted: false,
      message: 'Target group does not contain exactly one topic',
    };
  }

  const proposalKey = getProposalItemKey({
    externalId: proposal.externalId,
    governorId: proposal.governorId,
  });

  const existingGroupForProposal = context.groups.find((group) =>
    group.items.some(
      (item) =>
        item.type === 'proposal' && getProposalItemKey(item) === proposalKey
    )
  );

  if (
    existingGroupForProposal &&
    existingGroupForProposal.id !== targetGroup.id
  ) {
    await recordProposalDecision({
      daoId: input.daoId,
      proposalId: proposal.id,
      targetGroupId: targetGroup.id,
      decisionSource: input.decisionSource,
      accepted: false,
      declined: false,
      confidence: input.confidence,
      reason: `Rejected proposal mapping: proposal is already grouped elsewhere. ${input.reason}`,
      evidenceIds: input.evidenceIds,
    });
    return {
      accepted: false,
      message: 'Proposal is already grouped elsewhere',
    };
  }

  if (input.confidence < input.threshold) {
    await recordProposalDecision({
      daoId: input.daoId,
      proposalId: proposal.id,
      targetGroupId: targetGroup.id,
      decisionSource: input.decisionSource,
      accepted: false,
      declined: false,
      confidence: input.confidence,
      reason: `Rejected proposal mapping below threshold ${input.threshold}. ${input.reason}`,
      evidenceIds: input.evidenceIds,
    });
    return { accepted: false, message: 'Confidence below threshold' };
  }

  if (!existingGroupForProposal) {
    await appendProposalToGroupIfMissing({
      groupId: targetGroup.id,
      proposal,
    });
  }

  await recordProposalDecision({
    daoId: input.daoId,
    proposalId: proposal.id,
    targetGroupId: targetGroup.id,
    decisionSource: input.decisionSource,
    accepted: true,
    declined: false,
    confidence: input.confidence,
    reason: input.reason,
    evidenceIds: input.evidenceIds,
  });

  return {
    accepted: true,
    message: isDryRunEnabled()
      ? 'Dry run: proposal would be mapped successfully'
      : 'Proposal mapped successfully',
  };
}

export async function declineProposalMapping(input: {
  daoId: string;
  proposalId: string;
  reason: string;
  evidenceIds?: string[];
  decisionSource: 'deterministic' | 'agent';
}): Promise<{
  declined: true;
  groupId: string;
  createdGroup: boolean;
  message: string;
}> {
  const fallback = await fallbackProposalToUnknownGroup({
    daoId: input.daoId,
    proposalId: input.proposalId,
    reason: input.reason,
    evidenceIds: input.evidenceIds ?? [],
    decisionSource: input.decisionSource,
  });

  return {
    declined: true,
    groupId: fallback.groupId,
    createdGroup: fallback.createdGroup,
    message: fallback.message,
  };
}

export async function fallbackProposalToUnknownGroup(input: {
  daoId: string;
  proposalId: string;
  reason: string;
  evidenceIds?: string[];
  decisionSource: 'deterministic' | 'agent';
}): Promise<{
  accepted: true;
  groupId: string;
  createdGroup: boolean;
  message: string;
}> {
  const context = await loadProposalWorkerContextByDaoId(input.daoId);
  if (!context) {
    throw new Error(`DAO ${input.daoId} not found`);
  }

  const proposal = context.proposals.find(
    (candidate) => candidate.id === input.proposalId
  );
  if (!proposal) {
    throw new Error(
      `Proposal ${input.proposalId} not found in DAO ${input.daoId}`
    );
  }

  const proposalKey = getProposalItemKey({
    externalId: proposal.externalId,
    governorId: proposal.governorId,
  });
  const existingGroup = context.groups.find((group) =>
    group.items.some(
      (item) =>
        item.type === 'proposal' && getProposalItemKey(item) === proposalKey
    )
  );

  if (existingGroup) {
    await recordProposalDecision({
      daoId: input.daoId,
      proposalId: proposal.id,
      targetGroupId: existingGroup.id,
      decisionSource: input.decisionSource,
      accepted: true,
      declined: false,
      confidence: 0,
      reason: `Proposal already belonged to a group when UNKNOWN fallback was requested. ${input.reason}`,
      evidenceIds: input.evidenceIds ?? [],
      metadata: {
        fallbackUnknown: existingGroup.name === UNKNOWN_PROPOSAL_GROUP_NAME,
        createdUnknownGroup: false,
      },
    });

    return {
      accepted: true,
      groupId: existingGroup.id,
      createdGroup: false,
      message: isDryRunEnabled()
        ? 'Dry run: proposal already belongs to a group'
        : 'Proposal already belongs to a group',
    };
  }

  const ensuredUnknownGroup = await ensureUnknownProposalGroup(
    input.daoId,
    context
  );
  const targetGroup =
    (await loadProposalGroupRecordById(ensuredUnknownGroup.group.id)) ??
    ensuredUnknownGroup.group;

  await appendProposalToGroupIfMissing({
    groupId: targetGroup.id,
    proposal,
  });

  await recordProposalDecision({
    daoId: input.daoId,
    proposalId: proposal.id,
    targetGroupId: targetGroup.id,
    decisionSource: input.decisionSource,
    accepted: true,
    declined: false,
    confidence: 0,
    reason: `Mapped proposal to UNKNOWN fallback group. ${input.reason}`,
    evidenceIds: input.evidenceIds ?? [],
    metadata: {
      fallbackUnknown: true,
      createdUnknownGroup: ensuredUnknownGroup.created,
    },
  });

  return {
    accepted: true,
    groupId: targetGroup.id,
    createdGroup: ensuredUnknownGroup.created,
    message: isDryRunEnabled()
      ? 'Dry run: proposal would be added to the UNKNOWN fallback group'
      : 'Proposal added to the UNKNOWN fallback group',
  };
}

export async function runDeterministicProposalGrouping(input: {
  daoSlug: string;
  allowedCategoryIds: number[];
}): Promise<{
  context: ProposalWorkerContext | null;
  result: ReturnType<typeof planDeterministicProposalGrouping> | null;
}> {
  const context = await loadProposalWorkerContext(input.daoSlug);
  if (!context || !context.daoDiscourse) {
    return { context, result: null };
  }

  const result = planDeterministicProposalGrouping({
    daoId: context.dao.id,
    proposals: context.proposals,
    topics: context.topics,
    groups: context.groups,
    allowedCategoryIds: input.allowedCategoryIds,
  });

  await persistProposalGroups(result.groups, context.groups);

  for (const proposalId of result.urlMatchedProposalIds) {
    const proposal = context.proposals.find(
      (candidate) => candidate.id === proposalId
    );
    if (!proposal) {
      continue;
    }

    const matchedGroup = result.groups.find((group) =>
      group.items.some(
        (item) =>
          item.type === 'proposal' &&
          item.externalId === proposal.externalId &&
          item.governorId === proposal.governorId
      )
    );

    if (!matchedGroup) {
      continue;
    }

    await recordProposalDecision({
      daoId: context.dao.id,
      proposalId: proposal.id,
      targetGroupId: matchedGroup.id,
      decisionSource: 'deterministic',
      accepted: true,
      declined: false,
      confidence: 1,
      reason:
        'Mapped proposal to topic group via deterministic discussion URL resolution',
      evidenceIds: [proposal.id, matchedGroup.id],
    });
  }

  return { context, result };
}
