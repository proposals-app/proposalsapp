import {
  searchParamsCache,
  type FeedFilterEnum,
  type FromFilterEnum,
} from '@/app/searchParams';
import { notFound } from 'next/navigation';
import {
  getBodyVersionsCached,
  getFeedCached,
  getGroupCached,
  getGroupHeaderCached,
} from './actions';
import { Body, BodyLoading } from './components/body/body';
import { Feed, FeedLoading } from './components/feed/feed';
import { MenuBar } from './components/menubar/menu-bar';
import { Timeline } from './components/timeline/timeline';
import { Suspense } from 'react';
import { DynamicLoadingMenuBar } from './components/menubar/loading-menu-bar';
import { getVotesWithVotersForProposals } from '../../(results_page)/[groupId]/vote/[resultNumber]/components/actions';
import { BodyHeader, BodyHeaderLoading } from './components/body/body-header';
import { ResultsMobile } from './components/timeline/mobile/timeline-mobile';
import { LastReadUpdater } from './components/last-read-updater';
import type { ResultEvent } from '@/lib/types';
import Loading from './loading';
import { Header } from '../../components/header/header';

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ daoSlug: string; groupId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <Suspense fallback={<Loading />}>
      <GroupPage params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ daoSlug: string; groupId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { daoSlug, groupId } = await params;
  const {
    version,
    diff,
    expanded,
    feed: feedFilter,
    from: fromFilter,
  } = await searchParamsCache.parse(searchParams);

  const bodyKey = `body-${groupId}-${version}-${diff ? 'diff' : 'nodiff'}`;
  const menuBarKey = `menubar-${groupId}-${expanded ? 'expanded' : 'collapsed'}`;
  const feedKey = `feed-${groupId}-${feedFilter}-${fromFilter}`;
  const timelineKey = `timeline-${groupId}-${feedFilter}-${fromFilter}`;

  return (
    <div className='flex w-full flex-col items-center px-4 md:pt-10 md:pr-96'>
      <div className='flex w-full max-w-3xl flex-col gap-4 overflow-visible'>
        <Suspense>
          <LastReadUpdater groupId={groupId} daoSlug={daoSlug} />
        </Suspense>

        <Suspense fallback={<BodyHeaderLoading />}>
          <BodyHeaderSection groupId={groupId} />
        </Suspense>

        <Suspense fallback={<BodyLoading />} key={bodyKey}>
          {/* <AISummary groupId={groupId} /> */}
          <BodySection groupId={groupId} version={version} diff={diff} />
        </Suspense>

        <Suspense
          fallback={<DynamicLoadingMenuBar expanded={expanded} />}
          key={menuBarKey}
        >
          <MenuBarSection groupId={groupId} version={version} diff={diff} />
        </Suspense>

        <Suspense fallback={<FeedLoading />} key={feedKey}>
          <FeedSection
            groupId={groupId}
            feedFilter={feedFilter}
            fromFilter={fromFilter}
          />
        </Suspense>
      </div>

      <Suspense key={timelineKey} fallback={<SkeletonTimelineWrapper />}>
        <TimelineSection
          groupId={groupId}
          feedFilter={feedFilter}
          fromFilter={fromFilter}
        />
      </Suspense>
    </div>
  );
}

function SkeletonTimelineWrapper() {
  // A small wrapper to reuse the existing SkeletonTimeline component
  // without changing its positioning.
  const { SkeletonTimeline } = require('@/app/components/ui/skeleton');
  return <SkeletonTimeline />;
}

async function BodySection({
  groupId,
  version,
  diff,
}: {
  groupId: string;
  version: number | null;
  diff: boolean;
}) {
  const [group, bodyVersions] = await Promise.all([
    getGroupCached(groupId),
    getBodyVersionsCached(groupId, true),
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

async function BodyHeaderSection({ groupId }: { groupId: string }) {
  const [group, bodyVersions, bodyVersionsNoContent, authorInfo] =
    await Promise.all([
      getGroupCached(groupId),
      getBodyVersionsCached(groupId, true),
      getBodyVersionsCached(groupId, false),
      getGroupHeaderCached(groupId),
    ]);

  if (!group || !bodyVersions || !bodyVersionsNoContent) {
    notFound();
  }

  const { originalAuthorName, originalAuthorPicture, groupName } = authorInfo;

  const firstBodyVersion = bodyVersions[0];

  return (
    <div>
      <Header
        groupId={groupId}
        withBack={false}
        withHide={true}
        originalAuthorName={originalAuthorName}
        originalAuthorPicture={originalAuthorPicture}
        groupName={groupName}
      />
      <BodyHeader
        groupName={groupName}
        originalAuthorName={originalAuthorName}
        originalAuthorPicture={originalAuthorPicture}
        firstBodyVersionCreatedAt={firstBodyVersion.createdAt}
        bodyVersionsNoContent={bodyVersionsNoContent}
      />
    </div>
  );
}

async function MenuBarSection({
  groupId,
  version,
  diff,
}: {
  groupId: string;
  version: number | null;
  diff: boolean;
}) {
  const bodyVersions = await getBodyVersionsCached(groupId, false);

  if (!bodyVersions) {
    return null;
  }

  // Always use the latest version if no version is specified
  const currentVersion = version ?? bodyVersions.length - 1;

  return (
    <MenuBar
      bodyVersions={bodyVersions}
      currentVersion={currentVersion}
      diff={diff}
    />
  );
}

async function FeedSection({
  groupId,
  feedFilter,
  fromFilter,
}: {
  groupId: string;
  feedFilter: FeedFilterEnum;
  fromFilter: FromFilterEnum;
}) {
  const [group, feed] = await Promise.all([
    getGroupCached(groupId),
    getFeedCached(groupId, feedFilter, fromFilter),
  ]);

  const proposalIds = group?.proposals.map((p) => p.id) || [];
  const allVotesWithVoters = await getVotesWithVotersForProposals(proposalIds);

  if (!group) {
    notFound();
  }

  return (
    <Feed group={group} feed={feed} allVotesWithVoters={allVotesWithVoters} />
  );
}

async function TimelineSection({
  groupId,
  feedFilter,
  fromFilter,
}: {
  groupId: string;
  feedFilter: FeedFilterEnum;
  fromFilter: FromFilterEnum;
}) {
  const [group, feed] = await Promise.all([
    getGroupCached(groupId),
    getFeedCached(groupId, feedFilter, fromFilter),
  ]);

  if (!group) {
    notFound();
  }

  const mobileResultEvents: ResultEvent[] =
    (feed.events?.filter((event) =>
      event.type.includes('Result')
    ) as ResultEvent[]) || [];

  return (
    <div>
      <ResultsMobile events={mobileResultEvents} group={group} />
      <Timeline
        events={feed.events}
        group={group}
        feedFilter={feedFilter}
        fromFilter={fromFilter}
      />
    </div>
  );
}
