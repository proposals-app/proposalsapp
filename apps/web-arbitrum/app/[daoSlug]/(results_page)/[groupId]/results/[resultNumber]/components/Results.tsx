import { Proposal, Selectable } from '@proposalsapp/db';
import { Suspense } from 'react';
import {
  DelegateInfo,
  getDelegateForVoter_cached,
  getVotesAction_cached,
} from './actions';
import { LoadingChart, ResultsChart } from './result/ResultsChart';
import { LoadingList, ResultsList } from './result/ResultsList';
import { LoadingTable, ResultsTable } from './result/ResultsTable';
import { processResultsAction } from '@/lib/results_processing';

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

// New component to handle the async content
async function ResultsContent({ proposal, daoSlug }: ResultsProps) {
  const votes = await getVotesAction_cached(proposal.id);

  // Create a map of voter addresses to their delegate information
  const delegateMap = new Map<string, DelegateInfo>();

  // Fetch delegate information for all voters
  await Promise.all(
    votes.map(async (vote) => {
      if (vote.votingPower > 50000) {
        const delegate = await getDelegateForVoter_cached(
          vote.voterAddress,
          daoSlug,
          proposal.id
        );
        delegateMap.set(vote.voterAddress, delegate);
      }
    })
  );

  const processedResults = await processResultsAction(proposal, votes, {
    withVotes: true,
    withTimeseries: true,
    aggregatedVotes: false,
  });

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
