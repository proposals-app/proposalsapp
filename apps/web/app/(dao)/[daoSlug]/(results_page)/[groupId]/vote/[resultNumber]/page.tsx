import { notFound } from 'next/navigation';
import { Results, ResultsLoading } from './components/results';
import { LoadingTimeline, Timeline } from './components/timeline/timeline';
import {
  getGroup,
  getGroupHeader,
} from '@/app/(dao)/[daoSlug]/(main_page)/[groupId]/actions';
import { Header } from '@/app/(dao)/[daoSlug]/components/header';
import { Suspense } from 'react';
import Loading from './loading';

export default async function Page({
  params,
}: {
  params: Promise<{ daoSlug: string; groupId: string; resultNumber: string }>;
}) {
  return (
    <Suspense fallback={<Loading />}>
      <ResultsPage params={params} />
    </Suspense>
  );
}

async function ResultsPage({
  params,
}: {
  params: Promise<{ groupId: string; resultNumber: string }>;
}) {
  const { groupId, resultNumber } = await params;

  const group = await getGroup(groupId);
  if (!group) {
    notFound();
  }

  const proposalIndex = parseInt(resultNumber, 10) - 1;
  const proposal = group.proposals[proposalIndex];

  if (!proposal) {
    notFound();
  }

  const { originalAuthorName, originalAuthorPicture, groupName } =
    await getGroupHeader(group.groupId);

  return (
    <div className='flex min-h-screen w-full flex-row'>
      <Header
        groupId={group.groupId}
        withBack={true}
        withHide={false}
        originalAuthorName={originalAuthorName}
        originalAuthorPicture={originalAuthorPicture}
        groupName={groupName}
      />

      <Suspense fallback={<LoadingTimeline />}>
        <Timeline group={group} selectedResult={proposalIndex + 1} />
      </Suspense>

      <div
        className={
          'flex w-full grow -translate-x-[1px] py-2 sm:-translate-y-2 sm:py-28'
        }
      >
        <div className='h-full w-full pr-2 pl-2 sm:pr-4 sm:pl-0'>
          <div className='dark:border-neutral-650 flex h-full min-h-[calc(100vh-114px)] w-full flex-col rounded-r-xs border border-neutral-800 bg-white p-6 dark:bg-neutral-950'>
            <Suspense fallback={<ResultsLoading />}>
              <Results proposal={proposal} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
