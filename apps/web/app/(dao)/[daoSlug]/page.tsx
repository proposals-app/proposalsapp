import { getActiveGroupsFeeds, getGroups } from './actions';
import { GroupList } from './components/group-list';
import { MarkAllAsReadButton } from './components/mark-all-as-read';
import { Suspense } from 'react';
import { auth } from '@/lib/auth/arbitrum_auth';
import { headers } from 'next/headers';
import {
  SkeletonText,
  SkeletonButton,
  LoadingGroupList,
} from '@/app/components/ui/skeleton';

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ daoSlug: string }>;
  searchParams: Promise<{ daoSlug?: string }>;
}) {
  // Get daoSlug from searchParams (set by middleware) or from route params
  const resolvedSearchParams = await searchParams;
  const routeParams = await params;

  const daoSlug = resolvedSearchParams.daoSlug || routeParams.daoSlug;

  return (
    <div className='flex min-h-screen w-full justify-center bg-neutral-50 dark:bg-neutral-900'>
      <div className='w-full max-w-5xl px-4 py-6 md:px-8 md:py-10'>
        {/* Header with title and mark all as read button */}
        <Suspense fallback={<HeaderSkeleton />}>
          <GroupsHeader daoSlug={daoSlug} />
        </Suspense>

        {/* Groups List */}
        <Suspense fallback={<LoadingGroupList />}>
          <GroupsContent daoSlug={daoSlug} />
        </Suspense>
      </div>
    </div>
  );
}

// Separate component for header to enable streaming
async function GroupsHeader({ daoSlug }: { daoSlug: string }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;

  const result = await getGroups(daoSlug, userId);

  if (!result) {
    return null;
  }

  const hasNewActivityInGroups = result.groups.some(
    (group) => group.hasNewActivity
  );

  return (
    <div className='mb-6 flex flex-col items-start justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0'>
      <h2 className='text-xl font-semibold text-neutral-700 dark:text-neutral-300'>
        All Proposal Groups
      </h2>
      {hasNewActivityInGroups && <MarkAllAsReadButton daoSlug={daoSlug} />}
    </div>
  );
}

// Main content component that fetches all data in parallel
async function GroupsContent({ daoSlug }: { daoSlug: string }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;

  const result = await getGroups(daoSlug, userId);

  if (!result) {
    return null;
  }

  const { groups } = result;

  // Get IDs of groups with active proposals
  const activeGroupIds = groups
    .filter((group) => group.hasActiveProposal)
    .map((group) => group.id);

  // Fetch all active group feeds in parallel
  const activeGroupsFeeds = await getActiveGroupsFeeds(activeGroupIds, daoSlug);

  // Transform data with pre-fetched feed data
  const groupsWithInfo = groups.map((group) => {
    const feedData = activeGroupsFeeds.get(group.id);

    return {
      id: group.id,
      name: group.name,
      slug: group.slug,
      authorName: group.originalAuthorName,
      authorAvatarUrl: group.originalAuthorPicture,
      latestActivityAt: new Date(group.newestActivityTimestamp),
      hasNewActivity: group.hasNewActivity,
      hasActiveProposal: group.hasActiveProposal,
      topicsCount: group.topicsCount,
      proposalsCount: group.proposalsCount,
      votesCount: group.votesCount,
      postsCount: group.postsCount,
      // Pre-computed feed data for active groups
      activeFeedData: feedData || null,
    };
  });

  return (
    <GroupList
      initialGroups={groupsWithInfo}
      signedIn={userId ? true : false}
    />
  );
}

// Enhanced header skeleton for loading state
function HeaderSkeleton() {
  return (
    <div className='flex flex-col items-start justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0'>
      <SkeletonText width='12rem' size='lg' />
      <SkeletonButton size='md' />
    </div>
  );
}
