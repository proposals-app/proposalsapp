import { searchParamsCache } from '@/app/searchParams';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import {
  VersionType,
  getGroup_cached,
  getTotalVersions_cached,
  getBodies_cached,
} from './actions';
import Body, { BodyLoading } from './components/body/Body';
import Feed, { FeedLoading } from './components/feed/Feed';
import { MenuBar } from './components/menubar/MenuBar';
import { Timeline } from './components/timeline/Timeline';

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ daoSlug: string; groupId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { daoSlug, groupId } = await params;

  const [group, totalVersions, bodies] = await Promise.all([
    getGroup_cached(daoSlug, groupId),
    getTotalVersions_cached(groupId),
    getBodies_cached(groupId),
  ]);

  if (!group || !totalVersions || !bodies) {
    notFound();
  }

  const { version, feed, votes, diff, page } =
    await searchParamsCache.parse(searchParams);

  // Always use the latest version if no version is specified
  const currentVersion = version ?? totalVersions - 1;

  // Extract just the version types
  const versionTypes: VersionType[] = bodies.map((body) => body.type);

  return (
    <div className='flex w-full flex-col items-center pt-10'>
      <div className='flex max-w-3xl flex-col overflow-visible'>
        <Suspense fallback={<BodyLoading />}>
          <Body
            group={group}
            version={currentVersion}
            diff={diff}
            bodies={bodies}
          />
        </Suspense>

        <MenuBar
          totalVersions={totalVersions}
          versionTypes={versionTypes}
          currentVersion={currentVersion}
        />

        <Suspense fallback={<FeedLoading />}>
          <Feed
            group={group}
            feedFilter={feed}
            votesFilter={votes}
            page={page ? Number(page) : 1}
          />
        </Suspense>
      </div>

      {/* <Suspense fallback={<LoadingTimeline />}> */}
      <Timeline group={group} feedFilter={feed} votesFilter={votes} />
      {/* </Suspense> */}
    </div>
  );
}
