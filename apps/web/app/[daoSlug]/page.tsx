import { ProposalGroupItem } from '@/lib/types';
import { getGroupHeader, getGroups } from './actions';
import { GroupList, LoadingGroupList } from './components/group-list';
import { MarkAllAsReadButton } from './components/mark-all-as-read';
import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { ActiveGroupItem } from './components/group-items/active-item';
import Image from 'next/image';

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

      const groupItem = {
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
        resultCard: group.hasActiveProposal ? (
          <ActiveGroupItem group={groupItem} />
        ) : null,
      };
    })
  );

  const hasNewActivityInGroups = groupsWithAuthorInfo.some(
    (group) => group.hasNewActivity
  );

  // Get active and inactive groups counts
  const activeGroupsCount = groupsWithAuthorInfo.filter(
    (g) => g.hasActiveProposal
  ).length;
  const totalProposalsCount = groupsWithAuthorInfo.reduce(
    (sum, group) => sum + group.proposalsCount,
    0
  );
  const totalCommentsCount = groupsWithAuthorInfo.reduce(
    (sum, group) => sum + group.commentsCount,
    0
  );

  const DAO_PICTURE_PATH = 'assets/project-logos/arbitrum';

  return (
    <div className='flex min-h-screen w-full justify-center bg-neutral-50 dark:bg-neutral-900'>
      <div className='w-full max-w-3xl px-4 py-6 md:px-8 md:py-10'>
        {/* DAO Summary Header */}
        <div className='mb-8 border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800'>
          <div className='flex flex-col items-start space-y-6 md:flex-row md:items-center md:space-y-0 md:space-x-6'>
            <div className='flex h-16 w-16 items-center justify-center bg-neutral-100 p-2 md:h-20 md:w-20 dark:bg-neutral-700'>
              <Image
                src={`${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/${DAO_PICTURE_PATH}.svg`}
                alt={daoName || daoSlug}
                width={64}
                height={64}
                className='dark:hidden'
              />
              <Image
                src={`${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/${DAO_PICTURE_PATH}_dark.svg`}
                alt={daoName || daoSlug}
                width={64}
                height={64}
                className='hidden dark:block'
              />
            </div>

            <div>
              <h1 className='text-2xl font-bold text-neutral-800 sm:text-3xl dark:text-neutral-100'>
                {daoName || daoSlug}
              </h1>
              <p className='mt-1 text-sm text-neutral-500 dark:text-neutral-400'>
                Governance discussions and proposals
              </p>

              <div className='mt-4 flex flex-wrap gap-6'>
                <div className='flex flex-col'>
                  <span className='text-lg font-bold text-neutral-800 dark:text-neutral-200'>
                    {groups.length}
                  </span>
                  <span className='text-xs text-neutral-500 dark:text-neutral-400'>
                    Groups
                  </span>
                </div>
                <div className='flex flex-col'>
                  <span className='text-lg font-bold text-green-700 dark:text-green-400'>
                    {activeGroupsCount}
                  </span>
                  <span className='text-xs text-neutral-500 dark:text-neutral-400'>
                    Active
                  </span>
                </div>
                <div className='flex flex-col'>
                  <span className='text-lg font-bold text-blue-700 dark:text-blue-400'>
                    {totalProposalsCount}
                  </span>
                  <span className='text-xs text-neutral-500 dark:text-neutral-400'>
                    Proposals
                  </span>
                </div>
                <div className='flex flex-col'>
                  <span className='text-lg font-bold text-neutral-800 dark:text-neutral-200'>
                    {totalCommentsCount}
                  </span>
                  <span className='text-xs text-neutral-500 dark:text-neutral-400'>
                    Discussions
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className='mb-6 flex flex-col items-start justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0'>
          <h2 className='text-xl font-semibold text-neutral-700 dark:text-neutral-300'>
            All Proposal Groups
          </h2>
          {hasNewActivityInGroups && <MarkAllAsReadButton />}
        </div>

        {/* Groups List */}
        <Suspense fallback={<LoadingGroupList />}>
          <GroupList groups={groupsWithAuthorInfo} />
        </Suspense>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className='flex min-h-screen w-full justify-center bg-neutral-50 dark:bg-neutral-900'>
      <div className='w-full max-w-3xl px-4 py-6 md:px-8 md:py-10'>
        {/* DAO Summary Header Skeleton */}
        <div className='mb-8 border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800'>
          <div className='flex flex-col items-start space-y-6 md:flex-row md:items-center md:space-y-0 md:space-x-6'>
            <div className='h-16 w-16 animate-pulse bg-neutral-200 md:h-20 md:w-20 dark:bg-neutral-700'></div>

            <div className='w-full md:w-auto'>
              <div className='h-8 w-64 animate-pulse bg-neutral-200 dark:bg-neutral-700'></div>
              <div className='mt-2 h-4 w-48 animate-pulse bg-neutral-200 dark:bg-neutral-700'></div>

              <div className='mt-4 flex flex-wrap gap-6'>
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className='h-12 w-16 animate-pulse bg-neutral-200 dark:bg-neutral-700'
                  ></div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar Skeleton */}
        <div className='mb-6 flex flex-col items-start justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0'>
          <div className='h-8 w-48 animate-pulse bg-neutral-200 dark:bg-neutral-700'></div>
          <div className='h-8 w-32 animate-pulse bg-neutral-200 dark:bg-neutral-700'></div>
        </div>

        {/* Groups List Skeleton */}
        <LoadingGroupList />
      </div>
    </div>
  );
}
