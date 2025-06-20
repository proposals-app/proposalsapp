import type { Proposal, Selectable } from '@proposalsapp/db';
import {
  getNonVoters,
  getProposalGovernor,
  getVoter,
  getVotesWithVoters,
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
import {
  SkeletonResultsTitle,
  SkeletonResults,
} from '@/app/components/ui/skeleton';

interface ResultsProps {
  proposal: Selectable<Proposal>;
}

export function Results({ proposal }: ResultsProps) {
  return (
    <div className='flex w-full'>
      <ResultsContent proposal={proposal} />
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
        <Suspense fallback={<TitleLoading />}>
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
  return <SkeletonResultsTitle />;
}

export function ResultsLoading() {
  return <SkeletonResults />;
}
