import { notFound, redirect, RedirectType } from 'next/navigation';
import { unstable_cache } from 'next/cache';
import { getGroupData, getTotalVersions } from './actions';
import Body, { BodyLoading } from './components/body/Body';
import { searchParamsCache } from '@/app/searchParams';
import { MenuBar } from './components/menubar/MenuBar';
import Feed, { FeedLoading } from './components/feed/Feed';
import { LoadingTimeline, Timeline } from './components/timeline/Timeline';
import { Suspense } from 'react';

// Cache the getGroupData function
const cachedGetGroupData = unstable_cache(
  async (daoSlug: string, groupId: string) => {
    return await getGroupData(daoSlug, groupId);
  },
  ['group-data'],
  { revalidate: 60 * 5, tags: ['group-data'] }
);

// Cache the getTotalVersions function
const cachedGetTotalVersions = unstable_cache(
  async (groupId: string) => {
    return await getTotalVersions(groupId);
  },
  ['total-versions'],
  { revalidate: 60 * 5, tags: ['total-versions'] }
);

export default async function ProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ daoSlug: string; groupId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { daoSlug, groupId } = await params;

  const [group, totalVersions] = await Promise.all([
    cachedGetGroupData(daoSlug, groupId),
    cachedGetTotalVersions(groupId),
  ]);

  if (!group || !totalVersions) {
    notFound();
  }

  const { version, comments, votes, diff, page } =
    await searchParamsCache.parse(searchParams);

  if (version === null) {
    const latestVersion = totalVersions - 1;
    redirect(
      `/${daoSlug}/${groupId}?version=${latestVersion}`,
      RedirectType.push
    );
  }

  return (
    <div className='flex min-h-screen w-full flex-row'>
      <div className='flex w-full justify-between lg:pr-80'>
        <div className='mx-auto flex w-2/3 flex-col justify-center'>
          <Suspense fallback={<BodyLoading />}>
            <Body group={group} version={version ?? 0} diff={diff} />
          </Suspense>

          <MenuBar totalVersions={totalVersions ?? 1} />

          <Suspense fallback={<FeedLoading />}>
            <Feed
              group={group}
              commentsFilter={comments}
              votesFilter={votes}
              page={page ? Number(page) : 1}
            />
          </Suspense>
        </div>

        <div className='hidden lg:flex'>
          <Suspense fallback={<LoadingTimeline />}>
            <Timeline
              group={group}
              commentsFilter={comments}
              votesFilter={votes}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
