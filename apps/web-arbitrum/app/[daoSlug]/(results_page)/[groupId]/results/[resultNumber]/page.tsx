import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Header } from './components/Header';
import { Results, ResultsLoading } from './components/Results';
import { LoadingTimeline, Timeline } from './components/timeline/Timeline';
import { getAuthor_cached } from './actions';
import { getGroup_cached } from '@/app/[daoSlug]/(main_page)/[groupId]/actions';

export default async function ResultPage({
  params,
}: {
  params: Promise<{ daoSlug: string; groupId: string; resultNumber: string }>;
}) {
  const { daoSlug, groupId, resultNumber } = await params;

  const group = await getGroup_cached(daoSlug, groupId);
  if (!group) {
    notFound();
  }

  const proposalIndex = parseInt(resultNumber, 10) - 1;
  const proposal = group.proposals[proposalIndex];

  if (!proposal) {
    notFound();
  }

  const bodies = await getAuthor_cached(group.group.id);
  const author = bodies?.[0];

  return (
    <div className='flex min-h-screen w-full flex-row'>
      <Header
        authorName={author?.author_name || 'Unknown'}
        authorPicture={author?.author_picture || ''}
        proposalName={proposal.name}
        daoSlug={daoSlug}
        itemId={groupId}
      />

      <Suspense fallback={<LoadingTimeline />}>
        <Timeline group={group} selectedResult={proposalIndex + 1} />
      </Suspense>

      <div
        className={'flex w-full grow -translate-x-[1px] -translate-y-2 py-28'}
      >
        <div className='h-full w-full pr-4'>
          <div
            className='flex h-full min-h-[calc(100vh-114px)] w-full flex-col rounded-lg border
              border-neutral-300 bg-white p-6'
          >
            {group ? (
              <Suspense fallback={<ResultsLoading />}>
                <Results proposal={proposal} daoSlug={daoSlug} />
              </Suspense>
            ) : (
              <ResultsLoading />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
