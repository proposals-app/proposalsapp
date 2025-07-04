import { formatNumberWithSuffix } from '@/lib/utils';
import { formatDistanceToNowStrict } from 'date-fns';
import { notFound } from 'next/navigation';
import type { FeedReturnType, GroupReturnType } from '../../../../actions';
import type { ProcessedVote } from '@/lib/results_processing';
import { VoterAuthor } from '@/app/(dao)/[daoSlug]/components/author/author-voter';
import type { VotesWithVoters } from '@/app/(dao)/[daoSlug]/(results_page)/[groupId]/vote/[resultNumber]/components/actions';
import type { ProposalMetadata } from '@/lib/types';
import { SkeletonVoteItemFeed } from '@/app/components/ui/skeleton';

// Helper to format choice text, similar to the one in ResultsTable
const getChoiceText = (vote: ProcessedVote, isWeighted = false): string => {
  if (!vote.choice || vote.choice.length === 0) return 'Unknown Choice';

  if (isWeighted && vote.choice.length > 1) {
    // For weighted voting, include the weight percentage
    return vote.choice
      .map((choice) => `${Math.round(choice.weight)}% for ${choice.text}`)
      .join(', ');
  } else {
    // For other voting types, just show the choice text
    return vote.choice.map((choice) => choice.text).join(', ');
  }
};

export async function VoteItem({
  item,
  voteWithVoter,
  group,
}: {
  item: FeedReturnType['votes'][0];
  voteWithVoter: VotesWithVoters[0];
  group: GroupReturnType;
}) {
  if (!group) {
    notFound();
  }

  const topicExternalIds = Array.from(
    new Set(group.topics.map((t) => t.externalId))
  );

  const proposal = group.proposals.find((p) => p.id === item.proposalId);
  const proposalMetadata = proposal?.metadata as ProposalMetadata;
  const isWeightedVoting = proposalMetadata.voteType === 'weighted';

  const relativeCreateTime = formatDistanceToNowStrict(
    new Date(item.createdAt!),
    {
      addSuffix: true,
    }
  );

  const formattedVotingPower = item.votingPower
    ? formatNumberWithSuffix(item.votingPower)
    : '0';

  const barWidth = `${(item.relativeVotingPower || 0) * 100}%`;

  const baseUrl = daoBaseUrlMap[group.daoSlug] || '';
  const urlPattern = new RegExp(`${baseUrl}/t/[^/]+/(\\d+)/(\\d+)(?:\\?.*)?`);
  let match = item.reason?.match(urlPattern);

  let anchorHref: string | null = null;
  if (match) {
    const topicId = match[1];
    const postNumber = match[2];
    if (topicExternalIds.includes(parseInt(topicId)))
      anchorHref = `#post-${postNumber}-${topicId}`;
    else match = null;
  }

  // Get formatted choice text
  const choiceText = getChoiceText(item as ProcessedVote, isWeightedVoting);

  // Determine if this is approval voting or similar
  const isApprovalStyle =
    item.choice &&
    item.choice.length > 1 &&
    item.choice.every((c) => c.weight === 100);

  // Calculate total height for the color bar based on number of choices in approval voting
  const colorBarHeight = isApprovalStyle
    ? `${item.choice.length * 2}px`
    : '2px';

  return (
    <div className='flex w-full flex-col gap-2 py-4'>
      {/* Updated color bar with improved weight handling */}
      <div
        className='mb-2 w-full opacity-30'
        style={{
          width: barWidth,
          height: colorBarHeight,
        }}
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

      <div className='flex cursor-default flex-row justify-between select-none'>
        <VoterAuthor
          voterAddress={voteWithVoter.voterAddress}
          ens={voteWithVoter.ens}
          avatar={voteWithVoter.avatar}
          discourseUsername={voteWithVoter.discourseUsername}
          currentVotingPower={voteWithVoter.latestVotingPower}
          eventVotingPower={voteWithVoter.votingPower}
        />

        <div className='dark:text-neutral-350 text-sm text-neutral-600'>
          <span>voted </span>
          <span className='font-bold'>{relativeCreateTime}</span>
        </div>
      </div>

      <div className='cursor-default text-neutral-700 select-none dark:text-neutral-200'>
        <span className=''>{formattedVotingPower} ARB </span>
        <span className='font-bold'>{choiceText}</span>
      </div>

      <div className='flex flex-col'>
        <p className='break-words text-ellipsis'>{item.reason}</p>
        {match && (
          <p className='self-end'>
            <a
              href={anchorHref ?? ''}
              className='dark:text-neutral-350 text-sm font-bold text-neutral-600 hover:underline'
            >
              jump to post →
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

export function VoteItemLoading() {
  return <SkeletonVoteItemFeed />;
}

const daoBaseUrlMap: { [key: string]: string } = {
  arbitrum: 'https://forum.arbitrum.foundation',
};

export function formatNameOrAddress(address: string): string {
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
  if (ethAddressRegex.test(address)) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
  return address;
}
