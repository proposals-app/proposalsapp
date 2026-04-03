import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Results, ResultsLoading } from './components/results';
import { LoadingTimeline, Timeline } from './components/timeline/timeline';
import {
  getGroup,
  getGroupHeader,
} from '@/app/(dao)/[daoSlug]/(main_page)/[groupId]/actions';
import { Header } from '@/app/(dao)/[daoSlug]/components/header/header';
import { Suspense } from 'react';
import { SkeletonResultsHeader } from '../../../../../../components/ui/skeleton';

type Props = {
  params: Promise<{ daoSlug: string; groupId: string; resultNumber: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { groupId, resultNumber } = await params;
  const group = await getGroup(groupId);

  if (!group) {
    return {};
  }

  const proposalIndex = parseInt(resultNumber, 10) - 1;
  const proposal = group.proposals[proposalIndex];

  if (!proposal) {
    return {};
  }

  return {
    title: `Vote Results - ${proposal.name}`,
    description: `View voting results and breakdown for ${proposal.name}`,
    openGraph: {
      title: `Vote Results - ${proposal.name}`,
      description: `Voting results for governance proposal: ${proposal.name}`,
      type: 'article',
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ daoSlug: string; groupId: string; resultNumber: string }>;
}) {
  const { groupId, resultNumber } = await params;
  const group = await getGroup(groupId);

  // Validate group and proposal existence BEFORE Suspense boundaries
  // This ensures proper 404 status code before streaming starts
  if (!group) {
    notFound();
  }

  const proposalIndex = parseInt(resultNumber, 10) - 1;
  const proposal = group.proposals[proposalIndex];
  if (!proposal) {
    notFound();
  }

  return (
    <div className='flex min-h-screen w-full flex-row'>
      {/* Header loads independently */}
      <Suspense fallback={<SkeletonResultsHeader />}>
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
        <div className='h-full w-full pl-2 pr-2 sm:pl-0 sm:pr-4'>
          <div className='rounded-r-xs flex h-full min-h-[calc(100vh-114px)] w-full flex-col border border-neutral-800 bg-white p-6 dark:border-neutral-650 dark:bg-neutral-950'>
            <Suspense fallback={<ResultsLoading />}>
              <ResultsContainer proposal={proposal} />
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

// Separate component for timeline rendering with pre-validated group
async function TimelineContainer({
  group,
  resultNumber,
}: {
  group: NonNullable<Awaited<ReturnType<typeof getGroup>>>;
  resultNumber: string;
}) {
  const proposalIndex = parseInt(resultNumber, 10) - 1;
  return <Timeline group={group} selectedResult={proposalIndex + 1} />;
}

// Separate component for results rendering with pre-validated proposal
async function ResultsContainer({
  proposal,
}: {
  proposal: NonNullable<Awaited<ReturnType<typeof getGroup>>>['proposals'][0];
}) {
  return <Results proposal={proposal} />;
}
