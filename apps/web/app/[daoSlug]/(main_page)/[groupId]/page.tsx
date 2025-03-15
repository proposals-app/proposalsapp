import { searchParamsCache } from '@/app/searchParams';
import { notFound } from 'next/navigation';
import {
  getGroup_cached,
  getBodyVersions_cached,
  getFeed_cached,
} from './actions';
import { Body, BodyLoading } from './components/body/Body';
import { Feed, FeedLoading } from './components/feed/Feed';
import { MenuBar } from './components/menubar/MenuBar';
import { Timeline } from './components/timeline/Timeline';
import { Suspense } from 'react';

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ daoSlug: string; groupId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { daoSlug, groupId } = await params;

  const [group, bodyVersions] = await Promise.all([
    getGroup_cached(daoSlug, groupId),
    getBodyVersions_cached(groupId),
  ]);

  if (!group || !bodyVersions) {
    notFound();
  }

  const bodyVersionsWithoutContent = bodyVersions.map((body) => ({
    ...body,
    content: '',
  }));

  const {
    version,
    feed: feedFilter,
    votes: votesFilter,
    diff,
  } = await searchParamsCache.parse(searchParams);

  // Always use the latest version if no version is specified
  const currentVersion = version ?? bodyVersions.length - 1;

  const feed = await getFeed_cached(group.group.id, feedFilter, votesFilter);

  return (
    <div className='flex w-full flex-col items-center pt-10'>
      <div className='flex max-w-3xl flex-col overflow-visible'>
        <Suspense fallback={<BodyLoading />}>
          <Body
            group={group}
            diff={diff}
            bodyVersions={bodyVersions}
            currentVersion={currentVersion}
          />
        </Suspense>

        <Suspense>
          <MenuBar
            bodyVersions={bodyVersionsWithoutContent}
            currentVersion={currentVersion}
          />
        </Suspense>

        <Suspense fallback={<FeedLoading />}>
          <Feed group={group} feed={feed} />
        </Suspense>
      </div>

      <Suspense>
        <Timeline
          events={feed.events}
          group={group}
          feedFilter={feedFilter}
          votesFilter={votesFilter}
        />
      </Suspense>
    </div>
  );
}
