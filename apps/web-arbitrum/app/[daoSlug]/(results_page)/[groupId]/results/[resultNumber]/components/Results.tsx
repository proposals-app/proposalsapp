import { Proposal, Selectable } from '@proposalsapp/db';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { DelegateInfo, getDelegateForVoter, getVotesAction } from './actions';
import { LoadingChart, ResultsChart } from './result/ResultsChart';
import { LoadingList, ResultsList } from './result/ResultsList';
import { LoadingTable, ResultsTable } from './result/ResultsTable';
import { unstable_cache } from 'next/cache';
import { processResultsAction } from '@/lib/votes_processing';

interface ResultsProps {
  proposal: Selectable<Proposal>;
  daoSlug: string;
}

export function Results({ proposal, daoSlug }: ResultsProps) {
  return (
    <div className='flex w-full'>
      <ResultsContent proposal={proposal} daoSlug={daoSlug} />
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
  [],
  { revalidate: 60 * 5, tags: ['delegate-for-voter'] }
);

// const processResultsActionCached = unstable_cache(
//   async (proposal: Selectable<Proposal>, votes: Selectable<Vote>[]) => {
//     return await processResultsAction(proposal, votes);
//   },
//   ['process-results-action'],
//   { revalidate: 60 * 5, tags: ['process-results-action'] }
// );

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

  const processedResultsWithoutTimeline = await processResultsAction(
    proposal,
    votes,
    {
      withVotes: true,
      withTimeseries: false,
      aggregatedVotes: false,
    }
  );

  const processedResultsWithTimeline = await processResultsAction(
    proposal,
    votes,
    {
      withVotes: true,
      withTimeseries: true,
      aggregatedVotes: false,
    }
  );

  return (
    <div className='w-full'>
      <Suspense>
        <div className='flex'>
          <ResultsChart
            results={processedResultsWithoutTimeline}
            delegateMap={delegateMap}
          />
          <ResultsList results={processedResultsWithoutTimeline} />
        </div>
      </Suspense>

      <Suspense>
        <ResultsTable
          results={processedResultsWithTimeline}
          delegateMap={delegateMap}
        />
      </Suspense>
    </div>
  );
}
