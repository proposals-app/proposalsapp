import {
  getGroups,
  getTotalVotingPower,
  getTokenPrice,
  getTreasuryBalance,
} from './actions';
import { GroupList } from './components/group-list';
import { MarkAllAsReadButton } from './components/mark-all-as-read';
import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { ActiveGroupItem } from './components/group-items/active-item';
import { DaoSummaryHeader } from './components/dao-summary-header';
import Loading, { LoadingGroupList, LoadingHeader } from './loading';

export default async function Page({
  params,
}: {
  params: Promise<{ daoSlug: string }>;
}) {
  return (
    <Suspense fallback={<Loading />}>
      <GroupsPage params={params} />
    </Suspense>
  );
}

async function GroupsPage({
  params,
}: {
  params: Promise<{ daoSlug: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;

  const { daoSlug } = await params;

  const result = await getGroups(daoSlug, userId);

  if (!result) {
    return null;
  }

  const { daoName, groups } = result;

  // Transform data - items no longer needed here
  const groupsWithInfo = groups.map((group) => {
    const groupItem = {
      id: group.id,
      name: group.name,
      slug: `${group.id}`,
      authorName: group.originalAuthorName,
      authorAvatarUrl: group.originalAuthorPicture,
      latestActivityAt: new Date(group.newestActivityTimestamp),
      hasNewActivity: group.hasNewActivity,
      hasActiveProposal: group.hasActiveProposal,
      topicsCount: group.topicsCount,
      proposalsCount: group.proposalsCount,
      votesCount: group.votesCount,
      postsCount: group.postsCount,
    };
    return {
      ...groupItem,
      resultCard: group.hasActiveProposal ? (
        <ActiveGroupItem group={groupItem} />
      ) : null,
    };
  });

  const hasNewActivityInGroups = groupsWithInfo.some(
    (group) => group.hasNewActivity
  );

  // Get active and inactive groups counts
  const activeGroupsCount = groupsWithInfo.filter(
    (g) => g.hasActiveProposal
  ).length;
  const totalProposalsCount = groupsWithInfo.reduce(
    (sum, group) => sum + group.proposalsCount,
    0
  );
  const totalTopicsCount = groupsWithInfo.reduce(
    (sum, group) => sum + group.topicsCount,
    0
  );

  // Fetch financial data
  const tokenPrice = await getTokenPrice(daoSlug);
  const totalVp = await getTotalVotingPower(result.daoId);
  const treasuryBalance = await getTreasuryBalance(daoSlug);

  return (
    <div className='flex min-h-screen w-full justify-center bg-neutral-50 dark:bg-neutral-900'>
      <div className='w-full max-w-5xl px-4 py-6 md:px-8 md:py-10'>
        <Suspense fallback={<LoadingHeader />}>
          <DaoSummaryHeader
            daoName={daoName}
            daoSlug={daoSlug}
            activeGroupsCount={activeGroupsCount}
            totalProposalsCount={totalProposalsCount}
            totalTopicsCount={totalTopicsCount}
            tokenPrice={tokenPrice}
            totalVp={totalVp}
            treasuryBalance={treasuryBalance}
          />
        </Suspense>

        {/* Action Bar */}
        <div className='mb-6 flex flex-col items-start justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0'>
          <h2 className='text-xl font-semibold text-neutral-700 dark:text-neutral-300'>
            All Proposal Groups
          </h2>
          {hasNewActivityInGroups && <MarkAllAsReadButton />}
        </div>

        {/* Groups List */}
        <Suspense fallback={<LoadingGroupList />}>
          <GroupList groups={groupsWithInfo} signedIn={userId ? true : false} />
        </Suspense>
      </div>
    </div>
  );
}
