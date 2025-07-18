import { type NextRequest, NextResponse } from 'next/server';

async function fetchTokenPrice(tokenId: string): Promise<number> {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${tokenId}/market_chart?vs_currency=usd&days=1`;
    const response = await fetch(url, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    if (data.prices && data.prices.length > 0) {
      return data.prices[data.prices.length - 1][1];
    }
    return 0;
  } catch (error) {
    console.error(`Error fetching token price for ${tokenId}:`, error);
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

  const tokenId = dao === 'arbitrum' ? 'arbitrum' : 'uniswap';

  try {
    // Fetch fresh data
    const price = await fetchTokenPrice(tokenId);

    const priceData = {
      price,
      change24h: 0, // Could be enhanced to fetch 24h change
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(priceData, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Error fetching token price:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token price' },
      { status: 500 }
    );
  }
}
