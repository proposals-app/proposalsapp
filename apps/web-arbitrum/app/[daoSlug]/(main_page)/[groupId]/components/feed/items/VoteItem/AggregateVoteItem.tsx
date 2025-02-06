import { formatNumberWithSuffix } from '@/lib/utils';
import * as Tooltip from '@radix-ui/react-tooltip';
import { formatDistanceToNowStrict } from 'date-fns';
import { notFound } from 'next/navigation';
import { CombinedFeedItem, VoteFeedItem } from '../../Feed';
import { GroupReturnType } from '../../../../actions';
import Image from 'next/image';

const isVoteItem = (item: CombinedFeedItem): item is VoteFeedItem => {
  return item.type === 'vote';
};

export async function AggregateVoteItem({
  item,
  group,
}: {
  item: CombinedFeedItem;
  group: GroupReturnType;
}) {
  if (!isVoteItem(item) || !group) {
    notFound();
  }

  const proposal = group.proposals.find((p) => p.id == item.proposalId);

  const relativeCreateTime = formatDistanceToNowStrict(
    new Date(item.createdAt!),
    { addSuffix: true }
  );

  const formattedVotingPower = item.votingPower
    ? formatNumberWithSuffix(item.votingPower)
    : '0';

  const optionText =
    ((proposal?.choices ?? []) as string[])[item.choice as number] || '';

  return (
    <div className='flex items-center justify-between gap-2 p-4'>
      <div className='flex items-center gap-2 opacity-50'>
        <div
          className='h-10 w-10 overflow-hidden rounded-full border-2 border-neutral-700
            dark:border-neutral-300'
        >
          <Image
            src={`https://api.dicebear.com/9.x/pixel-art/png?seed=${item.votingPower}`}
            className='rounded-full'
            fetchPriority='high'
            width={40}
            height={40}
            alt={'Aggregated votes'}
          />
        </div>
        <div className='flex flex-col'>
          <div className='font-bold text-neutral-700'>
            Multiple {optionText} votes with {formattedVotingPower} ARB
          </div>
        </div>
      </div>

      <div className='text-neutral-450 flex flex-col items-end text-sm'>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <div>
              voted <span className='font-bold'>{relativeCreateTime}</span>
            </div>
          </Tooltip.Trigger>
          <Tooltip.Content
            className='max-w-44 rounded border border-neutral-200 bg-white p-2 text-center text-sm
              text-neutral-700 shadow-lg'
            sideOffset={5}
          >
            Voted at{' '}
            {formatDistanceToNowStrict(new Date(item.createdAt!), {
              addSuffix: true,
            })}
          </Tooltip.Content>
        </Tooltip.Root>
      </div>
    </div>
  );
}
