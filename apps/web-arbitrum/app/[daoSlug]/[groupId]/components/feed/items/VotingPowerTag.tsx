import { formatNumberWithSuffix } from '@/lib/utils';
import * as Tooltip from '@radix-ui/react-tooltip';
import { unstable_cache } from 'next/cache';
import { CombinedFeedItem } from '../Feed';
import { getVotingPower } from '../actions';

const getVotingPowerCached = unstable_cache(
  async (itemId: string) => {
    return await getVotingPower(itemId);
  },
  ['voting-power'],
  { revalidate: 60 * 5, tags: ['voting-power'] }
);

export async function VotingPowerTag({ item }: { item: CombinedFeedItem }) {
  const votingPower = await getVotingPowerCached(item.id);

  if (!votingPower) return <></>;

  return (
    <div
      className='flex w-fit gap-4 rounded-lg border border-neutral-300 bg-neutral-100 p-0.5
        text-xs text-neutral-650 dark:border-neutral-700 dark:bg-neutral-800
        dark:text-neutral-300'
    >
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <div className='flex gap-2'>
              {formatNumberWithSuffix(votingPower.latestVotingPower)} ARB
              {votingPower.change !== null &&
                votingPower.change !== 0 &&
                (votingPower.change > 0.01 || votingPower.change < 0.01) && (
                  <div className='flex items-center gap-1'>
                    <div>{votingPower.change.toFixed(2)} %</div>
                    {votingPower.change > 0 ? <div>↑</div> : <div>↓</div>}
                  </div>
                )}
            </div>
          </Tooltip.Trigger>
          <Tooltip.Content className='rounded p-2 shadow-lg'>
            <p>
              Voting Power at Vote:{' '}
              {formatNumberWithSuffix(votingPower.votingPowerAtVote)} ARB
              <br />
              Latest Voting Power:{' '}
              {formatNumberWithSuffix(votingPower.latestVotingPower)} ARB
            </p>
            <Tooltip.Arrow className='fill-gray-800' />
          </Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>
    </div>
  );
}
