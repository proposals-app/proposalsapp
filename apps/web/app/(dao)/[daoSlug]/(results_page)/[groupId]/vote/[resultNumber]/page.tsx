import { notFound } from 'next/navigation';
import { Results, ResultsLoading } from './components/results';
import { LoadingTimeline, Timeline } from './components/timeline/timeline';
import {
  getGroup,
  getGroupHeader,
} from '@/app/(dao)/[daoSlug]/(main_page)/[groupId]/actions';
import { Header } from '@/app/(dao)/[daoSlug]/components/header/header';
import { Suspense } from 'react';
import {
  SkeletonAvatar,
  SkeletonText,
  SkeletonButton,
} from '../../../../../../components/ui/skeleton';

export default async function Page({
  params,
}: {
  params: Promise<{ daoSlug: string; groupId: string; resultNumber: string }>;
}) {
  const { groupId, resultNumber } = await params;
  const group = await getGroup(groupId);

  return (
    <div className='flex min-h-screen w-full flex-row'>
      {/* Header loads independently */}
      <Suspense fallback={<LoadingHeaderPlaceholder />}>
        <HeaderContainer groupId={groupId} />
      </Suspense>

      {/* Timeline loads independently */}
      <Suspense fallback={<LoadingTimeline />}>
        <TimelineContainer group={group} resultNumber={resultNumber} />
      </Suspense>

      {/* Results load independently */}
      <div
        className={
          'flex w-full grow -translate-x-[1px] py-2 sm:-translate-y-2 sm:py-28'
        }
      >
        <div className='h-full w-full pr-2 pl-2 sm:pr-4 sm:pl-0'>
          <div className='dark:border-neutral-650 flex h-full min-h-[calc(100vh-114px)] w-full flex-col rounded-r-xs border border-neutral-800 bg-white p-6 dark:bg-neutral-950'>
            <Suspense fallback={<ResultsLoading />}>
              <ResultsContainer group={group} resultNumber={resultNumber} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}

// Separate component for header data fetching
async function HeaderContainer({ groupId }: { groupId: string }) {
  const { originalAuthorName, originalAuthorPicture, groupName } =
    await getGroupHeader(groupId);

  return (
    <Header
      groupId={groupId}
      withBack={true}
      withHide={false}
      originalAuthorName={originalAuthorName}
      originalAuthorPicture={originalAuthorPicture}
      groupName={groupName}
    />
  );
}

// Separate component for timeline rendering with pre-fetched group
async function TimelineContainer({
  group,
  resultNumber,
}: {
  group: Awaited<ReturnType<typeof getGroup>>;
  resultNumber: string;
}) {
  if (!group) {
    notFound();
  }

  const proposalIndex = parseInt(resultNumber, 10) - 1;
  return <Timeline group={group} selectedResult={proposalIndex + 1} />;
}

// Separate component for results rendering with pre-fetched group
async function ResultsContainer({
  group,
  resultNumber,
}: {
  group: Awaited<ReturnType<typeof getGroup>>;
  resultNumber: string;
}) {
  if (!group) {
    notFound();
  }

  const proposalIndex = parseInt(resultNumber, 10) - 1;
  const proposal = group.proposals[proposalIndex];

  if (!proposal) {
    notFound();
  }

  return <Results proposal={proposal} />;
}

// Enhanced loading placeholder for header
function LoadingHeaderPlaceholder() {
  return (
    <div
      className={`border-neutral-350 dark:border-neutral-650 fixed top-0 right-0 left-0 z-50 flex h-20 items-center border-b bg-neutral-50 px-2 transition-transform duration-300 sm:ml-20 sm:px-6 dark:bg-neutral-900`}
    >
      {/* Enhanced Back Button Placeholder */}
      <div className='flex items-center gap-2 rounded-full px-3 py-2'>
        <SkeletonButton size='sm' width='1.5rem' height='1.5rem' />
        <span className='hidden text-sm font-medium sm:block'>Back</span>
      </div>

      <div className={'flex items-center gap-2 pl-2 sm:pl-4'}>
        {/* Enhanced Avatar Placeholder */}
        <div className='flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-neutral-700 dark:border-neutral-300'>
          <SkeletonAvatar size='sm' />
        </div>
        {/* Enhanced Group Name Placeholder */}
        <SkeletonText width='8rem' size='md' />
      </div>
    </div>
  );
}
