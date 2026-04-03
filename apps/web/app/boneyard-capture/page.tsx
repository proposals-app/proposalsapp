import type { Metadata } from 'next';
import { BoneyardShell } from '@/app/components/loading/boneyard-shell';
import { BONEYARD_NAMES } from '@/app/components/loading/boneyard-names';
import {
  ArbitrumSummaryHeaderFixture,
  UniswapSummaryHeaderFixture,
} from '@/app/components/loading/boneyard-real-fixtures';
import {
  HeaderSkeleton,
  LoadingGroupList,
  SkeletonActiveGroupItem,
  SkeletonBody,
  SkeletonBodyHeader,
  SkeletonChart,
  SkeletonDelegatesPage,
  SkeletonDiscussionGroupItem,
  SkeletonFeed,
  SkeletonGroupPage,
  SkeletonInactiveGroupItem,
  SkeletonInitiallyPosted,
  SkeletonMainPage,
  SkeletonMappingPage,
  SkeletonMenuBar,
  SkeletonModeToggle,
  SkeletonNavShell,
  SkeletonNonVotersTable,
  SkeletonOnboardingPage,
  SkeletonPostItem,
  SkeletonPostedRevisions,
  SkeletonProfilePage,
  SkeletonResults,
  SkeletonResultsHeader,
  SkeletonResultsList,
  SkeletonResultsListBars,
  SkeletonResultsPage,
  SkeletonResultsTable,
  SkeletonResultsTitle,
  SkeletonTimeline,
  SkeletonVoteItemFeed,
} from '@/app/components/ui/skeleton';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

function CaptureCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className='rounded-xs border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-950'>
      <h2 className='mb-4 text-lg font-semibold text-neutral-800 dark:text-neutral-100'>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function BoneyardCapturePage() {
  return (
    <div className='min-h-screen bg-neutral-50 px-4 py-10 text-neutral-800 dark:bg-neutral-900 dark:text-neutral-100'>
      <div className='mx-auto flex max-w-7xl flex-col gap-8'>
        <header className='space-y-2'>
          <h1 className='text-3xl font-bold'>Boneyard Capture</h1>
          <p className='max-w-3xl text-sm text-neutral-500 dark:text-neutral-400'>
            This route renders each named loading surface exactly once so
            `boneyard-js build` can snapshot the real fixture DOM.
          </p>
        </header>

        <div className='grid gap-8 lg:grid-cols-2'>
          <CaptureCard title='DAO Headers'>
            <div className='space-y-8'>
              <BoneyardShell
                name={BONEYARD_NAMES.arbitrumSummaryHeader}
                fixture={<ArbitrumSummaryHeaderFixture />}
              />
              <BoneyardShell
                name={BONEYARD_NAMES.uniswapSummaryHeader}
                fixture={<UniswapSummaryHeaderFixture />}
              />
              <HeaderSkeleton />
            </div>
          </CaptureCard>

          <CaptureCard title='Group List Surfaces'>
            <div className='space-y-6'>
              <SkeletonMainPage />
              <LoadingGroupList />
              <SkeletonActiveGroupItem />
              <SkeletonInactiveGroupItem />
              <SkeletonDiscussionGroupItem />
            </div>
          </CaptureCard>

          <CaptureCard title='Group Page Surfaces'>
            <div className='space-y-6'>
              <SkeletonGroupPage />
              <SkeletonBodyHeader />
              <SkeletonBody />
              <SkeletonMenuBar variant='full' />
              <SkeletonMenuBar variant='body' />
              <SkeletonMenuBar variant='comments' />
              <SkeletonInitiallyPosted />
              <SkeletonPostedRevisions />
              <SkeletonFeed />
              <SkeletonPostItem />
              <SkeletonVoteItemFeed />
            </div>
          </CaptureCard>

          <CaptureCard title='Results Surfaces'>
            <div className='space-y-6'>
              <SkeletonResultsPage />
              <SkeletonResultsHeader />
              <SkeletonResults />
              <SkeletonResultsTitle />
              <SkeletonResultsList />
              <SkeletonResultsListBars />
              <SkeletonChart />
              <SkeletonResultsTable />
              <SkeletonNonVotersTable />
              <SkeletonTimeline />
            </div>
          </CaptureCard>

          <CaptureCard title='Shell And User Surfaces'>
            <div className='space-y-6'>
              <SkeletonNavShell />
              <SkeletonModeToggle />
              <SkeletonProfilePage />
              <SkeletonOnboardingPage />
            </div>
          </CaptureCard>

          <CaptureCard title='Mapping Surfaces'>
            <div className='space-y-6'>
              <SkeletonMappingPage />
              <SkeletonDelegatesPage />
            </div>
          </CaptureCard>
        </div>
      </div>
    </div>
  );
}
