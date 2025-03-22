import { ProposalGroupItem } from '@/lib/types';
import { getGroupHeader, getGroups } from './actions';
import { GroupList, LoadingGroupList } from './components/group-list';
import { MarkAllAsReadButton } from './components/mark-all-as-read';
import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export default async function ListPage({
  params,
}: {
  params: Promise<{ daoSlug: string }>;
}) {
  const { daoSlug } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;

  const result = await getGroups(daoSlug, userId);

  if (!result) {
    return null;
  }

  const { daoName, groups } = result;

  // Fetch author information for each group and transform data
  const groupsWithAuthorInfo = await Promise.all(
    groups.map(async (group) => {
      const authorInfo = await getGroupHeader(group.id);
      const items = group.items as ProposalGroupItem[];
      const proposalsCount = items.filter(
        (item) => item.type === 'proposal'
      ).length;
      const commentsCount = items.filter(
        (item) => item.type === 'topic'
      ).length;

      return {
        id: group.id,
        name: group.name,
        slug: `${group.id}`,
        authorName: authorInfo.originalAuthorName,
        authorAvatarUrl: authorInfo.originalAuthorPicture,
        latestActivityAt: new Date(group.newestActivityTimestamp),
        hasNewActivity: group.hasNewActivity,
        hasActiveProposal: group.hasActiveProposal,
        commentsCount,
        proposalsCount,
      };
    })
  );

  const hasNewActivityInGroups = groupsWithAuthorInfo.some(
    (group) => group.hasNewActivity
  );

  return (
    <div className='flex min-h-screen w-full flex-row'>
      <div className='flex w-full flex-col gap-2 p-4 sm:p-6 md:p-8'>
        <h1
          className='mb-6 text-2xl font-bold text-neutral-700 sm:mb-8 sm:text-4xl
            dark:text-neutral-200'
        >
          {daoName || daoSlug}
        </h1>

        {hasNewActivityInGroups && (
          <div className='mb-4 self-end'>
            <MarkAllAsReadButton />
          </div>
        )}

        <Suspense fallback={<LoadingGroupList />}>
          <GroupList groups={groupsWithAuthorInfo} />
        </Suspense>
      </div>
    </div>
  );
}
