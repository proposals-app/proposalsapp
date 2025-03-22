import { ProposalGroupItem } from '@/lib/types';
import { getGroupHeader, getGroups } from './actions';
import { GroupList } from './components/group-list';
import { MarkAllAsReadButton } from './components/mark-all-as-read';
import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export default async function Page({
  params,
}: {
  params: Promise<{ daoSlug: string }>;
}) {
  return (
    <Suspense fallback={<Loading />}>
      <DaoPage params={params} />
    </Suspense>
  );
}

async function DaoPage({ params }: { params: Promise<{ daoSlug: string }> }) {
  const { daoSlug } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;

  return <GroupsList daoSlug={daoSlug} userId={userId} />;
}

async function GroupsList({
  daoSlug,
  userId,
}: {
  daoSlug: string;
  userId?: string;
}) {
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
        <h1 className='mb-6 text-2xl font-bold text-neutral-700 sm:mb-8 sm:text-4xl dark:text-neutral-200'>
          {daoName || daoSlug}
        </h1>

        {hasNewActivityInGroups && (
          <div className='mb-4 self-end'>
            <MarkAllAsReadButton />
          </div>
        )}

        <GroupList groups={groupsWithAuthorInfo} />
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className='flex min-h-screen w-full flex-row'>
      <div className='flex w-full flex-col gap-2 p-8'>
        {/* Skeleton loader for the DAO name */}
        <div className='mb-8 h-12 w-80 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-700'></div>

        {/* Skeleton loader for MarkAllAsReadButton - align right */}
        {/* <div className='mb-4 self-end'>
          <div className='h-8 w-32 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-700'></div>
        </div> */}

        {/* Skeleton loaders for the group list items, more like cards */}
        <div className='space-y-4'>
          {Array(12) // Adjust number of loading items as needed, 4 seems reasonable
            .fill(0)
            .map((_, index) => (
              <div
                key={index}
                className='flex space-x-4 border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900'
              >
                {/* Avatar Skeleton */}
                <div className='h-12 w-12 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700'></div>

                <div className='flex flex-col justify-center space-y-2'>
                  {/* Group Name Skeleton */}
                  <div className='h-6 w-64 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-700'></div>
                  {/* Meta info line (Date, Counts) Skeleton */}
                  <div className='flex space-x-2'>
                    <div className='h-4 w-24 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-800'></div>
                    <div className='h-4 w-16 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-800'></div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
