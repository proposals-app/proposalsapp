'use server';

import { ProposalGroup, ProposalGroupItem } from '@/lib/types';
import { AsyncReturnType } from '@/lib/utils';
import { db } from '@proposalsapp/db-indexer';
import Fuse from 'fuse.js';
import { revalidatePath } from 'next/cache';

export async function getGroupsData(daoSlug: string) {
  const dao = await db
    .selectFrom('dao')
    .where('slug', '=', daoSlug)
    .selectAll()
    .executeTakeFirstOrThrow();

  const proposalGroups = await db
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

export async function getUngroupedProposals(
  daoSlug: string
): Promise<(ProposalGroupItem & { indexerName: string })[]> {
  const dao = await db
    .selectFrom('dao')
    .where('slug', '=', daoSlug)
    .selectAll()
    .executeTakeFirstOrThrow();

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

  const groups = await db.selectFrom('proposalGroup').select('items').execute();

  const groupedProposalIds = (
    await Promise.all(
      groups.map(async (group) => {
        const items = group.items as ProposalGroupItem[];
        const proposalsIds = await Promise.all(
          items.map(async (item) => {
            if (item.type === 'proposal') {
              const proposal = await db
                .selectFrom('proposal')
                .select(['id', 'proposal.governorId'])
                .where('proposal.externalId', '=', item.externalId)
                .where('proposal.governorId', '=', item.governorId)
                .executeTakeFirstOrThrow();
              return proposal.id;
            }
            return undefined;
          })
        );

        return proposalsIds.filter((proposalId) => proposalId !== undefined);
      })
    )
  ).flat();

  const uniqueGroupedIds = [...new Set(groupedProposalIds)];

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

export type UngroupedProposalsReturnType = AsyncReturnType<
  typeof getUngroupedProposals
>;
export type GroupsDataReturnType = AsyncReturnType<typeof getGroupsData>;

export interface FuzzyItem {
  id: string;
  type: 'proposal' | 'topic';
  name: string;
  external_id?: string;
  dao_discourse_id?: string;
  governor_id?: string;
  score: number;
}

export async function fuzzySearchItems(
  searchTerm: string,
  daoSlug: string
): Promise<FuzzyItem[]> {
  const dao = await db
    .selectFrom('dao')
    .where('slug', '=', daoSlug)
    .selectAll()
    .executeTakeFirstOrThrow();

  const daoDiscourse = await db
    .selectFrom('daoDiscourse')
    .where('daoId', '=', dao.id)
    .selectAll()
    .executeTakeFirstOrThrow();

  const [proposals, topics] = await Promise.all([
    db
      .selectFrom('proposal')
      .where('markedSpam', '=', false)
      .where('proposal.daoId', '=', dao.id)
      .leftJoin('daoGovernor', 'daoGovernor.id', 'proposal.governorId')
      .select([
        'proposal.id',
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
      .select(['discourseTopic.id', 'title', 'daoDiscourse.discourseBaseUrl'])
      .execute(),
  ]);

  const allItems: FuzzyItem[] = [
    ...proposals.map((p) => ({
      id: p.id.toString(),
      name: p.proposalName,
      type: 'proposal' as const,
      indexerName: p.governorName ?? 'unknown',
      score: 1,
    })),
    ...topics.map((t) => ({
      id: t.id.toString(),
      name: t.title,
      type: 'topic' as const,
      indexerName: t.discourseBaseUrl ?? 'unknown',
      score: 1,
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

export async function saveGroups(groups: ProposalGroup[]) {
  await Promise.all(
    groups.map(async (group) => {
      if (group.id) {
        await db
          .insertInto('proposalGroup')
          .values({
            id: group.id,
            name: group.name,
            items: JSON.stringify(group.items),
          })
          .onConflict((oc) =>
            oc.column('id').doUpdateSet({
              name: group.name,
              items: JSON.stringify(group.items),
            })
          )
          .execute();
      } else {
        await db
          .insertInto('proposalGroup')
          .values({
            name: group.name,
            items: JSON.stringify(group.items),
          })
          .execute();
      }
    })
  );

  revalidatePath('/mapping');
}

export async function deleteGroup(groupId: string) {
  await db.deleteFrom('proposalGroup').where('id', '=', groupId).execute();
  revalidatePath('/mapping');
}
