import {
  FeedFilterEnum,
  searchParamsCache,
  VotesFilterEnum,
} from '@/app/searchParams';
import { notFound } from 'next/navigation';
import { getGroup, getBodyVersions, getFeed } from './actions';
import { Body, BodyLoading } from './components/body/Body';
import { Feed, FeedLoading } from './components/feed/Feed';
import { MenuBar } from './components/menubar/MenuBar';
import { Timeline } from './components/timeline/Timeline';
import { Suspense } from 'react';
import { LoadingMenuBar } from './components/menubar/LoadingMenuBar';

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ daoSlug: string; groupId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [{ daoSlug, groupId }, parsedParams] = await Promise.all([
    params,
    searchParamsCache.parse(searchParams),
  ]);

  const { version, diff, feed: feedFilter, votes: votesFilter } = parsedParams;

  return (
    <div className='flex w-full flex-col items-center pt-10 pr-96'>
      <div className='flex w-full max-w-3xl flex-col overflow-visible'>
        <Suspense fallback={<BodyLoading />}>
          <BodySection
            daoSlug={daoSlug}
            groupId={groupId}
            version={version}
            diff={diff}
          />
        </Suspense>

        <Suspense fallback={<LoadingMenuBar />}>
          <MenuBarSection groupId={groupId} version={version} />
        </Suspense>

        <Suspense fallback={<FeedLoading />}>
          <FeedSection
            daoSlug={daoSlug}
            groupId={groupId}
            feedFilter={feedFilter}
            votesFilter={votesFilter}
          />
        </Suspense>
      </div>

      <Suspense>
        <TimelineSection
          daoSlug={daoSlug}
          groupId={groupId}
          feedFilter={feedFilter}
          votesFilter={votesFilter}
        />
      </Suspense>
    </div>
  );
}

async function BodySection({
  daoSlug,
  groupId,
  version,
  diff,
}: {
  daoSlug: string;
  groupId: string;
  version: number | null;
  diff: boolean;
}) {
  const [group, bodyVersions] = await Promise.all([
    getGroup(daoSlug, groupId),
    getBodyVersions(groupId),
  ]);

  if (!group || !bodyVersions) {
    notFound();
  }

  // Always use the latest version if no version is specified
  const currentVersion = version ?? bodyVersions.length - 1;

  return (
    <Body
      group={group}
      diff={diff}
      bodyVersions={bodyVersions}
      currentVersion={currentVersion}
    />
  );
}

async function MenuBarSection({
  groupId,
  version,
}: {
  groupId: string;
  version: number | null;
}) {
  const bodyVersions = await getBodyVersions(groupId);

  if (!bodyVersions) {
    return null;
  }
  const bodyVersionsWithoutContent = bodyVersions.map((body) => ({
    ...body,
    content: '',
  }));

  // Always use the latest version if no version is specified
  const currentVersion = version ?? bodyVersions.length - 1;

  return (
    <MenuBar
      bodyVersions={bodyVersionsWithoutContent}
      currentVersion={currentVersion}
    />
  );
}

async function FeedSection({
  daoSlug,
  groupId,
  feedFilter,
  votesFilter,
}: {
  daoSlug: string;
  groupId: string;
  feedFilter: FeedFilterEnum;
  votesFilter: VotesFilterEnum;
}) {
  const [group, feed] = await Promise.all([
    getGroup(daoSlug, groupId),
    getFeed(groupId, feedFilter, votesFilter),
  ]);

  return <Feed group={group} feed={feed} />;
}

async function TimelineSection({
  daoSlug,
  groupId,
  feedFilter,
  votesFilter,
}: {
  daoSlug: string;
  groupId: string;
  feedFilter: FeedFilterEnum;
  votesFilter: VotesFilterEnum;
}) {
  const [group, feed] = await Promise.all([
    getGroup(daoSlug, groupId),
    getFeed(groupId, feedFilter, votesFilter),
  ]);

  return (
    <Timeline
      events={feed.events}
      group={group}
      feedFilter={feedFilter}
      votesFilter={votesFilter}
    />
  );
}
