import { type NextRequest, NextResponse } from 'next/server';

const TREASURY_ADDRESSES = {
  arbitrum: [
    { address: '0xE2C07B0c39e9B7307c963670C3A55f8E35C9cfC5', chainId: 42161 },
    { address: '0x0527613b4f5b8Ac56Fb8a5cb30D3dEF83251C6aF', chainId: 42161 },
    { address: '0x0b4288A14FC983b5e89AED4cEad6E2Ca85E83c8a', chainId: 42161 },
    { address: '0xBdBEB046507DC75a813f80001510D4E8C78D45ed', chainId: 42161 },
    { address: '0xAF35A5F39F49e73a96991CAfc2c8F47A09dAa4Aa', chainId: 42161 },
    { address: '0x6ACf15E01f7848Ae8F2A9b837e4D9463CfCe8F85', chainId: 42161 },
    { address: '0x7b1247f443359d1447Cf25e73380Bc9b99F2628f', chainId: 42161 },
    { address: '0x39039Fc96ec8237f7f91A96d58DfbaB0B3F62a67', chainId: 42161 },
    { address: '0x9577E88aBB7fF96FD8Bf4e1cdFfd19663F2b33f8', chainId: 42170 },
    { address: '0x2FAee64bb5CfB12DE5C5E93f00b0BAD30016d6Ec', chainId: 42170 },
  ],
  uniswap: [
    { address: '0x1a9C8182C09F50C8318d769245beA52c32BE35BC', chainId: 1 },
    { address: '0x4B4e140D1f131fdaD6fb59C13AF796fD194e4135', chainId: 1 },
  ],
} as const;

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
      throw new Error(`Tally API error: ${response.status}`);
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dao: string }> }
) {
  const { dao } = await params;

  if (dao !== 'arbitrum' && dao !== 'uniswap') {
    return NextResponse.json(
      { error: 'Invalid DAO parameter' },
      { status: 400 }
    );
  }

  try {
    // Fetch fresh data
    const results = await Promise.allSettled(
      TREASURY_ADDRESSES[dao].map(({ address, chainId }) =>
        fetchBalanceForAddress(address, chainId)
      )
    );

    let totalBalanceUsd = 0;
    const balances: Array<{
      address: string;
      chainId: number;
      balance: number;
      balanceUsd: number;
      tokenSymbol: string;
    }> = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value > 0) {
        const { address, chainId } = TREASURY_ADDRESSES[dao][index];
        balances.push({
          address,
          chainId,
          balance: result.value,
          balanceUsd: result.value,
          tokenSymbol: dao === 'arbitrum' ? 'ARB' : 'UNI',
        });
        totalBalanceUsd += result.value;
      }
    });

    const treasuryData = {
      totalBalanceUsd,
      balances,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(treasuryData, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Error fetching treasury balance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch treasury balance' },
      { status: 500 }
    );
  }
}
