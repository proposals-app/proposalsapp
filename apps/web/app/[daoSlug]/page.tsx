import { ProposalGroupItem } from '@/lib/types';
import {
  getGroupHeader,
  getGroups,
  getMarketCap,
  getTokenPrice,
  getTreasuryBalance,
} from './actions';
import { GroupList, LoadingGroupList } from './components/group-list';
import { MarkAllAsReadButton } from './components/mark-all-as-read';
import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { ActiveGroupItem } from './components/group-items/active-item';
import { DaoSummaryHeader } from './components/dao-summary-header';

export default async function Page({
  params,
}: {
  params: Promise<{ daoSlug: string }>;
}) {
  return (
    // <Loading />
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
      const topicsCount = items.filter((item) => item.type === 'topic').length;

      const groupItem = {
        id: group.id,
        name: group.name,
        slug: `${group.id}`,
        authorName: authorInfo.originalAuthorName,
        authorAvatarUrl: authorInfo.originalAuthorPicture,
        latestActivityAt: new Date(group.newestActivityTimestamp),
        hasNewActivity: group.hasNewActivity,
        hasActiveProposal: group.hasActiveProposal,
        topicsCount,
        proposalsCount,
        votesCount: group.votesCount,
        postsCount: group.postsCount,
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
        topicsCount,
        proposalsCount,
        votesCount: group.votesCount,
        postsCount: group.postsCount,
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
  const totalTopicsCount = groupsWithAuthorInfo.reduce(
    (sum, group) => sum + group.topicsCount,
    0
  );

  // Fetch financial data
  const tokenPrice = await getTokenPrice(daoSlug);
  const marketCap = await getMarketCap(daoSlug);
  const treasuryBalance = await getTreasuryBalance(daoSlug);

  return (
    <div className='flex min-h-screen w-full justify-center bg-neutral-50 dark:bg-neutral-900'>
      <div className='w-full max-w-5xl px-4 py-6 md:px-8 md:py-10'>
        <DaoSummaryHeader
          daoName={daoName}
          daoSlug={daoSlug}
          activeGroupsCount={activeGroupsCount}
          totalProposalsCount={totalProposalsCount}
          totalTopicsCount={totalTopicsCount}
          tokenPrice={tokenPrice}
          marketCap={marketCap}
          treasuryBalance={treasuryBalance}
        />

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
      <div className='w-full max-w-5xl px-4 py-6 md:px-8 md:py-10'>
        {/* DAO Summary Header Skeleton */}
        <div className='mb-8 overflow-hidden border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-800/50'>
          <div className='flex w-full flex-row'>
            {/* Left side - Main content and primary metrics */}
            <div className='flex w-full flex-col content-between justify-between'>
              {/* Header content */}
              <div className='p-6'>
                <div className='flex flex-row items-center space-y-0 space-x-4 sm:space-x-8'>
                  <div className='relative flex h-12 w-12 animate-pulse items-center justify-center rounded-full border border-neutral-200 bg-neutral-200 p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-700'></div>

                  <div className='flex-1'>
                    <div className='h-6 w-32 animate-pulse bg-neutral-200 dark:bg-neutral-700'></div>
                    <div className='mt-2 h-4 w-32 animate-pulse bg-neutral-200 dark:bg-neutral-700'></div>
                    <div className='mt-2 h-4 w-32 animate-pulse bg-neutral-200 dark:bg-neutral-700'></div>
                    <div className='mt-2 h-4 w-32 animate-pulse bg-neutral-200 dark:bg-neutral-700'></div>
                  </div>
                </div>
              </div>

              {/* Primary metrics */}
              <div className='flex w-full items-start'>
                <div className='mt-auto border-t border-r border-neutral-200 dark:border-neutral-700'>
                  <div className='flex divide-x divide-neutral-200 dark:divide-neutral-700'>
                    {['Active', 'Proposals', 'Discussions'].map(
                      (label, index) => (
                        <div
                          key={label}
                          className={`flex w-1/3 flex-1 flex-col items-center justify-center p-4 text-center ${index % 2 === 0 ? 'bg-neutral-50 dark:bg-neutral-900/20' : 'bg-white dark:bg-neutral-800/50'} animate-pulse`}
                        >
                          <div className='mb-1 h-6 w-8 bg-neutral-200 dark:bg-neutral-700'></div>
                          <div className='h-4 w-12 bg-neutral-200 dark:bg-neutral-700'></div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right side - Financial metrics */}
            <div className='flex flex-col divide-y divide-neutral-200 border-l border-neutral-200 dark:divide-neutral-700 dark:border-neutral-700'>
              {['Token Price', 'Market Cap', 'Treasury'].map((label, index) => (
                <div
                  key={label}
                  className={`flex h-1/3 flex-1 flex-col items-center justify-center p-4 ${index % 2 === 0 ? 'bg-neutral-50 dark:bg-neutral-900/20' : 'bg-white dark:bg-neutral-800/50'} animate-pulse`}
                >
                  <div className='mb-1 h-6 w-10 bg-neutral-200 dark:bg-neutral-700'></div>
                  <div className='h-4 w-14 bg-neutral-200 dark:bg-neutral-700'></div>
                </div>
              ))}
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
