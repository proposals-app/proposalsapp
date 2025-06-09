import {
  getActiveGroupsFeeds,
  getGroups,
  getTotalVotingPower,
} from '../[daoSlug]/actions';
import { StreamingGroupList } from '../[daoSlug]/components/streaming-group-list';
import { MarkAllAsReadButton } from '../[daoSlug]/components/mark-all-as-read';
import { Suspense } from 'react';
import { auth } from '@/lib/auth/arbitrum_auth';
import { headers } from 'next/headers';
import { ArbitrumSummaryHeader } from './components/arbitrum-summary-header';
import { LoadingGroupList, LoadingHeader } from '../[daoSlug]/loading';
import { cacheLife } from 'next/dist/server/use-cache/cache-life';
import { cacheTag } from 'next/dist/server/use-cache/cache-tag';

async function fetchBalanceForAddress(address: string): Promise<number> {
  interface TokenBalance {
    balance: string;
    decimals: number;
    quoteRate: number | null;
  }

  interface TallyResponse {
    data: {
      balances: TokenBalance[];
    };
  }

  const TALLY_API_KEY = process.env.TALLY_API_KEY;
  if (!TALLY_API_KEY) {
    console.warn(
      `[fetchBalanceForAddress] TALLY_API_KEY not set, cannot fetch balance for ${address}`
    );
    return 0;
  }

  try {
    const response = await fetch('https://api.tally.xyz/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': TALLY_API_KEY,
      },
      body: JSON.stringify({
        query: `
          query TokenBalances($input: AccountID!) {
            balances(accountID: $input) {
              decimals
              balance
              quoteRate
            }
          }
        `,
        variables: {
          input: address,
        },
      }),
      next: { revalidate: 86400 }, // Revalidate daily
    });

    if (!response.ok) {
      console.error(
        `[fetchBalanceForAddress] Failed to fetch balance for address ${address} (${response.status} ${response.statusText})`
      );
      return 0;
    }

    const data = (await response.json()) as TallyResponse;

    if (!data?.data?.balances) {
      console.warn(
        `[fetchBalanceForAddress] Invalid response structure for ${address}`
      );
      return 0;
    }

    return data.data.balances.reduce((total, token) => {
      if (token.quoteRate && token.balance && token.decimals != null) {
        // Add explicit checks for null/undefined if necessary
        const balance = Number(token.balance) / Math.pow(10, token.decimals);
        return total + balance * token.quoteRate;
      }
      return total;
    }, 0);
  } catch (error) {
    console.error(
      `[fetchBalanceForAddress] Error fetching balance for address ${address}:`,
      error
    );
    return 0;
  }
}

const getTreasuryBalance = async () => {
  'use cache';
  cacheLife('days');
  cacheTag(`treasury-arbitrum`);

  const TREASURY_ADDRESSES = [
    'eip155:42161:0x34d45e99f7D8c45ed05B5cA72D54bbD1fb3F98f0',
    'eip155:42161:0xbFc1FECa8B09A5c5D3EFfE7429eBE24b9c09EF58',
    'eip155:42161:0xF3FC178157fb3c87548bAA86F9d24BA38E649B58',
    'eip155:42161:0x2E041280627800801E90E9Ac83532fadb6cAd99A',
    'eip155:42161:0x32e7AF5A8151934F3787d0cD59EB6EDd0a736b1d',
    'eip155:42161:0xbF5041Fc07E1c866D15c749156657B8eEd0fb649',
    'eip155:42170:0x509386DbF5C0BE6fd68Df97A05fdB375136c32De',
    'eip155:42170:0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce',
    'eip155:42170:0x9fCB6F75D99029f28F6F4a1d277bae49c5CAC79f',
    'eip155:42170:0xf7951d92b0c345144506576ec13ecf5103ac905a',
  ];

  try {
    // Use Promise.allSettled to handle potential failures for individual addresses
    const results = await Promise.allSettled(
      TREASURY_ADDRESSES.map(fetchBalanceForAddress)
    );

    const totalBalance = results.reduce((sum, result) => {
      if (result.status === 'fulfilled') {
        return sum + result.value;
      } else {
        console.error(
          `[getTreasuryBalance] Failed to fetch balance for an address: ${result.reason}`
        );
        return sum; // Exclude failed fetches from the total
      }
    }, 0);

    return totalBalance;
  } catch (error) {
    console.error(
      `[getTreasuryBalance] Error calculating total treasury balance for arbitrum:`,
      error
    );
    return null;
  }
};

const getTokenPrice = async () => {
  'use cache';
  cacheLife('hours');
  cacheTag(`token-price-arbitrum`);

  try {
    const url = `https://api.coingecko.com/api/v3/coins/arbitrum/market_chart?vs_currency=usd&days=1`;
    const res = await fetch(url, { next: { revalidate: 3600 } }); // Revalidate hourly

    if (!res.ok) {
      console.error(
        `[getTokenPrice] Failed to fetch price data (${res.status} ${res.statusText}) for arbitrum from ${url}`
      );
      return null;
    }

    const data = await res.json();
    if (data?.prices?.length > 0) {
      const latestPrice = data.prices[data.prices.length - 1][1];
      return latestPrice as number;
    }
    console.warn(`[getTokenPrice] No price data found for arbitrum`);
    return null;
  } catch (error) {
    console.error(
      `[getTokenPrice] Error fetching token price for arbitrum:`,
      error
    );
    return null;
  }
};

export default async function Page() {
  // Hardcode the daoSlug for Arbitrum
  const daoSlug = 'arbitrum';

  // Get session at the page level to avoid dynamic context issues
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;

  return (
    <div className='flex min-h-screen w-full justify-center bg-neutral-50 dark:bg-neutral-900'>
      <div className='w-full max-w-5xl px-4 py-6 md:px-8 md:py-10'>
        {/* Summary Header - loads financial data independently */}
        <Suspense fallback={<LoadingHeader />}>
          <ArbitrumSummaryContainer daoSlug={daoSlug} userId={userId} />
        </Suspense>

        {/* Action Bar - loads groups data independently */}
        <Suspense fallback={<ActionBarSkeleton />}>
          <ActionBarContainer daoSlug={daoSlug} userId={userId} />
        </Suspense>

        {/* Groups List - loads with pre-fetched active feeds */}
        <Suspense fallback={<LoadingGroupList />}>
          <GroupsContainer daoSlug={daoSlug} userId={userId} />
        </Suspense>
      </div>
    </div>
  );
}

// Optimized header that fetches financial data and groups data in parallel
async function ArbitrumSummaryContainer({
  daoSlug,
  userId,
}: {
  daoSlug: string;
  userId?: string;
}) {
  // Fetch groups data and financial data in parallel
  const [result, tokenPrice, treasuryBalance] = await Promise.all([
    getGroups(daoSlug, userId),
    getTokenPrice(),
    getTreasuryBalance(),
  ]);

  if (!result) return null;

  const { groups, daoId } = result;

  // Get active and inactive groups counts
  const activeGroupsCount = groups.filter((g) => g.hasActiveProposal).length;
  const totalProposalsCount = groups.reduce(
    (sum, group) => sum + group.proposalsCount,
    0
  );
  const totalTopicsCount = groups.reduce(
    (sum, group) => sum + group.topicsCount,
    0
  );

  // Fetch total VP separately to avoid blocking the UI
  return (
    <Suspense fallback={<LoadingHeader />}>
      <ArbitrumHeaderWithVP
        activeGroupsCount={activeGroupsCount}
        totalProposalsCount={totalProposalsCount}
        totalTopicsCount={totalTopicsCount}
        tokenPrice={tokenPrice}
        treasuryBalance={treasuryBalance}
        daoId={daoId}
      />
    </Suspense>
  );
}

// Separate component for total VP to avoid blocking
async function ArbitrumHeaderWithVP({
  activeGroupsCount,
  totalProposalsCount,
  totalTopicsCount,
  tokenPrice,
  treasuryBalance,
  daoId,
}: {
  activeGroupsCount: number;
  totalProposalsCount: number;
  totalTopicsCount: number;
  tokenPrice: number | null;
  treasuryBalance: number | null;
  daoId: string;
}) {
  const totalVp = await getTotalVotingPower(daoId);

  return (
    <ArbitrumSummaryHeader
      activeGroupsCount={activeGroupsCount}
      totalProposalsCount={totalProposalsCount}
      totalTopicsCount={totalTopicsCount}
      tokenPrice={tokenPrice}
      totalVp={totalVp}
      treasuryBalance={treasuryBalance}
    />
  );
}

// Optimized action bar that only fetches what it needs
async function ActionBarContainer({
  daoSlug,
  userId,
}: {
  daoSlug: string;
  userId?: string;
}) {
  const result = await getGroups(daoSlug, userId);
  if (!result) return null;

  const hasNewActivityInGroups = result.groups.some(
    (group) => group.hasNewActivity
  );

  return (
    <div className='mb-6 flex flex-col items-start justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0'>
      <h2 className='text-xl font-semibold text-neutral-700 dark:text-neutral-300'>
        All Proposal Groups
      </h2>
      {hasNewActivityInGroups && <MarkAllAsReadButton />}
    </div>
  );
}

// Optimized groups container with pre-fetched active feeds
async function GroupsContainer({
  daoSlug,
  userId,
}: {
  daoSlug: string;
  userId?: string;
}) {
  const result = await getGroups(daoSlug, userId);
  if (!result) return null;

  const { groups } = result;

  // Get IDs of groups with active proposals and fetch feeds in parallel
  const activeGroupIds = groups
    .filter((group) => group.hasActiveProposal)
    .map((group) => group.id);

  const activeGroupsFeeds =
    activeGroupIds.length > 0
      ? await getActiveGroupsFeeds(activeGroupIds, daoSlug)
      : new Map();

  // Transform data with pre-fetched feed data
  const groupsWithInfo = groups.map((group) => {
    const feedData = activeGroupsFeeds.get(group.id);

    return {
      id: group.id,
      name: group.name,
      slug: group.slug,
      authorName: group.originalAuthorName,
      authorAvatarUrl: group.originalAuthorPicture,
      latestActivityAt: new Date(group.newestActivityTimestamp),
      hasNewActivity: group.hasNewActivity,
      hasActiveProposal: group.hasActiveProposal,
      topicsCount: group.topicsCount,
      proposalsCount: group.proposalsCount,
      votesCount: group.votesCount,
      postsCount: group.postsCount,
      // Pre-computed feed data for active groups
      activeFeedData: feedData || null,
    };
  });

  return (
    <StreamingGroupList
      initialGroups={groupsWithInfo}
      signedIn={userId ? true : false}
    />
  );
}

// Action bar skeleton
function ActionBarSkeleton() {
  return (
    <div className='mb-6 flex flex-col items-start justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0'>
      <div className='h-7 w-48 animate-pulse rounded-xs bg-neutral-200 dark:bg-neutral-700' />
      <div className='h-9 w-32 animate-pulse rounded-xs bg-neutral-200 dark:bg-neutral-700' />
    </div>
  );
}
