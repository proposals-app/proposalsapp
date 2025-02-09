import { Proposal, Selectable } from '@proposalsapp/db';
import { Suspense } from 'react';
import {
  DelegateInfo,
  DelegateVotingPower,
  getDelegateForVoter_cached,
  getDelegateVotingPower_cached,
  getProposalGovernor_cached,
  getVotesAction_cached,
} from './actions';
import { LoadingChart, ResultsChart } from './result/ResultsChart';
import { LoadingList, ResultsList } from './result/ResultsList';
import { LoadingTable, ResultsTable } from './result/ResultsTable';
import { processResultsAction } from '@/lib/results_processing';
import Link from 'next/link';
import ExternalLinkIcon from '@/public/assets/web/arrow_external_link.svg';
import OnchainIcon from '@/public/assets/web/onchain.svg';
import OffchainIcon from '@/public/assets/web/offchain.svg';
import { format } from 'date-fns';

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

// New component to handle the async content
async function ResultsContent({ proposal, daoSlug }: ResultsProps) {
  const votes = await getVotesAction_cached(proposal.id);

  // Create maps for delegate info and voting power
  const delegateMap = new Map<string, DelegateInfo>();
  const votingPowerMap = new Map<string, DelegateVotingPower>();

  // Fetch delegate information and voting power for all voters
  await Promise.all(
    votes.map(async (vote) => {
      if (vote.votingPower > 50000) {
        const [delegate, votingPower] = await Promise.all([
          getDelegateForVoter_cached(vote.voterAddress, daoSlug, proposal.id),
          getDelegateVotingPower_cached(
            vote.voterAddress,
            daoSlug,
            proposal.id
          ),
        ]);
        delegateMap.set(vote.voterAddress, delegate);
        if (votingPower) {
          votingPowerMap.set(vote.voterAddress, votingPower);
        }
      }
    })
  );

  const processedResults = await processResultsAction(proposal, votes, {
    withVotes: true,
    withTimeseries: true,
    aggregatedVotes: false,
  });

  const governor = await getProposalGovernor_cached(proposal.id);
  const publisher = await getDelegateForVoter_cached(
    processedResults.proposal.author ?? '',
    daoSlug,
    proposal.id
  );

  const onChain = !governor?.indexerVariant.includes('SNAPSHOT');

  return (
    <div className='flex w-full flex-col'>
      <div className='flex w-full'>
        <div className='flex w-full flex-col'>
          <div className='flex flex-col'>
            <div className='text-2xl font-bold'>
              {processedResults.proposal.name}
            </div>
            <div className='flex items-center gap-4 text-xs'>
              <div>
                Published {onChain ? 'onchain' : 'offchain'} by{' '}
                <span className='font-bold'>
                  {publisher?.ens ?? publisher?.address}
                </span>{' '}
                at{' '}
                <span className='font-bold'>
                  {format(processedResults.proposal.createdAt, 'MMM d, yyyy')}
                </span>
              </div>
              <Link
                className='flex items-center gap-1 rounded-xs bg-neutral-100 px-2'
                href={processedResults.proposal.url}
                target='_blank'
              >
                {onChain ? (
                  <OnchainIcon
                    width={24}
                    height={24}
                    alt={'Go to governor'}
                    className='fill-neutral-800'
                  />
                ) : (
                  <OffchainIcon
                    width={24}
                    height={24}
                    alt={'Go to governor'}
                    className='fill-neutral-800'
                  />
                )}
                <div className='font-bold text-neutral-800'>
                  {governor?.name}
                </div>
                <ExternalLinkIcon
                  width={24}
                  height={24}
                  alt={'Go to governor'}
                  className='fill-neutral-400'
                />
              </Link>
            </div>
          </div>

          <ResultsChart results={processedResults} delegateMap={delegateMap} />
          <ResultsTable
            results={processedResults}
            delegateMap={delegateMap}
            votingPowerMap={votingPowerMap}
          />
        </div>
        <ResultsList results={processedResults} onchain={onChain} />
      </div>
    </div>
  );
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
    <div className='flex w-full gap-2'>
      <div className='flex w-full flex-col gap-2'>
        <TitleLoading />
        <LoadingChart />
        <LoadingTable />
      </div>
      <LoadingList />
    </div>
  );
}
