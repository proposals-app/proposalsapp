import {
  getActiveGroupsFeeds,
  getGroups,
  getTotalVotingPower,
} from '../[daoSlug]/actions';
import { StreamingGroupList } from '../[daoSlug]/components/streaming-group-list';
import { MarkAllAsReadButton } from '../[daoSlug]/components/mark-all-as-read';
import { Suspense } from 'react';
import { auth } from '@/lib/auth/uniswap_auth';
import { headers } from 'next/headers';
import { UniswapSummaryHeader } from './components/uniswap-summary-header';
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
  cacheTag(`treasury-uniswap`);

  const TREASURY_ADDRESSES = [
    'eip155:1:0x1a9C8182C09F50C8318d769245beA52c32BE35BC',
    'eip155:1:0xe571dC7A558bb6D68FfE264c3d7BB98B0C6C73fC',
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
      `[getTreasuryBalance] Error calculating total treasury balance for uniswap:`,
      error
    );
    return null;
  }
};

const getTokenPrice = async () => {
  'use cache';
  cacheLife('hours');
  cacheTag(`token-price-uniswap`);

  try {
    const url = `https://api.coingecko.com/api/v3/coins/uniswap/market_chart?vs_currency=usd&days=1`;
    const res = await fetch(url, { next: { revalidate: 3600 } }); // Revalidate hourly

    if (!res.ok) {
      console.error(
        `[getTokenPrice] Failed to fetch price data (${res.status} ${res.statusText}) for uniswap from ${url}`
      );
      return null;
    }

    const data = await res.json();
    if (data?.prices?.length > 0) {
      const latestPrice = data.prices[data.prices.length - 1][1];
      return latestPrice as number;
    }
    console.warn(`[getTokenPrice] No price data found for uniswap`);
    return null;
  } catch (error) {
    console.error(
      `[getTokenPrice] Error fetching token price for uniswap:`,
      error
    );
    return null;
  }
};

export default async function Page() {
  // Hardcode the daoSlug for Uniswap
  const daoSlug = 'uniswap';

  return (
    <div className='flex min-h-screen w-full justify-center bg-neutral-50 dark:bg-neutral-900'>
      <div className='w-full max-w-5xl px-4 py-6 md:px-8 md:py-10'>
        {/* Summary Header */}
        <Suspense fallback={<LoadingHeader />}>
          <UniswapHeader daoSlug={daoSlug} />
        </Suspense>

        {/* Action Bar */}
        <Suspense fallback={<ActionBarSkeleton />}>
          <ActionBar daoSlug={daoSlug} />
        </Suspense>

        {/* Groups List */}
        <Suspense fallback={<LoadingGroupList />}>
          <GroupsContent daoSlug={daoSlug} />
        </Suspense>
      </div>
    </div>
  );
}

// Header component with financial data
async function UniswapHeader({ daoSlug }: { daoSlug: string }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;

  const result = await getGroups(daoSlug, userId);
  if (!result) return null;

  const { groups } = result;

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

  // Fetch financial data in parallel
  const [tokenPrice, treasuryBalance, totalVp] = await Promise.all([
    getTokenPrice(),
    getTreasuryBalance(),
    getTotalVotingPower(result.daoId),
  ]);

  return (
    <UniswapSummaryHeader
      activeGroupsCount={activeGroupsCount}
      totalProposalsCount={totalProposalsCount}
      totalTopicsCount={totalTopicsCount}
      tokenPrice={tokenPrice}
      totalVp={totalVp}
      treasuryBalance={treasuryBalance}
    />
  );
}

// Action bar component
async function ActionBar({ daoSlug }: { daoSlug: string }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;

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

// Main content component
async function GroupsContent({ daoSlug }: { daoSlug: string }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;

  const result = await getGroups(daoSlug, userId);
  if (!result) return null;

  const { groups } = result;

  // Get IDs of groups with active proposals
  const activeGroupIds = groups
    .filter((group) => group.hasActiveProposal)
    .map((group) => group.id);

  // Fetch all active group feeds in parallel
  const activeGroupsFeeds = await getActiveGroupsFeeds(activeGroupIds, daoSlug);

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
