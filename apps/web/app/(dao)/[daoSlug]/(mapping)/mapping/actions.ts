'use server';

import Fuse from 'fuse.js';
import { db } from '@proposalsapp/db';
import type { AsyncReturnType } from '@/lib/utils';
import { revalidateTag } from 'next/cache';
import {
  type ServerActionVoidResult,
  handleSilentServerAction,
  handleVoidServerAction,
} from '@/lib/server-actions-utils';

// Define strong types for our data structures
export type ProposalItem = {
  type: 'proposal';
  name: string;
  externalId: string;
  governorId: string;
  indexerName?: string;
};

export type TopicItem = {
  type: 'topic';
  name: string;
  externalId: string;
  daoDiscourseId: string;
  indexerName?: string;
};

export type ProposalGroupItem = ProposalItem | TopicItem;

export interface ProposalGroup {
  id?: string;
  name: string;
  items: ProposalGroupItem[];
  daoId: string;
  createdAt: Date;
}

export type GroupsDataReturnType = AsyncReturnType<typeof getGroupsData>;
export type UngroupedProposalsReturnType = AsyncReturnType<
  typeof getUngroupedProposals
>;

export interface FuzzySearchResult {
  type: 'proposal' | 'topic';
  name: string;
  external_id?: string;
  dao_discourse_id?: string;
  governor_id?: string;
  indexerName?: string;
  score: number;
}

/**
 * Fetches all proposal groups for a given DAO
 */
export async function getGroupsData(daoSlug: string) {
  // 'use cache';
  // cacheTag('groupsData');

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

  const groupsWithItems = await Promise.all(
    proposalGroups.map(async (group) => {
      const items = group.items as ProposalGroupItem[];
      const itemsWithIndexerName = await Promise.all(
        items.map(async (item) => {
          let indexerName = 'unknown';

          if (item.type === 'proposal') {
            const proposal = await db
              .selectFrom('proposal')
              .leftJoin('daoGovernor', 'daoGovernor.id', 'proposal.governorId')
              .select('daoGovernor.name as governorName')
              .where('proposal.externalId', '=', item.externalId)
              .where('proposal.governorId', '=', item.governorId)
              .executeTakeFirst();
            indexerName = proposal?.governorName ?? 'unknown';
          } else if (item.type === 'topic') {
            const topic = await db
              .selectFrom('discourseTopic')
              .leftJoin(
                'daoDiscourse',
                'daoDiscourse.id',
                'discourseTopic.daoDiscourseId'
              )
              .select('daoDiscourse.discourseBaseUrl')
              .where(
                'discourseTopic.externalId',
                '=',
                parseInt(item.externalId)
              )
              .where('discourseTopic.daoDiscourseId', '=', item.daoDiscourseId)
              .executeTakeFirst();
            indexerName = topic?.discourseBaseUrl ?? 'unknown';
          }

          return { ...item, indexerName };
        })
      );

      return {
        ...group,
        items: itemsWithIndexerName,
      };
    })
  );

  return { proposalGroups: groupsWithItems };
}

/**
 * Fetches all proposals that are not part of any group
 */
export async function getUngroupedProposals(
  daoSlug: string
): Promise<ProposalItem[]> {
  // 'use cache';
  // cacheTag('ungroupedProposals');

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
    const items = group.items as ProposalGroupItem[];
    items.forEach((item) => {
      if (item.type === 'proposal') {
        allGroupedProposalItems.push({
          externalId: item.externalId,
          governorId: item.governorId,
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

  return handleSilentServerAction(
    async () => {
      const dao = await db
        .selectFrom('dao')
        .where('slug', '=', daoSlug)
        .selectAll()
        .executeTakeFirst();

      if (!dao) {
        console.error(`DAO not found: ${daoSlug}`);
        return [];
      }

      const daoDiscourse = await db
        .selectFrom('daoDiscourse')
        .where('daoId', '=', dao.id)
        .selectAll()
        .executeTakeFirst();

      if (!daoDiscourse) {
        console.log('No daoDiscourse found for dao:', daoSlug);
        return [];
      }

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
    },
    [],
    'fuzzySearchItems'
  );
}
/**
 * Saves updated groups to the database
 */
export async function saveGroups(
  groups: ProposalGroup[]
): Promise<ServerActionVoidResult> {
  'use server';

  return handleVoidServerAction(async () => {
    const sanitizeItems = (items: ProposalGroupItem[]) =>
      items.map((item) =>
        item.type === 'proposal'
          ? {
              type: 'proposal' as const,
              name: item.name,
              externalId: (item as any).externalId ?? (item as any).external_id,
              governorId: (item as any).governorId ?? (item as any).governor_id,
            }
          : {
              type: 'topic' as const,
              name: item.name,
              externalId: (item as any).externalId ?? (item as any).external_id,
              daoDiscourseId:
                (item as any).daoDiscourseId ?? (item as any).dao_discourse_id,
            }
      );
    await Promise.all(
      groups.map(async (group) => {
        if (group.id) {
          await db
            .insertInto('proposalGroup')
            .values({
              id: group.id,
              name: group.name,
              items: JSON.stringify(sanitizeItems(group.items)),
              daoId: group.daoId,
              createdAt: group.createdAt,
            })
            .onConflict((oc) =>
              oc.column('id').doUpdateSet({
                name: group.name,
                items: JSON.stringify(sanitizeItems(group.items)),
                daoId: group.daoId,
                createdAt: group.createdAt,
              })
            )
            .execute();
        } else {
          await db
            .insertInto('proposalGroup')
            .values({
              name: group.name,
              items: JSON.stringify(sanitizeItems(group.items)),
              daoId: group.daoId,
              createdAt: group.createdAt,
            })
            .execute();
        }
      })
    );

    revalidateTag('groupsData');
    revalidateTag('ungroupedProposals');
  }, 'saveGroups');
}

/**
 * Creates a new empty proposal group
 */
export async function createGroup(
  daoSlug: string
): Promise<ServerActionVoidResult> {
  'use server';

  return handleVoidServerAction(async () => {
    const dao = await getDao(daoSlug);

    if (!dao) {
      throw new Error(`DAO not found: ${daoSlug}`);
    }

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

    revalidateTag('groupsData');
    revalidateTag('ungroupedProposals');
  }, 'createGroup');
}

/**
 * Deletes a group from the database
 */
export async function deleteGroup(groupId: string) {
  await db.deleteFrom('proposalGroup').where('id', '=', groupId).execute();

  revalidateTag('groupsData');
  revalidateTag('ungroupedProposals');
}

/**
 * Fetches DAO details by slug
 */
export async function getDao(daoSlug: string) {
  // 'use cache';
  // cacheLife('hours');

  const dao = await db
    .selectFrom('dao')
    .selectAll()
    .where('slug', '=', daoSlug)
    .executeTakeFirst();

  return dao;
}
