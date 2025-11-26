import { getActiveGroupsFeeds, getGroups } from '../actions';
import { GroupList } from '../components/group-list';
import { MarkAllAsReadButton } from '../components/mark-all-as-read';
import { Suspense } from 'react';
import { auth } from '@/lib/auth/auth';
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

  // Validate daoSlug early to prevent rendering with invalid data
  if (!daoSlug || !/^[-a-z0-9]{2,64}$/i.test(daoSlug)) {
    return (
      <div className='flex min-h-screen w-full items-center justify-center bg-neutral-50 dark:bg-neutral-900'>
        <div className='text-center'>
          <h1 className='text-2xl font-semibold text-neutral-700 dark:text-neutral-300'>
            Invalid DAO
          </h1>
          <p className='mt-2 text-neutral-500 dark:text-neutral-400'>
            Please use a valid subdomain (e.g., arbitrum.localhost:3000)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='flex min-h-screen w-full justify-center bg-neutral-50 dark:bg-neutral-900'>
      <div className='w-full max-w-5xl px-4 py-6 md:px-8 md:py-10'>
        {/* Single Suspense boundary for better Safari compatibility */}
        <Suspense
          fallback={
            <>
              <HeaderSkeleton />
              <LoadingGroupList />
            </>
          }
        >
          <GroupsHeader daoSlug={daoSlug} />
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
  const activeGroupsFeeds = await getActiveGroupsFeeds(activeGroupIds);

  // Transform data with pre-fetched feed data
  const groupsWithInfo = groups.map((group) => {
    const feedData = activeGroupsFeeds.get(group.id);

    return {
      id: group.id,
      name: group.name,
      slug: group.slug,
      authorName: group.originalAuthorName || 'Unknown',
      authorAvatarUrl:
        group.originalAuthorPicture ||
        'https://api.dicebear.com/9.x/pixel-art/png?seed=proposals.app',
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
