import { notFound } from 'next/navigation';
import { Results } from './components/Results';
import { Timeline } from './components/timeline/Timeline';
import { getGroup_cached } from '@/app/[daoSlug]/(main_page)/[groupId]/actions';
import { Header } from '@/app/[daoSlug]/components/Header';

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

  return (
    <div className='flex min-h-screen w-full flex-row'>
      <Header groupId={group.groupId} withBack={true} withHide={false} />

      <Timeline group={group} selectedResult={proposalIndex + 1} />

      <div
        className={'flex w-full grow -translate-x-[1px] -translate-y-2 py-28'}
      >
        <div className='h-full w-full pr-4'>
          <div
            className='dark:border-neutral-650 flex h-full min-h-[calc(100vh-114px)] w-full flex-col
              rounded-r-xs border border-neutral-800 bg-white p-6 dark:bg-neutral-950'
          >
            <Results proposal={proposal} daoSlug={daoSlug} />
          </div>
        </div>
      </div>
    </div>
  );
}
