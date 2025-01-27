import { searchParamsCache } from '@/app/searchParams';
import { notFound, redirect, RedirectType } from 'next/navigation';
import { Suspense } from 'react';
import { getGroup_cached, getTotalVersions_cached } from './actions';
import Body, { BodyLoading } from './components/body/Body';
import Feed, { FeedLoading } from './components/feed/Feed';
import { MenuBar } from './components/menubar/MenuBar';
import { LoadingTimeline, Timeline } from './components/timeline/Timeline';

export default async function ProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ daoSlug: string; groupId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { daoSlug, groupId } = await params;

  const [group, totalVersions] = await Promise.all([
    getGroup_cached(daoSlug, groupId),
    getTotalVersions_cached(groupId),
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
