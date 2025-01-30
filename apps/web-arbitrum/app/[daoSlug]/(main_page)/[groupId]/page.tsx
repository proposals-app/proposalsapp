import { searchParamsCache } from '@/app/searchParams';
import { notFound, redirect, RedirectType } from 'next/navigation';
import { Suspense } from 'react';
import { getGroup_cached, getTotalVersions_cached } from './actions';
import Body, { BodyLoading } from './components/body/Body';
import Feed, { FeedLoading } from './components/feed/Feed';
import { MenuBar } from './components/menubar/MenuBar';
import { LoadingTimeline, Timeline } from './components/timeline/Timeline';

export default async function GroupPage({
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

  const latestVersion = totalVersions - 1;

  return (
    <div className='flex w-full flex-col items-center pt-10'>
      <div className='flex max-w-3xl flex-col overflow-visible'>
        <Suspense fallback={<BodyLoading />}>
          <Body group={group} version={version ?? latestVersion} diff={diff} />
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

      <Suspense fallback={<LoadingTimeline />}>
        <Timeline group={group} commentsFilter={comments} votesFilter={votes} />
      </Suspense>
    </div>
  );
}
