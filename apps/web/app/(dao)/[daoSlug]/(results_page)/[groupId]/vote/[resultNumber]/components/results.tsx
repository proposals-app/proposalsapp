import type { Proposal, Selectable } from '@proposalsapp/db';
import {
  // getNonVoters,
  getProposalGovernorCached,
  getVoterCached,
  getVotesWithVotersCached,
  getTotalDelegatedVpAtStartCached,
  getVotesMinimalCached,
} from './actions';
import { LoadingChart, ResultsChart } from './result/results-chart';
import {
  LoadingList,
  ResultsList,
  ResultsListBars,
  ResultsListBarsSkeleton,
} from './result/results-list';
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
  // Kick off data fetches in parallel without awaiting here
  const votesPromise = getVotesWithVotersCached(proposal.id);
  const minimalVotesPromise = getVotesMinimalCached(proposal.id);
  const totalsPromise = getTotalDelegatedVpAtStartCached(proposal.id);
  const governorPromise = getProposalGovernorCached(proposal.id);
  const publisherPromise = getVoterCached(proposal.author ?? '');

  // Compute lightweight results for early streaming (no votes array)
  const coreResultsPromise = minimalVotesPromise.then((votes) =>
    processResultsAction(proposal, votes, {
      withVotes: false,
      withTimeseries: true,
      aggregatedVotes: false,
    })
  );

  // Compute full results including votes for the table
  const fullResultsPromise = votesPromise.then((votes) =>
    processResultsAction(proposal, votes, {
      withVotes: true,
      withTimeseries: true,
      aggregatedVotes: false,
    })
  );

  // Enrich with total delegated VP (for quorum/participation bars) without recomputing
  const enrichedResultsPromise = Promise.all([
    coreResultsPromise,
    totalsPromise,
  ]).then(([core, total]) => ({ ...core, totalDelegatedVp: total }));

  const onChainPromise = governorPromise.then(
    (governor) => !(governor?.type?.toUpperCase().includes('SNAPSHOT') ?? false)
  );

  return (
    <div className='flex w-full flex-col gap-2 sm:flex-row'>
      <div className='flex w-full flex-col gap-8 sm:gap-2'>
        {/* Title (desktop only) */}
        <Suspense fallback={<TitleLoading />}>
          <div className='hidden lg:block'>
            <ResultsTitleContainer
              resultsPromise={coreResultsPromise}
              governorPromise={governorPromise}
              publisherPromise={publisherPromise}
            />
          </div>
        </Suspense>

        {/* List (mobile first), streaming core results */}
        <div className='flex justify-center sm:hidden'>
          <Suspense fallback={<LoadingList />}>
            <ResultsListContainer
              resultsPromise={coreResultsPromise}
              onChainPromise={onChainPromise}
            />
          </Suspense>
        </div>
        {/* Mobile bars skeleton to prevent layout shift */}
        <div className='flex justify-center sm:hidden'>
          <Suspense fallback={<ResultsListBarsSkeleton />}>
            <ResultsListBarsContainer
              enrichedResultsPromise={enrichedResultsPromise}
              onChainPromise={onChainPromise}
            />
          </Suspense>
        </div>

        {/* Chart from core results (smaller payload) */}
        <Suspense fallback={<LoadingChart />}>
          <ResultsChartContainer resultsPromise={coreResultsPromise} />
        </Suspense>

        <div className='flex flex-col'>
          <Suspense fallback={<LoadingNonVotersTable />}>
            <NonVotersTableLazy proposalId={proposal.id} />
          </Suspense>

          {/* Full table needs full results + raw votes */}
          <Suspense fallback={<LoadingTable />}>
            <ResultsTableContainer
              resultsPromise={fullResultsPromise}
              votesPromise={votesPromise}
            />
          </Suspense>
        </div>
      </div>

      {/* Desktop list (core results), and stream bars separately when totals arrive */}
      <div className='hidden sm:block'>
        <Suspense fallback={<LoadingList />}>
          <ResultsListContainer
            resultsPromise={coreResultsPromise}
            onChainPromise={onChainPromise}
          />
        </Suspense>
        <Suspense fallback={<ResultsListBarsSkeleton />}>
          <ResultsListBarsContainer
            enrichedResultsPromise={enrichedResultsPromise}
            onChainPromise={onChainPromise}
          />
        </Suspense>
      </div>
    </div>
  );
}

async function ResultsTitleContainer({
  resultsPromise,
  governorPromise,
  publisherPromise,
}: {
  resultsPromise: Promise<Awaited<ReturnType<typeof processResultsAction>>>;
  governorPromise: ReturnType<typeof getProposalGovernorCached>;
  publisherPromise: ReturnType<typeof getVoterCached>;
}) {
  const [processedResults, governor, publisher] = await Promise.all([
    resultsPromise,
    governorPromise,
    publisherPromise,
  ]);

  const serializedResults = superjson.serialize(processedResults);
  const onChain = !(
    governor?.type?.toUpperCase().includes('SNAPSHOT') ?? false
  );

  return (
    <ResultsTitle
      results={serializedResults}
      onChain={onChain}
      publisher={publisher}
      governor={governor}
    />
  );
}

async function ResultsListContainer({
  resultsPromise,
  onChainPromise,
}: {
  resultsPromise: Promise<Awaited<ReturnType<typeof processResultsAction>>>;
  onChainPromise: Promise<boolean>;
}) {
  const [processedResults, onChain] = await Promise.all([
    resultsPromise,
    onChainPromise,
  ]);
  const serializedResults = superjson.serialize(processedResults);
  return <ResultsList results={serializedResults} onchain={onChain} />;
}

async function ResultsListBarsContainer({
  enrichedResultsPromise,
  onChainPromise,
}: {
  enrichedResultsPromise: Promise<
    Awaited<ReturnType<typeof processResultsAction>>
  >;
  onChainPromise: Promise<boolean>;
}) {
  const [processedResults, onChain] = await Promise.all([
    enrichedResultsPromise,
    onChainPromise,
  ]);
  const serializedResults = superjson.serialize(processedResults);
  return <ResultsListBars results={serializedResults} onchain={onChain} />;
}

async function ResultsChartContainer({
  resultsPromise,
}: {
  resultsPromise: Promise<Awaited<ReturnType<typeof processResultsAction>>>;
}) {
  const processedResults = await resultsPromise;
  const serializedResults = superjson.serialize(processedResults);
  return <ResultsChart results={serializedResults} />;
}

async function ResultsTableContainer({
  resultsPromise,
  votesPromise,
}: {
  resultsPromise: Promise<Awaited<ReturnType<typeof processResultsAction>>>;
  votesPromise: ReturnType<typeof getVotesWithVotersCached>;
}) {
  const [processedResults, votes] = await Promise.all([
    resultsPromise,
    votesPromise,
  ]);
  const serializedResults = superjson.serialize(processedResults);
  const serializedVotes = superjson.serialize(votes);
  return <ResultsTable results={serializedResults} votes={serializedVotes} />;
}

async function NonVotersTableLazy({ proposalId }: { proposalId: string }) {
  // const nonVoters = await getNonVoters(proposalId);

  const nonVoters = {
    totalNumberOfNonVoters: 0,
    totalVotingPower: 0,
    nonVoters: [],
    pid: proposalId,
  };

  return <NonVotersTable nonVoters={nonVoters} />;
}

function TitleLoading() {
  return <SkeletonResultsTitle />;
}

export function ResultsLoading() {
  return <SkeletonResults />;
}
