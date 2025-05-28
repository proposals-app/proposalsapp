import { getGroups } from './actions';
import { GroupList } from './components/group-list';
import { MarkAllAsReadButton } from './components/mark-all-as-read';
import { Suspense } from 'react';
import { auth } from '@/lib/auth/arbitrum_auth';
import { headers } from 'next/headers';
import { ActiveGroupItem } from './components/group-items/active-item';
import Loading, { LoadingGroupList } from './loading';

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ daoSlug: string }>;
  searchParams: Promise<{ daoSlug?: string }>;
}) {
  return (
    <Suspense fallback={<Loading />}>
      <GroupsPage params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function GroupsPage({
  params,
  searchParams,
}: {
  params: Promise<{ daoSlug: string }>;
  searchParams: Promise<{ daoSlug?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;

  // Get daoSlug from searchParams (set by middleware) or from route params
  let daoSlug: string;

  const resolvedSearchParams = await searchParams;
  const routeParams = await params;

  if (resolvedSearchParams.daoSlug) {
    // When coming from subdomain via middleware
    daoSlug = resolvedSearchParams.daoSlug;
  } else {
    // When accessed directly via path
    daoSlug = routeParams.daoSlug;
  }

  const result = await getGroups(daoSlug, userId);

  if (!result) {
    return null;
  }

  const { groups } = result;

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

  return (
    <div className='flex min-h-screen w-full justify-center bg-neutral-50 dark:bg-neutral-900'>
      <div className='w-full max-w-5xl px-4 py-6 md:px-8 md:py-10'>
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
