import {
  FeedFilterEnum,
  searchParamsCache,
  VotesFilterEnum,
} from '@/app/searchParams';
import { notFound } from 'next/navigation';
import { getGroup, getBodyVersions, getFeed } from './actions';
import {
  AuthorInfo,
  Body,
  BodyLoading,
  LoadingBodyHeader,
} from './components/body/Body';
import { Feed, FeedLoading } from './components/feed/Feed';
import { MenuBar } from './components/menubar/MenuBar';
import { Timeline } from './components/timeline/Timeline';
import { Suspense } from 'react';
import { LoadingMenuBar } from './components/menubar/LoadingMenuBar';
import { getGroupAuthor } from '../../actions';
import { PostedTime } from './components/body/PostedTime';
import { Header } from '../../components/Header';

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ daoSlug: string; groupId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await params;
  const { daoSlug, groupId } = resolvedParams;
  const parsedParams = await searchParamsCache.parse(searchParams);

  const { version, diff, feed: feedFilter, votes: votesFilter } = parsedParams;

  const bodyKey = `body-${groupId}-${version}-${diff ? 'diff' : 'nodiff'}`;
  const menuBarKey = `menubar-${version}-${diff ? 'diff' : 'nodiff'}`;
  const feedKey = `feed-${groupId}-${feedFilter}-${votesFilter}`;
  const timelineKey = `timeline-${groupId}-${feedFilter}-${votesFilter}`;

  return (
    <div className='flex w-full flex-col items-center pt-10 pr-96'>
      <div className='flex w-full max-w-3xl flex-col overflow-visible'>
        <Suspense fallback={<LoadingBodyHeader />}>
          <BodyHeaderSection daoSlug={daoSlug} groupId={groupId} />
        </Suspense>

        <Suspense fallback={<BodyLoading />} key={bodyKey}>
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
            votesFilter={votesFilter}
          />
        </Suspense>
      </div>

      <Suspense key={timelineKey}>
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
  const [group, bodyVersions, authorInfo] = await Promise.all([
    getGroup(daoSlug, groupId),
    getBodyVersions(groupId, true),
    getGroupAuthor(groupId),
  ]);

  if (!group || !bodyVersions) {
    notFound();
  }

  const { originalAuthorName, originalAuthorPicture, groupName } = authorInfo;
  const firstBodyVersion = bodyVersions[0];
  const lastBodyVersion = bodyVersions[bodyVersions.length - 1];

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

      <h1 className='text-4xl font-bold text-neutral-700 dark:text-neutral-300'>
        {groupName}
      </h1>

      <div className='flex flex-col'>
        <div className='flex flex-row justify-between'>
          <AuthorInfo
            authorName={originalAuthorName}
            authorPicture={originalAuthorPicture}
          />

          <div className='flex flex-col items-center gap-2'>
            <div className='flex flex-row gap-4'>
              <PostedTime
                label='initially posted'
                createdAt={firstBodyVersion.createdAt}
              />

              <PostedTime
                label='latest revision'
                createdAt={lastBodyVersion.createdAt}
                border
              />
            </div>
          </div>
        </div>
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

  if (!group) {
    notFound();
  }

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

  if (!group) {
    notFound();
  }

  return (
    <Timeline
      events={feed.events}
      group={group}
      feedFilter={feedFilter}
      votesFilter={votesFilter}
    />
  );
}
