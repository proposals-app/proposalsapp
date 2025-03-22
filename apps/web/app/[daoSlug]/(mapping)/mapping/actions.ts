'use server';

import Fuse from 'fuse.js';
import { dbIndexer } from '@proposalsapp/db-indexer';
import { AsyncReturnType } from '@/lib/utils';
import { cacheLife } from 'next/dist/server/use-cache/cache-life';
import { cacheTag } from 'next/dist/server/use-cache/cache-tag';
import { revalidateTag } from 'next/cache';

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
  'use cache';
  cacheTag('groupsData');

  const dao = await dbIndexer
    .selectFrom('dao')
    .where('slug', '=', daoSlug)
    .selectAll()
    .executeTakeFirstOrThrow();

  const proposalGroups = await dbIndexer
    .selectFrom('proposalGroup')
    .where('daoId', '=', dao.id)
    .selectAll()
    .orderBy('createdAt', 'desc')
    .execute();

  const groupsWithItems = await Promise.all(
    proposalGroups.map(async (group) => {
      const items = group.items as ProposalGroupItem[];
      const itemsWithIndexerName = await Promise.all(
        items.map(async (item) => {
          let indexerName = 'unknown';

          if (item.type === 'proposal') {
            const proposal = await dbIndexer
              .selectFrom('proposal')
              .leftJoin('daoGovernor', 'daoGovernor.id', 'proposal.governorId')
              .select('daoGovernor.name as governorName')
              .where('proposal.externalId', '=', item.externalId)
              .where('proposal.governorId', '=', item.governorId)
              .executeTakeFirst();
            indexerName = proposal?.governorName ?? 'unknown';
          } else if (item.type === 'topic') {
            const topic = await dbIndexer
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
  'use cache';
  cacheTag('ungroupedProposals');

  const dao = await dbIndexer
    .selectFrom('dao')
    .where('slug', '=', daoSlug)
    .selectAll()
    .executeTakeFirstOrThrow();

  const allProposals = await dbIndexer
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

  const groups = await dbIndexer
    .selectFrom('proposalGroup')
    .select('items')
    .execute();

  // Extract all proposal IDs that are already in groups
  const groupedProposalIds = (
    await Promise.all(
      groups.map(async (group) => {
        const items = group.items as ProposalGroupItem[];
        const proposalsIds = await Promise.all(
          items.map(async (item) => {
            if (item.type === 'proposal') {
              const proposal = await dbIndexer
                .selectFrom('proposal')
                .select(['id', 'proposal.governorId'])
                .where('proposal.externalId', '=', item.externalId)
                .where('proposal.governorId', '=', item.governorId)
                .executeTakeFirst();
              return proposal?.id;
            }
            return undefined;
          })
        );

        return proposalsIds.filter(
          (proposalId): proposalId is string => proposalId !== undefined
        );
      })
    )
  ).flat();

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
  'use cache';
  cacheTag(`fuzzy-group-${searchTerm}`);

  const dao = await dbIndexer
    .selectFrom('dao')
    .where('slug', '=', daoSlug)
    .selectAll()
    .executeTakeFirstOrThrow();

  const daoDiscourse = await dbIndexer
    .selectFrom('daoDiscourse')
    .where('daoId', '=', dao.id)
    .selectAll()
    .executeTakeFirst();

  if (!searchTerm.trim() || !daoDiscourse) {
    return [];
  }

  const [proposals, topics] = await Promise.all([
    dbIndexer
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
    dbIndexer
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

  const allItems: (Omit<FuzzySearchResult, 'score'> & { score?: number })[] = [
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
export async function saveGroups(groups: ProposalGroup[]) {
  await Promise.all(
    groups.map(async (group) => {
      if (group.id) {
        await dbIndexer
          .insertInto('proposalGroup')
          .values({
            id: group.id,
            name: group.name,
            items: JSON.stringify(group.items),
            daoId: group.daoId,
            createdAt: group.createdAt,
          })
          .onConflict((oc) =>
            oc.column('id').doUpdateSet({
              name: group.name,
              items: JSON.stringify(group.items),
              daoId: group.daoId,
              createdAt: group.createdAt,
            })
          )
          .execute();
      } else {
        await dbIndexer
          .insertInto('proposalGroup')
          .values({
            name: group.name,
            items: JSON.stringify(group.items),
            daoId: group.daoId,
            createdAt: group.createdAt,
          })
          .execute();
      }
    })
  );

  revalidateTag('groupsData');
  revalidateTag('ungroupedProposals');
}

/**
 * Deletes a group from the database
 */
export async function deleteGroup(groupId: string) {
  await dbIndexer
    .deleteFrom('proposalGroup')
    .where('id', '=', groupId)
    .execute();

  revalidateTag('groupsData');
  revalidateTag('ungroupedProposals');
}

/**
 * Fetches DAO details by slug
 */
export async function getDao(daoSlug: string) {
  'use cache';
  cacheLife('hours');

  const dao = await dbIndexer
    .selectFrom('dao')
    .selectAll()
    .where('slug', '=', daoSlug)
    .executeTakeFirstOrThrow();

  return dao;
}
