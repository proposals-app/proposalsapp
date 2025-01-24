import { Proposal, Selectable, Vote } from '@proposalsapp/db';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import {
  DelegateInfo,
  getDelegateForVoter,
  getVotesAction,
  processResultsAction,
} from './actions';
import { LoadingChart, ResultsChart } from './result/ResultsChart';
import { LoadingList, ResultsList } from './result/ResultsList';
import { LoadingTable, ResultsTable } from './result/ResultsTable';
import { unstable_cache } from 'next/cache';

interface ResultsProps {
  proposal: Selectable<Proposal>;
  daoSlug: string;
}

export function Results({ proposal, daoSlug }: ResultsProps) {
  return (
    <div className='flex w-full'>
      <Suspense fallback={<ResultsLoading />}>
        <ResultsContent proposal={proposal} daoSlug={daoSlug} />
      </Suspense>
    </div>
  );
}

export function ResultsLoading() {
  return (
    <div className='flex w-full flex-col gap-6'>
      <div className='flex w-full gap-4'>
        <LoadingChart />
        <LoadingList />
      </div>
      <LoadingTable />
    </div>
  );
}

const getDelegateForVoterCached = unstable_cache(
  async (voterAddress: string, daoSlug: string, proposalId: string) => {
    return await getDelegateForVoter(voterAddress, daoSlug, proposalId, false);
  },
  ['delegate-for-voter'],
  { revalidate: 60 * 5, tags: ['delegate-for-voter'] }
);

const processResultsActionCached = unstable_cache(
  async (proposal: Selectable<Proposal>, votes: Selectable<Vote>[]) => {
    return await processResultsAction(proposal, votes);
  },
  ['process-results-action'],
  { revalidate: 60 * 5, tags: ['process-results-action'] }
);

// New component to handle the async content
async function ResultsContent({ proposal, daoSlug }: ResultsProps) {
  const votes = await getVotesAction(proposal.id);

  // Create a map of voter addresses to their delegate information
  const delegateMap = new Map<string, DelegateInfo>();

  // Fetch delegate information for all voters
  await Promise.all(
    votes.map(async (vote) => {
      if (vote.votingPower > 50000) {
        const delegate = await getDelegateForVoterCached(
          vote.voterAddress,
          daoSlug,
          proposal.id
        );
        delegateMap.set(vote.voterAddress, delegate);
      }
    })
  );

  const processedResults = await processResultsActionCached(proposal, votes);

  if (!processedResults) {
    notFound();
  }

  return (
    <div className='w-full'>
      <div className='flex'>
        <ResultsChart results={processedResults} delegateMap={delegateMap} />
        <ResultsList results={processedResults} />
      </div>

      <ResultsTable results={processedResults} delegateMap={delegateMap} />
    </div>
  );
}
