import {
  getActiveGroupsFeeds,
  getGroups,
  getTotalVotingPower,
} from '../[daoSlug]/actions';
import { GroupList } from '../[daoSlug]/components/group-list';
import { UniswapActionBarClient } from './components/uniswap-action-bar-client';
import { Suspense } from 'react';
import { auth } from '@/lib/auth/uniswap_auth';
import { headers } from 'next/headers';
import { UniswapSummaryHeader } from './components/uniswap-summary-header';
import {
  LoadingGroupList,
  LoadingHeader,
  SkeletonActionBar,
} from '@/app/components/ui/skeleton';

const TREASURY_ADDRESSES = [
  { address: '0x1a9C8182C09F50C8318d769245beA52c32BE35BC', chainId: 1 },
  { address: '0x4B4e140D1f131fdaD6fb59C13AF796fD194e4135', chainId: 1 },
];

async function fetchBalanceForAddress(
  accountAddress: string,
  chainId: number
): Promise<number> {
  const TALLY_API_KEY = process.env.TALLY_API_KEY;
  if (!TALLY_API_KEY) {
    return 0;
  }

  try {
    const response = await fetch('https://api.tally.xyz/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-key': TALLY_API_KEY,
      },
      body: JSON.stringify({
        query: `
          query AccountBalances($accountAddress: Address!, $chainId: ChainID!) {
            account(address: $accountAddress, chainId: $chainId) {
              address
              balances {
                aggregate {
                  amount
                }
                token {
                  symbol
                  decimals
                }
                quote {
                  quoteRate
                }
              }
            }
          }
        `,
        variables: {
          accountAddress,
          chainId: chainId.toString(),
        },
      }),
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      console.error(`Tally API error for ${accountAddress}: ${response.status}`);
      return 0;
    }

    const data = await response.json();
    const balances = data.data?.account?.balances || [];

    const totalUsd = balances.reduce(
      (
        sum: number,
        balance: {
          aggregate: { amount?: string };
          token: { decimals: number; symbol?: string };
          quote?: { quoteRate?: number };
        }
      ) => {
        const amount = parseFloat(balance.aggregate.amount || '0');
        const decimals = balance.token.decimals;
        const quoteRate = balance.quote?.quoteRate || 0;
        const value = (amount / Math.pow(10, decimals)) * quoteRate;
        return sum + value;
      },
      0
    );

    return totalUsd;
  } catch (error) {
    console.error(
      `Error fetching balance for ${accountAddress} on chain ${chainId}:`,
      error
    );
    return 0;
  }
}

const getTreasuryBalance = async () => {
  try {
    const results = await Promise.allSettled(
      TREASURY_ADDRESSES.map(({ address, chainId }) =>
        fetchBalanceForAddress(address, chainId)
      )
    );

    let totalBalanceUsd = 0;
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value > 0) {
        totalBalanceUsd += result.value;
      }
    });

    return totalBalanceUsd;
  } catch (error) {
    console.error(
      `[getTreasuryBalance] Error fetching treasury balance:`,
      error
    );
    return null;
  }
};

const getTokenPrice = async () => {
  try {
    const url =
      'https://api.coingecko.com/api/v3/coins/uniswap/market_chart?vs_currency=usd&days=1';
    const response = await fetch(url, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      console.error(`CoinGecko API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.prices && data.prices.length > 0) {
      return data.prices[data.prices.length - 1][1];
    }
    return null;
  } catch (error) {
    console.error(`[getTokenPrice] Error fetching token price:`, error);
    return null;
  }
};

export default async function Page() {
  // Hardcode the daoSlug for Uniswap
  const daoSlug = 'uniswap';

  // Get session at the page level to avoid dynamic context issues
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;

  return (
    <div className='flex min-h-screen w-full justify-center bg-neutral-50 dark:bg-neutral-900'>
      <div className='w-full max-w-5xl px-4 py-6 md:px-8 md:py-10'>
        {/* Summary Header - loads financial data independently */}
        <Suspense fallback={<LoadingHeader />}>
          <UniswapSummaryContainer daoSlug={daoSlug} userId={userId} />
        </Suspense>

        {/* Action Bar - loads groups data independently */}
        <Suspense fallback={<SkeletonActionBar />}>
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
async function UniswapSummaryContainer({
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

  // Fetch total voting power
  const totalVp = await getTotalVotingPower(daoId);

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
    <UniswapActionBarClient
      hasNewActivity={hasNewActivityInGroups}
      signedIn={userId ? true : false}
    />
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
      ? await getActiveGroupsFeeds(activeGroupIds)
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
    <GroupList
      initialGroups={groupsWithInfo}
      signedIn={userId ? true : false}
    />
  );
}
