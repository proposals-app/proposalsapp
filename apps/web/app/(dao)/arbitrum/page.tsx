import {
  getActiveGroupsFeeds,
  getGroups,
  getTotalVotingPower,
} from '../[daoSlug]/actions';
import { GroupList } from '../[daoSlug]/components/group-list';
import { Suspense } from 'react';
import { auth } from '@/lib/auth/auth';
import { headers } from 'next/headers';
import { ArbitrumSummaryHeader } from './components/arbitrum-summary-header';
import { ArbitrumActionBarClient } from './components/arbitrum-action-bar-client';
import {
  LoadingGroupList,
  LoadingHeader,
  SkeletonActionBar,
} from '@/app/components/ui/skeleton';

// Treasury addresses from Tally's actual implementation
const TREASURY_ADDRESSES = [
  // Arbitrum One (Chain 42161)
  { address: '0x34d45e99f7D8c45ed05B5cA72D54bbD1fb3F98f0', chainId: 42161 },
  { address: '0xbFc1FECa8B09A5c5D3EFfE7429eBE24b9c09EF58', chainId: 42161 },
  { address: '0xF3FC178157fb3c87548bAA86F9d24BA38E649B58', chainId: 42161 },
  { address: '0x2E041280627800801E90E9Ac83532fadb6cAd99A', chainId: 42161 },
  { address: '0x32e7AF5A8151934F3787d0cD59EB6EDd0a736b1d', chainId: 42161 },
  { address: '0xbF5041Fc07E1c866D15c749156657B8eEd0fb649', chainId: 42161 },
  { address: '0x5fcb496a31b7AE91e7c9078Ec662bd7A55cd3079', chainId: 42161 },

  // Arbitrum Nova (Chain 42170)
  { address: '0x509386DbF5C0BE6fd68Df97A05fdB375136c32De', chainId: 42170 },
  { address: '0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce', chainId: 42170 },
  { address: '0x9fCB6F75D99029f28F6F4a1d277bae49c5CAC79f', chainId: 42170 },
  { address: '0xf7951d92b0c345144506576ec13ecf5103ac905a', chainId: 42170 },

  // Ethereum Mainnet (Chain 1)
  { address: '0xF06E95eF589D9c38af242a8AAee8375f14023F85', chainId: 1 },
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
    // Format the accountID in the format Tally expects: eip155:chainId:address
    const accountId = `eip155:${chainId}:${accountAddress}`;

    const response = await fetch('https://api.tally.xyz/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': TALLY_API_KEY, // Changed from 'Api-key' to 'Api-Key'
      },
      body: JSON.stringify({
        query: `
          query TokenBalances($input: AccountID!) {
            balances(accountID: $input) {
              name
              symbol
              address
              logo
              nativeToken
              type
              decimals
              balance
              balance24H
              quoteRate
              quoteRate24H
              quote
              quote24H
            }
          }
        `,
        variables: {
          input: accountId,
        },
      }),
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      console.error(
        `Tally API error for ${accountAddress}: ${response.status}`
      );
      return 0;
    }

    const data = await response.json();
    const balances = data.data?.balances || [];

    const totalUsd = balances.reduce(
      (
        sum: number,
        balance: {
          balance?: string;
          decimals?: number;
          quote?: number;
        }
      ) => {
        const quoteUsd = balance.quote || 0;
        // The quote field already contains the USD value
        return sum + quoteUsd;
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
      'https://api.coingecko.com/api/v3/coins/arbitrum/market_chart?vs_currency=usd&days=1';
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
    <ArbitrumActionBarClient
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
      authorName: group.originalAuthorName || 'Unknown',
      authorAvatarUrl:
        group.originalAuthorPicture ||
        'https://api.dicebear.com/9.x/pixel-art/png?seed=proposals.app',
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
