import Fuse from 'fuse.js';
import { db } from '@proposalsapp/db';
import type { AsyncReturnType } from '@/lib/utils';
import { revalidateTag, cacheTag, cacheLife } from 'next/cache';
import { requireDao } from '@/lib/server-actions-utils';
import type {
  EditableProposalGroup,
  ProposalGroupItem as BaseProposalGroupItem,
  StoredProposalGroupItem,
} from '@/lib/types';
import { groupIdSchema } from '@/lib/validations';
import type { FuzzySearchResult } from './api-contract';

export type ProposalItem = Extract<BaseProposalGroupItem, { type: 'proposal' }>;
export type TopicItem = Extract<BaseProposalGroupItem, { type: 'topic' }>;
export type ProposalGroupItem = BaseProposalGroupItem;
export type ProposalGroup = EditableProposalGroup;

type NormalizableGroupItem = StoredProposalGroupItem | ProposalGroupItem;

function normalizeGroupItem(item: NormalizableGroupItem): ProposalGroupItem {
  if (item.type === 'proposal') {
    const externalIdValue =
      ('externalId' in item ? item.externalId : undefined) ??
      ('external_id' in item ? item.external_id : undefined);
    const governorIdValue =
      ('governorId' in item ? item.governorId : undefined) ??
      ('governor_id' in item ? item.governor_id : undefined);

    if (
      externalIdValue === undefined ||
      externalIdValue === null ||
      governorIdValue === undefined ||
      governorIdValue === null
    ) {
      throw new Error('Missing proposal identifiers in group item');
    }

    const base: ProposalItem = {
      type: 'proposal',
      name: item.name,
      externalId: String(externalIdValue),
      governorId: String(governorIdValue),
    };

    if ('indexerName' in item && item.indexerName) {
      return { ...base, indexerName: item.indexerName };
    }

    return base;
  }

  const externalIdValue =
    ('externalId' in item ? item.externalId : undefined) ??
    ('external_id' in item ? item.external_id : undefined);
  const daoDiscourseIdValue =
    ('daoDiscourseId' in item ? item.daoDiscourseId : undefined) ??
    ('dao_discourse_id' in item ? item.dao_discourse_id : undefined);

  if (
    externalIdValue === undefined ||
    externalIdValue === null ||
    daoDiscourseIdValue === undefined ||
    daoDiscourseIdValue === null
  ) {
    throw new Error('Missing topic identifiers in group item');
  }

  const base: TopicItem = {
    type: 'topic',
    name: item.name,
    externalId: String(externalIdValue),
    daoDiscourseId: String(daoDiscourseIdValue),
  };

  if ('indexerName' in item && item.indexerName) {
    return { ...base, indexerName: item.indexerName };
  }

  return base;
}

export type GroupsDataReturnType = AsyncReturnType<typeof getGroupsData>;
export type UngroupedProposalsReturnType = AsyncReturnType<
  typeof getUngroupedProposals
>;

export type { FuzzySearchResult } from './api-contract';

/**
 * Fetches all proposal groups for a given DAO
 */
export async function getGroupsData(daoSlug: string) {
  'use cache';
  cacheLife('minutes');
  cacheTag('groupsData');

  const dao = await db
    .selectFrom('dao')
    .where('slug', '=', daoSlug)
    .select(['id', 'name', 'slug'])
    .executeTakeFirst();

  if (!dao) return { dao: null, proposals: [], topics: [], proposalGroups: [] };

  const proposalGroups = await db
    .selectFrom('proposalGroup')
    .where('daoId', '=', dao.id)
    .select(['id', 'name', 'items', 'createdAt', 'daoId'])
    .orderBy('createdAt', 'desc')
    .execute();

  const normalizedGroups = proposalGroups.map((group) => ({
    ...group,
    items: (group.items as StoredProposalGroupItem[]).map((item) =>
      normalizeGroupItem(item)
    ),
  }));

  const proposalKeys = new Map<
    string,
    { externalId: string; governorId: string }
  >();
  const topicKeys = new Map<
    string,
    { externalId: number; daoDiscourseId: string }
  >();

  for (const group of normalizedGroups) {
    for (const item of group.items) {
      if (item.type === 'proposal') {
        const key = `${item.externalId}:${item.governorId}`;
        if (!proposalKeys.has(key)) {
          proposalKeys.set(key, {
            externalId: item.externalId,
            governorId: item.governorId,
          });
        }
      } else {
        const parsedExternalId = Number.parseInt(item.externalId, 10);
        if (Number.isNaN(parsedExternalId)) continue;
        const key = `${item.externalId}:${item.daoDiscourseId}`;
        if (!topicKeys.has(key)) {
          topicKeys.set(key, {
            externalId: parsedExternalId,
            daoDiscourseId: item.daoDiscourseId,
          });
        }
      }
    }
  }

  const proposalIndexerMap = new Map<string, string>();
  if (proposalKeys.size > 0) {
    const proposalLookups = [...proposalKeys.values()];
    const proposals = await db
      .selectFrom('proposal')
      .leftJoin('daoGovernor', 'daoGovernor.id', 'proposal.governorId')
      .select([
        'proposal.externalId',
        'proposal.governorId',
        'daoGovernor.name as governorName',
      ])
      .where((eb) =>
        eb.or(
          proposalLookups.map((item) =>
            eb.and([
              eb('proposal.externalId', '=', item.externalId),
              eb('proposal.governorId', '=', item.governorId),
            ])
          )
        )
      )
      .execute();

    for (const proposal of proposals) {
      proposalIndexerMap.set(
        `${proposal.externalId}:${proposal.governorId}`,
        proposal.governorName ?? 'unknown'
      );
    }
  }

  const topicIndexerMap = new Map<string, string>();
  if (topicKeys.size > 0) {
    const topicLookups = [...topicKeys.values()];
    const topics = await db
      .selectFrom('discourseTopic')
      .leftJoin(
        'daoDiscourse',
        'daoDiscourse.id',
        'discourseTopic.daoDiscourseId'
      )
      .select([
        'discourseTopic.externalId',
        'discourseTopic.daoDiscourseId',
        'daoDiscourse.discourseBaseUrl',
      ])
      .where((eb) =>
        eb.or(
          topicLookups.map((item) =>
            eb.and([
              eb('discourseTopic.externalId', '=', item.externalId),
              eb('discourseTopic.daoDiscourseId', '=', item.daoDiscourseId),
            ])
          )
        )
      )
      .execute();

    for (const topic of topics) {
      topicIndexerMap.set(
        `${topic.externalId}:${topic.daoDiscourseId}`,
        topic.discourseBaseUrl ?? 'unknown'
      );
    }
  }

  const groupsWithItems = normalizedGroups.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      const indexerName =
        item.indexerName ??
        (item.type === 'proposal'
          ? proposalIndexerMap.get(`${item.externalId}:${item.governorId}`)
          : topicIndexerMap.get(`${item.externalId}:${item.daoDiscourseId}`)) ??
        'unknown';

      return { ...item, indexerName };
    }),
  }));

  return { proposalGroups: groupsWithItems };
}

/**
 * Fetches all proposals that are not part of any group
 */
export async function getUngroupedProposals(
  daoSlug: string
): Promise<ProposalItem[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag('ungroupedProposals');

  const dao = await db
    .selectFrom('dao')
    .where('slug', '=', daoSlug)
    .selectAll()
    .executeTakeFirst();

  if (!dao) return [];

  const allProposals = await db
    .selectFrom('proposal')
    .where('proposal.daoId', '=', dao.id)
    .leftJoin('daoGovernor', 'daoGovernor.id', 'proposal.governorId')
    .select([
      'proposal.id',
      'proposal.externalId',
      'proposal.governorId',
      'proposal.name as proposalName',
      'daoGovernor.name as governorName',
    ])
    .where('markedSpam', '=', false)
    .execute();

  // Only consider groups for this DAO when determining which proposals are already grouped
  const groups = await db
    .selectFrom('proposalGroup')
    .select(['items'])
    .where('daoId', '=', dao.id)
    .execute();

  // Extract all proposal items from groups
  const allGroupedProposalItems: { externalId: string; governorId: string }[] =
    [];
  groups.forEach((group) => {
    const items = group.items as StoredProposalGroupItem[];
    items.forEach((item) => {
      const normalized = normalizeGroupItem(item);
      if (normalized.type === 'proposal') {
        allGroupedProposalItems.push({
          externalId: normalized.externalId,
          governorId: normalized.governorId,
        });
      }
    });
  });

  // Fetch all grouped proposal IDs in a single query
  const groupedProposalIds =
    allGroupedProposalItems.length > 0
      ? await db
          .selectFrom('proposal')
          .select(['id'])
          .where((eb) => {
            const conditions = allGroupedProposalItems.map((item) =>
              eb.and([
                eb('externalId', '=', item.externalId),
                eb('governorId', '=', item.governorId),
              ])
            );
            return conditions.length === 1 ? conditions[0] : eb.or(conditions);
          })
          .execute()
          .then((results) => results.map((r) => r.id))
      : [];

  const uniqueGroupedIds = [...new Set(groupedProposalIds)];

  // Return proposals that are not in any group
  return allProposals
    .filter((proposal) => !uniqueGroupedIds.includes(proposal.id))
    .map((proposal) => ({
      name: proposal.proposalName,
      type: 'proposal' as const,
      externalId: proposal.externalId,
      governorId: proposal.governorId,
      indexerName: proposal.governorName ?? 'Unknown',
    }));
}

/**
 * Performs a fuzzy search across proposals and topics for a DAO
 */
export async function fuzzySearchItems(
  searchTerm: string,
  daoSlug: string
): Promise<FuzzySearchResult[]> {
  // Remove 'use cache' directive to ensure fresh results each time
  // This ensures the search functionality works properly

  // Validate search term and dao slug
  if (!searchTerm || !searchTerm.trim() || !daoSlug) {
    console.log('Invalid search term or daoSlug:', { searchTerm, daoSlug });
    return [];
  }

  const dao = await requireDao(daoSlug);

  const daoDiscourse = await db
    .selectFrom('daoDiscourse')
    .where('daoId', '=', dao.id)
    .selectAll()
    .executeTakeFirst();

  if (!daoDiscourse) return [];

  const [proposals, topics] = await Promise.all([
    db
      .selectFrom('proposal')
      .where('markedSpam', '=', false)
      .where('proposal.daoId', '=', dao.id)
      .leftJoin('daoGovernor', 'daoGovernor.id', 'proposal.governorId')
      .select([
        'proposal.id',
        'proposal.externalId',
        'proposal.governorId',
        'proposal.name as proposalName',
        'daoGovernor.name as governorName',
      ])
      .execute(),
    db
      .selectFrom('discourseTopic')
      .where('discourseTopic.daoDiscourseId', '=', daoDiscourse.id)
      .leftJoin(
        'daoDiscourse',
        'daoDiscourse.id',
        'discourseTopic.daoDiscourseId'
      )
      .select([
        'discourseTopic.id',
        'discourseTopic.externalId',
        'discourseTopic.daoDiscourseId',
        'title',
        'daoDiscourse.discourseBaseUrl',
      ])
      .execute(),
  ]);

  const allItems: (Omit<FuzzySearchResult, 'score'> & {
    score?: number;
  })[] = [
    ...proposals.map((p) => ({
      name: p.proposalName,
      type: 'proposal' as const,
      external_id: p.externalId,
      governor_id: p.governorId,
      indexerName: p.governorName ?? 'unknown',
    })),
    ...topics.map((t) => ({
      name: t.title,
      type: 'topic' as const,
      external_id: String(t.externalId),
      dao_discourse_id: t.daoDiscourseId,
      indexerName: t.discourseBaseUrl ?? 'unknown',
    })),
  ];

  if (allItems.length === 0) return [];

  const fuse = new Fuse(allItems, {
    keys: ['name'],
    threshold: 0.5,
    includeScore: true,
  });

  return fuse
    .search(searchTerm)
    .slice(0, 100)
    .map((result) => ({
      ...result.item,
      score: result.score ?? 1.0,
    }));
}
/**
 * Saves updated groups to the database
 */
export async function saveGroups(
  daoSlug: string,
  groups: ProposalGroup[]
): Promise<void> {
  const dao = await requireDao(daoSlug);
  const sanitizeItems = (items: NormalizableGroupItem[]) =>
    items.map((item) => {
      const normalized = normalizeGroupItem(item);

      if (normalized.type === 'proposal') {
        return {
          type: 'proposal' as const,
          name: normalized.name,
          externalId: normalized.externalId,
          governorId: normalized.governorId,
        };
      }

      return {
        type: 'topic' as const,
        name: normalized.name,
        externalId: normalized.externalId,
        daoDiscourseId: normalized.daoDiscourseId,
      };
    });
  await db.transaction().execute(async (trx) => {
    for (const group of groups) {
      if (group.daoId !== dao.id) {
        throw new Error('Proposal group does not belong to this DAO');
      }

      if (group.id) {
        groupIdSchema.parse(group.id);
        const result = await trx
          .updateTable('proposalGroup')
          .set({
            name: group.name,
            items: JSON.stringify(sanitizeItems(group.items)),
          })
          .where('id', '=', group.id)
          .where('daoId', '=', dao.id)
          .executeTakeFirst();

        if (Number(result.numUpdatedRows) !== 1) {
          throw new Error('Proposal group was not found in this DAO');
        }
      } else {
        await trx
          .insertInto('proposalGroup')
          .values({
            name: group.name,
            items: JSON.stringify(sanitizeItems(group.items)),
            daoId: dao.id,
            createdAt: group.createdAt,
          })
          .execute();
      }
    }
  });

  revalidateTag('groupsData', 'max');
  revalidateTag('ungroupedProposals', 'max');
  revalidateTag('groups', 'max');
}

/**
 * Creates a new empty proposal group
 */
export async function createGroup(daoSlug: string): Promise<void> {
  const dao = await requireDao(daoSlug);

  const newGroup: ProposalGroup = {
    id: crypto.randomUUID(),
    name: `New Group ${new Date().toLocaleString()}`,
    items: [],
    daoId: dao.id,
    createdAt: new Date(),
  };

  await db
    .insertInto('proposalGroup')
    .values({
      id: newGroup.id,
      name: newGroup.name,
      items: JSON.stringify(newGroup.items),
      daoId: newGroup.daoId,
      createdAt: newGroup.createdAt,
    })
    .execute();

  revalidateTag('groupsData', 'max');
  revalidateTag('ungroupedProposals', 'max');
  revalidateTag('groups', 'max');
}

/**
 * Deletes a group from the database
 */
export async function deleteGroup(
  daoSlug: string,
  groupId: string
): Promise<void> {
  groupIdSchema.parse(groupId);
  const dao = await requireDao(daoSlug);
  const result = await db
    .deleteFrom('proposalGroup')
    .where('id', '=', groupId)
    .where('daoId', '=', dao.id)
    .executeTakeFirst();

  if (Number(result.numDeletedRows) !== 1) {
    throw new Error('Proposal group was not found in this DAO');
  }

  revalidateTag('groupsData', 'max');
  revalidateTag('ungroupedProposals', 'max');
  revalidateTag('groups', 'max');
}

/**
 * Fetches DAO details by slug
 */
export async function getDao(daoSlug: string) {
  'use cache';
  cacheLife('hours');
  cacheTag('dao');

  const dao = await db
    .selectFrom('dao')
    .selectAll()
    .where('slug', '=', daoSlug)
    .executeTakeFirst();

  return dao;
}
