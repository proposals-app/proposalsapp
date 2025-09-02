import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@proposalsapp/db';
import { formatNumberWithSuffix } from '@/lib/utils';

const IGNORED_USERS: Record<string, string[]> = {
  uniswap: ['admin', 'system'],
};

// Build CORS/security headers safely
function buildCorsHeaders(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  const allowedRoot = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'proposals.app';
  const allowedOrigins = new Set<string>([
    `https://${allowedRoot}`,
    `https://arbitrum.${allowedRoot}`,
    `https://uniswap.${allowedRoot}`,
    'http://localhost:3000',
    'http://arbitrum.localhost:3000',
    'http://uniswap.localhost:3000',
  ]);

  const allowSpecificOrigin = allowedOrigins.has(origin) ? origin : '*';
  const allowCredentials = allowSpecificOrigin !== '*';

  // Add cache jitter: 5 minutes base (300 seconds) + random 0-60 seconds
  const cacheMaxAge = 300 + Math.floor(Math.random() * 60);

  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Requested-With, Discourse-Logged-In, Discourse-Present',
    'Cache-Control': `public, max-age=${cacheMaxAge}, stale-while-revalidate=60`,
  };

  if (allowSpecificOrigin === '*') {
    baseHeaders['Access-Control-Allow-Origin'] = '*';
  } else {
    baseHeaders['Access-Control-Allow-Origin'] = allowSpecificOrigin;
    baseHeaders['Vary'] = 'Origin';
    if (allowCredentials)
      baseHeaders['Access-Control-Allow-Credentials'] = 'true';
  }

  return baseHeaders;
}

const emptyResponse = NextResponse.json(
  {
    currentVotingPower: 0,
    historicalVotingPower: 0,
  },
  { headers: { 'Content-Type': 'application/json' } }
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ daoSlug: string; username: string }> }
) {
  const { username, daoSlug } = await params;

  const ignoredUsersForDao = IGNORED_USERS[daoSlug] || [];
  if (ignoredUsersForDao.includes(username)) {
    return NextResponse.json(
      {
        error: 'Access denied for this user.',
      },
      { status: 403, headers: buildCorsHeaders(request) }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const timestampStr = searchParams.get('timestamp');

  let parsedTimestamp: Date | undefined;
  if (timestampStr) {
    const timestampNum = parseInt(timestampStr, 10);
    if (isNaN(timestampNum)) {
      return NextResponse.json(
        {
          error:
            'Invalid timestamp format. Please use a Unix timestamp (seconds).',
        },
        { status: 400, headers: buildCorsHeaders(request) }
      );
    }
    parsedTimestamp = new Date(timestampNum * 1000);
    if (isNaN(parsedTimestamp.getTime())) {
      return NextResponse.json(
        {
          error:
            'Invalid timestamp value after parsing. Please provide a valid Unix timestamp (seconds).',
        },
        { status: 400, headers: buildCorsHeaders(request) }
      );
    }
  }

  try {
    const dao = await db
      .selectFrom('dao')
      .where('dao.slug', '=', daoSlug)
      .selectAll()
      .executeTakeFirst();

    if (!dao) {
      return new NextResponse(emptyResponse.body, {
        status: 200,
        headers: buildCorsHeaders(request),
      });
    }

    const daoDiscourse = await db
      .selectFrom('daoDiscourse')
      .where('daoDiscourse.daoId', '=', dao.id)
      .selectAll()
      .executeTakeFirst();

    if (!daoDiscourse) {
      return new NextResponse(emptyResponse.body, {
        status: 200,
        headers: buildCorsHeaders(request),
      });
    }

    const discourseUser = await db
      .selectFrom('discourseUser')
      .where('discourseUser.username', '=', username)
      .where('discourseUser.daoDiscourseId', '=', daoDiscourse.id)
      .selectAll()
      .executeTakeFirst();

    if (!discourseUser) {
      return new NextResponse(emptyResponse.body, {
        status: 200,
        headers: buildCorsHeaders(request),
      });
    }

    const dtdu = await db
      .selectFrom('delegateToDiscourseUser')
      .where('delegateToDiscourseUser.discourseUserId', '=', discourseUser.id)
      .select(['delegateId'])
      .executeTakeFirst();

    if (!dtdu) {
      return new NextResponse(emptyResponse.body, {
        status: 200,
        headers: buildCorsHeaders(request),
      });
    }

    const dtvRecords = await db
      .selectFrom('delegateToVoter')
      .where('delegateToVoter.delegateId', '=', dtdu.delegateId)
      .select(['voterId'])
      .execute();

    if (dtvRecords.length === 0) {
      return emptyResponse;
    }

    const voterIds = dtvRecords.map((record) => record.voterId);

    const voters = await db
      .selectFrom('voter')
      .where('voter.id', 'in', voterIds)
      .select(['address'])
      .execute();

    const voterAddresses = voters.map((v) => v.address);

    if (voterAddresses.length === 0) {
      return emptyResponse;
    }

    // Batch fetch current voting power
    const currentVpRows = await db
      .selectFrom('votingPowerLatest')
      .where('votingPowerLatest.voter', 'in', voterAddresses)
      .where('votingPowerLatest.daoId', '=', dao.id)
      .select([
        'votingPowerLatest.voter as voter',
        'votingPowerLatest.votingPower as votingPower',
      ])
      .execute();

    let totalCurrentVotingPower = 0;
    for (const row of currentVpRows) {
      if (row.votingPower !== null)
        totalCurrentVotingPower += Math.floor(
          row.votingPower as unknown as number
        );
    }

    // Batch fetch historical voting power (latest before timestamp per voter)
    let totalHistoricalVotingPower = 0;
    if (parsedTimestamp) {
      const historicalRows = await db
        .selectFrom('votingPowerTimeseries')
        .where('votingPowerTimeseries.voter', 'in', voterAddresses)
        .where('votingPowerTimeseries.daoId', '=', dao.id)
        .where('votingPowerTimeseries.timestamp', '<=', parsedTimestamp)
        .orderBy('votingPowerTimeseries.voter', 'asc')
        .orderBy('votingPowerTimeseries.timestamp', 'desc')
        .select([
          'votingPowerTimeseries.voter as voter',
          'votingPowerTimeseries.votingPower as votingPower',
          'votingPowerTimeseries.timestamp as timestamp',
        ])
        .execute();

      const latestPerVoter = new Map<string, number>();
      for (const row of historicalRows) {
        const voter = row.voter as unknown as string;
        if (!latestPerVoter.has(voter) && row.votingPower !== null) {
          latestPerVoter.set(
            voter,
            Math.floor(row.votingPower as unknown as number)
          );
        }
      }
      for (const val of latestPerVoter.values())
        totalHistoricalVotingPower += val;
    }

    const responseBody: Record<string, string> = {
      currentVotingPower: formatNumberWithSuffix(totalCurrentVotingPower),
    };

    if (parsedTimestamp) {
      responseBody.historicalVotingPower = formatNumberWithSuffix(
        totalHistoricalVotingPower
      );
    }

    return NextResponse.json(responseBody, {
      headers: buildCorsHeaders(request),
    });
  } catch (error) {
    console.error('Error fetching voting power:', error);
    return new NextResponse(emptyResponse.body, {
      status: 200,
      headers: buildCorsHeaders(request),
    });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-Requested-With, Discourse-Logged-In, Discourse-Present',
    },
  });
}
