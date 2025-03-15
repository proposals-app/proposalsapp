import { formatNumberWithSuffix } from '@/lib/utils';
import { formatDistanceToNowStrict } from 'date-fns';
import { notFound } from 'next/navigation';
import { VotingPowerTag } from './VotingPowerTag';
import { FeedReturnType, GroupReturnType } from '../../../../actions';
import { getDelegateByVoterAddress_cache } from '../../actions';
import Image from 'next/image';

export async function VoteItem({
  item,
  group,
}: {
  item: FeedReturnType['votes'][0];
  group: GroupReturnType;
}) {
  if (!group) {
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
      <div style={{ width: barWidth }} className='opacity-30'>
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
        <div className='flex flex-col gap-2'>
          <div className='flex flex-row items-center gap-2'>
            <div
              className='flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2
                border-neutral-700 dark:border-neutral-300'
            >
              <Image
                src={
                  avatarUrl ??
                  `https://api.dicebear.com/9.x/pixel-art/png?seed=${displayName}`
                }
                className='rounded-full'
                fetchPriority='high'
                alt={displayName}
                width={40}
                height={40}
              />
            </div>
            <div className='flex flex-col'>
              <div>
                <span className='font-bold text-neutral-800 dark:text-neutral-200'>
                  {displayName}
                </span>
                {displayName !== voterAddress && (
                  <span className='text-neutral-450 dark:text-neutral-350 text-sm'>
                    {' '}
                    with <span className='font-bold'>{voterAddress}</span>
                  </span>
                )}
              </div>
              <VotingPowerTag item={item} />
            </div>
          </div>
        </div>

        <div className='dark:text-neutral-350 flex flex-col items-end text-sm text-neutral-600'>
          <div>
            voted <span className='font-bold'>{relativeCreateTime}</span>
          </div>
        </div>
      </div>

      <div className='cursor-default text-neutral-700 select-none dark:text-neutral-200'>
        <span className=''>{formattedVotingPower} ARB </span>
        <span className='font-bold'>
          {((proposal?.choices ?? []) as string[])[item.choice as number]}
        </span>
      </div>

      <div className='flex flex-col'>
        <p className=''>{item.reason}</p>
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

export function VoteItemLoading() {
  return (
    <div className='flex w-full flex-col gap-2 p-4'>
      <div className='h-2 w-2/3 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800' />

      <div className='flex cursor-default flex-row justify-between select-none'>
        <div className='flex flex-row items-center gap-2'>
          <div className='h-10 w-10 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800' />
          <div className='flex flex-col gap-1'>
            <div className='h-4 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800' />
            <div className='h-3 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800' />
          </div>
        </div>
        <div className='flex flex-col items-end'>
          <div className='h-4 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800' />
        </div>
      </div>

      <div className='h-4 w-36 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800' />

      <div className='space-y-2'>
        <div className='h-4 w-5/6 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800' />
        <div className='h-4 w-4/6 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800' />
      </div>
    </div>
  );
}
