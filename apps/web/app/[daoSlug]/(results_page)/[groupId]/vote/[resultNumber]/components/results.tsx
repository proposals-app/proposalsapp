import { Proposal, Selectable } from '@proposalsapp/db-indexer';
import {
  getVoter,
  getProposalGovernor,
  getVotesWithVoters,
  getNonVoters,
} from './actions';
import { LoadingChart, ResultsChart } from './result/results-chart';
import { LoadingList, ResultsList } from './result/results-list';
import { LoadingTable, ResultsTable } from './result/results-table';
import { processResultsAction } from '@/lib/results_processing';
import { ResultsTitle } from './result/results-title';
import { Suspense } from 'react';
import superjson from 'superjson';
import {
  LoadingNonVotersTable,
  NonVotersTable,
} from './result/non-voters-table';

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

// New component to handle the async content
async function ResultsContent({ proposal }: ResultsProps) {
  const votes = await getVotesWithVoters(proposal.id);

  const processedResults = await processResultsAction(proposal, votes, {
    withVotes: true,
    withTimeseries: true,
    aggregatedVotes: false,
  });

  const serializedResults = superjson.serialize(processedResults);
  const serializedVotes = superjson.serialize(votes);

  const governor = await getProposalGovernor(proposal.id);
  const publisher = await getVoter(processedResults.proposal.author ?? '');

  const onChain = !governor?.type.includes('SNAPSHOT');

  return (
    <div className='flex w-full flex-col gap-2 sm:flex-row'>
      <div className='flex w-full flex-col gap-8 sm:gap-2'>
        <Suspense>
          <div className='hidden lg:block'>
            {/* Hide title on mobile */}
            <ResultsTitle
              results={serializedResults}
              onChain={onChain}
              publisher={publisher}
              governor={governor}
            />
          </div>
        </Suspense>

        {/* List moves to top on mobile */}
        <div className='flex justify-center sm:hidden'>
          <Suspense fallback={<LoadingList />}>
            <ResultsList results={serializedResults} onchain={onChain} />
          </Suspense>
        </div>

        <Suspense fallback={<LoadingChart />}>
          <ResultsChart results={serializedResults} />
        </Suspense>

        <div className='flex flex-col'>
          <Suspense fallback={<LoadingNonVotersTable />}>
            <NonVotersTableLazy proposalId={proposal.id} />
          </Suspense>

          <Suspense fallback={<LoadingTable />}>
            <ResultsTable results={serializedResults} votes={serializedVotes} />
          </Suspense>
        </div>
      </div>

      {/* List shown only on desktop */}
      <div className='hidden sm:block'>
        <Suspense fallback={<LoadingList />}>
          <ResultsList results={serializedResults} onchain={onChain} />
        </Suspense>
      </div>
    </div>
  );
}

async function NonVotersTableLazy({ proposalId }: { proposalId: string }) {
  const nonVoters = await getNonVoters(proposalId);
  return <NonVotersTable nonVoters={nonVoters} />;
}

function TitleLoading() {
  return (
    <div className='mb-4 flex flex-col gap-4'>
      {/* Title placeholder */}
      <div className='h-6 w-2/3 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />

      {/* Metadata row */}
      <div className='flex items-center gap-4'>
        {/* Published by text */}
        <div className='flex items-center gap-2'>
          <div className='h-3 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />
          <div className='h-3 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />
          <div className='h-3 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />
          <div className='h-3 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />
        </div>
      </div>
    </div>
  );
}

export function ResultsLoading() {
  return (
    <div className='flex w-full flex-col gap-2 sm:flex-row'>
      <div className='flex w-full flex-col gap-8 sm:gap-2'>
        <div className='hidden lg:block'>
          <TitleLoading />
        </div>

        <div className='flex justify-center sm:hidden'>
          <LoadingList />
        </div>

        <LoadingChart />

        <div className='flex flex-col'>
          <LoadingNonVotersTable />
          <LoadingTable />
        </div>
      </div>

      <div className='hidden sm:block'>
        <LoadingList />
      </div>
    </div>
  );
}
