import { Proposal, Selectable } from '@proposalsapp/db-indexer';
import {
  DelegateInfo,
  DelegateVotingPower,
  getDelegateForVoter_cached,
  getDelegateVotingPower_cached,
  getProposalGovernor_cached,
  getVotesAction_cached,
} from './actions';
import { ResultsChart } from './result/ResultsChart';
import { ResultsList } from './result/ResultsList';
import { ResultsTable } from './result/ResultsTable';
import { processResultsAction } from '@/lib/results_processing';
import { ResultsTitle } from './result/ResultsTitle';

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

  const onChain = !governor?.type.includes('SNAPSHOT');

  return (
    <div className='flex w-full gap-2'>
      <div className='flex w-full flex-col gap-2'>
        <ResultsTitle
          processedResults={processedResults}
          onChain={onChain}
          publisher={publisher}
          governor={governor}
        />
        <ResultsChart results={processedResults} delegateMap={delegateMap} />

        <ResultsTable
          results={processedResults}
          delegateMap={delegateMap}
          votingPowerMap={votingPowerMap}
        />
      </div>

      <ResultsList results={processedResults} onchain={onChain} />
    </div>
  );
}
