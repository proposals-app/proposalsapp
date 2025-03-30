import {
  FeedFilterEnum,
  searchParamsCache,
  FromFilterEnum,
} from '@/app/searchParams';
import { notFound } from 'next/navigation';
import { getGroup, getBodyVersions, getFeed, getGroupHeader } from './actions';
import {
  AuthorInfo,
  Body,
  BodyLoading,
  LoadingBodyHeader,
} from './components/body/body';
import { Feed, FeedLoading } from './components/feed/feed';
import { MenuBar } from './components/menubar/menu-bar';
import { Timeline } from './components/timeline/timeline';
import { Suspense } from 'react';
import { LoadingMenuBar } from './components/menubar/loading-menu-bar';
import { InitiallyPosted } from './components/body/initially-posted';
import { Header } from '../../components/header';
import { getVotesWithVoters } from '../../(results_page)/[groupId]/vote/[resultNumber]/components/actions';
import { PostedRevisions } from './components/body/posted-revision';
import Loading from './loading';
import { ResultsMobile } from './components/timeline/mobile/timeline-mobile';
import { LastReadUpdater } from './components/last-read-updater';
import AISummary from './components/ai-summary';
import { ResultEvent } from '@/lib/types';

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
    feed: feedFilter,
    from: fromFilter,
  } = await searchParamsCache.parse(searchParams);

  const bodyKey = `body-${groupId}-${version}-${diff ? 'diff' : 'nodiff'}`;
  const menuBarKey = `menubar-${groupId}`;
  const feedKey = `feed-${groupId}-${feedFilter}-${fromFilter}`;
  const timelineKey = `timeline-${groupId}-${feedFilter}-${fromFilter}`;

  return (
    <div className='flex w-full flex-col items-center px-4 md:pt-10 md:pr-96'>
      <div className='flex w-full max-w-3xl flex-col gap-4 overflow-visible'>
        <Suspense fallback={null}>
          <LastReadUpdater groupId={groupId} daoSlug={daoSlug} />
        </Suspense>

        <Suspense fallback={<LoadingBodyHeader />}>
          <BodyHeaderSection daoSlug={daoSlug} groupId={groupId} />
        </Suspense>

        <Suspense fallback={<BodyLoading />} key={bodyKey}>
          <AISummary groupId={groupId} />
          <BodySection
            daoSlug={daoSlug}
            groupId={groupId}
            version={version}
            diff={diff}
          />
        </Suspense>

        <Suspense fallback={<LoadingMenuBar />} key={menuBarKey}>
          <MenuBarSection groupId={groupId} version={version} diff={diff} />
        </Suspense>

        <Suspense fallback={<FeedLoading />} key={feedKey}>
          <FeedSection
            daoSlug={daoSlug}
            groupId={groupId}
            feedFilter={feedFilter}
            fromFilter={fromFilter}
          />
        </Suspense>
      </div>

      <Suspense key={timelineKey}>
        <TimelineSection
          daoSlug={daoSlug}
          groupId={groupId}
          feedFilter={feedFilter}
          fromFilter={fromFilter}
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
    getBodyVersions(groupId, true),
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

async function BodyHeaderSection({
  daoSlug,
  groupId,
}: {
  daoSlug: string;
  groupId: string;
}) {
  const [group, bodyVersions, bodyVersionsNoContent, authorInfo] =
    await Promise.all([
      getGroup(daoSlug, groupId),
      getBodyVersions(groupId, true),
      getBodyVersions(groupId, false),
      getGroupHeader(groupId),
    ]);

  if (!group || !bodyVersions || !bodyVersionsNoContent) {
    notFound();
  }

  const { originalAuthorName, originalAuthorPicture, groupName } = authorInfo;

  const firstBodyVersion = bodyVersions[0];

  return (
    <div className='flex w-full flex-col gap-6'>
      <Header
        groupId={group.groupId}
        withBack={false}
        withHide={true}
        originalAuthorName={originalAuthorName}
        originalAuthorPicture={originalAuthorPicture}
        groupName={groupName}
      />

      <div className='hidden flex-col gap-6 sm:flex'>
        <h1 className='text-2xl font-bold text-neutral-700 dark:text-neutral-300'>
          {groupName}
        </h1>

        <div className='flex flex-col'>
          <div className='flex flex-row items-start justify-between'>
            <AuthorInfo
              authorName={originalAuthorName}
              authorPicture={originalAuthorPicture}
            />

            <div className='flex flex-col items-center gap-2'>
              <div className='flex gap-2'>
                <InitiallyPosted
                  label='initially posted'
                  createdAt={firstBodyVersion.createdAt}
                />

                <PostedRevisions versions={bodyVersionsNoContent} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className='flex flex-col gap-2 sm:hidden'>
        <div className='flex items-start justify-between'>
          <AuthorInfo
            authorName={originalAuthorName}
            authorPicture={originalAuthorPicture}
          />

          <div className='flex-col'>
            <PostedRevisions versions={bodyVersionsNoContent} />
          </div>
        </div>

        <h1 className='text-center text-2xl font-bold text-neutral-700 dark:text-neutral-300'>
          {groupName}
        </h1>
      </div>
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
  const bodyVersions = await getBodyVersions(groupId, false);

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
  daoSlug,
  groupId,
  feedFilter,
  fromFilter,
}: {
  daoSlug: string;
  groupId: string;
  feedFilter: FeedFilterEnum;
  fromFilter: FromFilterEnum;
}) {
  const [group, feed] = await Promise.all([
    getGroup(daoSlug, groupId),
    getFeed(groupId, feedFilter, fromFilter),
  ]);

  const proposalIds = group?.proposals.map((p) => p.id) || [];
  const votesWithVotersPromises = proposalIds.map(async (proposalId) => {
    return await getVotesWithVoters(proposalId);
  });
  const allVotesWithVoters = await Promise.all(votesWithVotersPromises).then(
    (results) => results.flat()
  );

  if (!group) {
    notFound();
  }

  return (
    <Feed group={group} feed={feed} allVotesWithVoters={allVotesWithVoters} />
  );
}

async function TimelineSection({
  daoSlug,
  groupId,
  feedFilter,
  fromFilter,
}: {
  daoSlug: string;
  groupId: string;
  feedFilter: FeedFilterEnum;
  fromFilter: FromFilterEnum;
}) {
  const [group, feed] = await Promise.all([
    getGroup(daoSlug, groupId),
    getFeed(groupId, feedFilter, fromFilter),
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
