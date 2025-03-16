import { formatNumberWithSuffix } from '@/lib/utils';
import { formatDistanceToNowStrict } from 'date-fns';
import { notFound } from 'next/navigation';
import { FeedReturnType, GroupReturnType } from '../../../../actions';
import Image from 'next/image';
import { ProcessedVote } from '@/lib/results_processing';
import { ProposalMetadata } from '@/app/types';

export async function AggregateVoteItem({
  item,
  group,
}: {
  item: FeedReturnType['votes'][0];
  group: GroupReturnType;
}) {
  if (!group) {
    notFound();
  }

  const proposal = group.proposals.find((p) => p.id === item.proposalId);
  const proposalMetadata = proposal?.metadata as ProposalMetadata;
  const isWeightedVoting = proposalMetadata.voteType === 'weighted';

  const relativeCreateTime = formatDistanceToNowStrict(
    new Date(item.createdAt!),
    { addSuffix: true }
  );

  const formattedVotingPower = item.votingPower
    ? formatNumberWithSuffix(item.votingPower)
    : '0';

  // Get choice text from the vote
  const getAggregatedChoiceDisplay = () => {
    if (
      !item.choice ||
      !Array.isArray(item.choice) ||
      item.choice.length === 0
    ) {
      return 'Unknown Choice';
    }

    // For weighted voting, include weights
    if (isWeightedVoting && item.choice.length > 1) {
      return item.choice
        .map((choice) => `${Math.round(choice.weight)}% ${choice.text}`)
        .join(', ');
    }

    // For single choice or approval voting, just list the choices
    return item.choice.map((choice) => choice.text).join(', ');
  };

  const choiceDisplay = getAggregatedChoiceDisplay();

  // Determine if this is approval voting or similar
  const isApprovalStyle =
    item.choice &&
    item.choice.length > 1 &&
    item.choice.every((c) => c.weight === 100);

  // Calculate total height for the color bar
  const colorBarHeight = isApprovalStyle
    ? `${item.choice.length * 2}px`
    : '2px';

  return (
    <div className='p-4'>
      <div className='flex items-center justify-between gap-2'>
        <div className='flex items-center gap-2 opacity-50'>
          <div
            className='flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2
              border-neutral-700 dark:border-neutral-300'
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
              Multiple votes for {choiceDisplay} with {formattedVotingPower} ARB
            </div>
          </div>
        </div>

        <div className='text-neutral-450 flex flex-col items-end text-sm'>
          <div className='group relative'>
            <div>
              voted <span className='font-bold'>{relativeCreateTime}</span>
            </div>
            <div
              className='absolute right-0 bottom-full z-10 mb-2 hidden max-w-44 rounded border
                border-neutral-200 bg-white p-2 text-center text-sm text-neutral-700 shadow-lg
                group-hover:block'
            >
              Voted at{' '}
              {formatDistanceToNowStrict(new Date(item.createdAt!), {
                addSuffix: true,
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Add the color bar for aggregated votes */}
      <div
        className='mb-2 w-full opacity-30'
        style={{ height: colorBarHeight }}
      >
        {item.choice && item.choice.length > 0 && (
          <div className='flex h-full w-full flex-wrap'>
            {item.choice.map((choiceItem, idx) => {
              // If approval style voting (multiple 100% weights), each takes full width
              // Otherwise, width is proportional to weight
              const itemWidth = isApprovalStyle
                ? '100%'
                : `${choiceItem.weight}%`;

              return (
                <div
                  key={idx}
                  className='h-2'
                  style={{
                    width: itemWidth,
                    backgroundColor: choiceItem.color,
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
