import { formatNumberWithSuffix } from '@/lib/utils';
import * as Avatar from '@radix-ui/react-avatar';
import * as Tooltip from '@radix-ui/react-tooltip';
import { format, formatDistanceToNowStrict, formatISO } from 'date-fns';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { VotingPowerTag } from './VotingPowerTag';
import { GroupReturnType } from '../../../../actions';
import { getDelegateByVoterAddress_cache } from '../../actions';
import { CombinedFeedItem, VoteFeedItem } from '../../Feed';

const isVoteItem = (item: CombinedFeedItem): item is VoteFeedItem => {
  return item.type === 'vote';
};

export async function VoteItem({
  item,
  group,
}: {
  item: CombinedFeedItem;
  group: GroupReturnType;
}) {
  if (!isVoteItem(item) || !group) {
    notFound();
  }

  const proposalIds = Array.from(new Set(group.proposals.map((p) => p.id)));
  const topicIds = Array.from(new Set(group.topics.map((t) => t.id)));
  const topicExternalIds = Array.from(
    new Set(group.topics.map((t) => t.externalId))
  );

  const proposal = group.proposals.find((p) => p.id == item.proposalId);

  const delegate = await getDelegateByVoterAddress_cache(
    item.voterAddress,
    group.daoSlug,
    false,
    topicIds,
    proposalIds
  );

  const getDelegateDisplayInfo = () => {
    if (!delegate) {
      return {
        displayName: formatNameOrAddress(item.voterAddress),
        voterAddress: formatNameOrAddress(item.voterAddress),
        avatarUrl: null,
      };
    }

    const discourseUser = delegate.delegatetodiscourseuser;
    const voter = delegate.delegatetovoter;

    // Priority order: Discourse name > ENS > Shortened address
    const displayName =
      discourseUser?.name ||
      voter?.ens ||
      formatNameOrAddress(item.voterAddress);
    const voterAddress = voter?.ens || formatNameOrAddress(item.voterAddress);
    const avatarUrl = discourseUser?.avatarTemplate || null;

    return {
      displayName,
      voterAddress,
      avatarUrl,
    };
  };

  const { displayName, voterAddress, avatarUrl } = getDelegateDisplayInfo();

  const relativeCreateTime = formatDistanceToNowStrict(
    new Date(item.createdAt!),
    {
      addSuffix: true,
    }
  );
  const utcTime = format(
    formatISO(item.createdAt!),
    "MMMM do, yyyy 'at' HH:mm:ss 'UTC'"
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

  return (
    <div className='flex w-full flex-col gap-2 p-4'>
      <div style={{ width: barWidth }}>
        {Array.isArray(item.color) ? (
          <div className='flex w-full'>
            {item.color.map((color, index) => (
              <div
                key={index}
                className={'h-2'}
                style={{
                  width: `${(1 / item.color.length) * 100}%`,
                  backgroundColor: color,
                }}
              />
            ))}
          </div>
        ) : (
          <div
            className={'h-2 w-full'}
            style={{ width: '100%', backgroundColor: item.color }}
          />
        )}
      </div>

      <div className='flex cursor-default flex-row justify-between select-none'>
        {!item.aggregate && (
          <div className='flex flex-col gap-2'>
            <Suspense>
              <div className='flex flex-row items-center gap-2'>
                <Avatar.Root className='flex h-10 w-10 items-center justify-center rounded-full'>
                  <Avatar.Image
                    src={
                      avatarUrl ??
                      `https://api.dicebear.com/9.x/pixel-art/svg?seed=${displayName}`
                    }
                    className='w-full rounded-full'
                    fetchPriority='high'
                  />
                  <Avatar.Fallback>
                    {displayName.slice(0, 2).toUpperCase()}
                  </Avatar.Fallback>
                </Avatar.Root>
                <div className='flex flex-col'>
                  <div className='font-bold text-neutral-700'>
                    {displayName}
                  </div>
                  {displayName !== voterAddress && (
                    <div className='text-sm text-neutral-500'>
                      {voterAddress}
                    </div>
                  )}
                  <VotingPowerTag item={item} />
                </div>
              </div>
            </Suspense>
          </div>
        )}

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
              {' '}
              <p>{utcTime}</p>
            </Tooltip.Content>
          </Tooltip.Root>
        </div>
      </div>

      <div className='cursor-default text-neutral-700 select-none'>
        <p className='font-bold'>{formattedVotingPower} ARB</p>
        <p className='font-bold'>
          {((proposal?.choices ?? []) as string[])[item.choice as number]}
        </p>
      </div>

      <div className='flex flex-col'>
        <p className=''>{item.reason}</p>
        {match && (
          <p className='self-end'>
            <a
              href={anchorHref ?? ''}
              className='text-sm font-bold text-neutral-700 hover:underline'
            >
              jump to post →
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

const daoBaseUrlMap: { [key: string]: string } = {
  arbitrum_dao: 'https://forum.arbitrum.foundation',
};

export function formatNameOrAddress(address: string): string {
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
  if (ethAddressRegex.test(address)) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
  return address;
}
