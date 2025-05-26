import { getGroups, getTotalVotingPower } from '../[daoSlug]/actions';
import { GroupList } from '../[daoSlug]/components/group-list';
import { MarkAllAsReadButton } from '../[daoSlug]/components/mark-all-as-read';
import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { ActiveGroupItem } from '../[daoSlug]/components/group-items/active-item';
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
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;

  // Hardcode the daoSlug for Uniswap
  const daoSlug = 'uniswap';

  const result = await getGroups(daoSlug, userId);

  if (!result) {
    return null;
  }

  const { groups } = result;

  // Transform data - items no longer needed here
  const groupsWithInfo = groups.map((group) => {
    const groupItem = {
      id: group.id,
      name: group.name,
      slug: `${group.id}`,
      authorName: group.originalAuthorName,
      authorAvatarUrl: group.originalAuthorPicture,
      latestActivityAt: new Date(group.newestActivityTimestamp),
      hasNewActivity: group.hasNewActivity,
      hasActiveProposal: group.hasActiveProposal,
      topicsCount: group.topicsCount,
      proposalsCount: group.proposalsCount,
      votesCount: group.votesCount,
      postsCount: group.postsCount,
    };
    return {
      ...groupItem,
      resultCard: group.hasActiveProposal ? (
        <ActiveGroupItem group={groupItem} />
      ) : null,
    };
  });

  const hasNewActivityInGroups = groupsWithInfo.some(
    (group) => group.hasNewActivity
  );

  // Get active and inactive groups counts
  const activeGroupsCount = groupsWithInfo.filter(
    (g) => g.hasActiveProposal
  ).length;
  const totalProposalsCount = groupsWithInfo.reduce(
    (sum, group) => sum + group.proposalsCount,
    0
  );
  const totalTopicsCount = groupsWithInfo.reduce(
    (sum, group) => sum + group.topicsCount,
    0
  );

  // Fetch financial data
  const tokenPrice = await getTokenPrice();
  const treasuryBalance = await getTreasuryBalance();
  const totalVp = await getTotalVotingPower(result.daoId);

  return (
    <div className='flex min-h-screen w-full justify-center bg-neutral-50 dark:bg-neutral-900'>
      <div className='w-full max-w-5xl px-4 py-6 md:px-8 md:py-10'>
        <Suspense fallback={<LoadingHeader />}>
          <UniswapSummaryHeader
            activeGroupsCount={activeGroupsCount}
            totalProposalsCount={totalProposalsCount}
            totalTopicsCount={totalTopicsCount}
            tokenPrice={tokenPrice}
            totalVp={totalVp}
            treasuryBalance={treasuryBalance}
          />
        </Suspense>

        {/* Action Bar */}
        <div className='mb-6 flex flex-col items-start justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0'>
          <h2 className='text-xl font-semibold text-neutral-700 dark:text-neutral-300'>
            All Proposal Groups
          </h2>
          {hasNewActivityInGroups && <MarkAllAsReadButton />}
        </div>

        {/* Groups List */}
        <Suspense fallback={<LoadingGroupList />}>
          <GroupList groups={groupsWithInfo} signedIn={userId ? true : false} />
        </Suspense>
      </div>
    </div>
  );
}
