import { formatNumberWithSuffix } from '@/lib/utils';
import * as Tooltip from '@radix-ui/react-tooltip';
import { CombinedFeedItem } from '../../Feed';
import { getVotingPower_cache } from '../../actions';

export async function VotingPowerTag({ item }: { item: CombinedFeedItem }) {
  const votingPower = await getVotingPower_cache(item.id);

  if (!votingPower) return <></>;

  return (
    <div
      className='border-neutral-350 text-neutral-650 dark:text-neutral-350 flex w-fit gap-4
        rounded-xs border bg-neutral-100 p-0.5 px-2 text-xs dark:border-neutral-600
        dark:bg-neutral-900'
    >
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <div className='flex gap-2'>
            {formatNumberWithSuffix(votingPower.latestVotingPower)} ARB
            {votingPower.change !== null && (
              <div className='flex items-center gap-1'>
                <div>{votingPower.change.toFixed(2)} %</div>
                {votingPower.change > 0 ? <div>↑</div> : <div>↓</div>}
              </div>
            )}
          </div>
        </Tooltip.Trigger>
        <Tooltip.Content
          className='max-w-44 rounded border border-neutral-200 bg-white p-2 text-center text-sm
            text-neutral-700 shadow-lg'
          sideOffset={5}
        >
          {' '}
          <p>
            Voted with: {formatNumberWithSuffix(votingPower.votingPowerAtVote)}{' '}
            ARB
            <br />
            Current: {formatNumberWithSuffix(votingPower.latestVotingPower)} ARB
          </p>
        </Tooltip.Content>
      </Tooltip.Root>
    </div>
  );
}
