import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@proposalsapp/db';
import { formatNumberWithSuffix } from '@/lib/utils';

const IGNORED_USERS: Record<string, string[]> = {
  uniswap: ['admin', 'system'],
};

// Function to get headers with randomized cache duration
const getHeaders = () => {
  // Add cache jitter: 5 minutes base (300 seconds) + random 0-60 seconds
  const cacheMaxAge = 300 + Math.floor(Math.random() * 60);

  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Requested-With, Discourse-Logged-In, Discourse-Present',
    'Access-Control-Allow-Credentials': 'true',
    'Cache-Control': `public, max-age=${cacheMaxAge}, stale-while-revalidate=60`,
  };
};

const emptyResponse = NextResponse.json(
  {
    currentVotingPower: 0,
    historicalVotingPower: 0,
  },
  { headers: getHeaders() }
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
      { status: 403, headers: getHeaders() }
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
        { status: 400, headers: getHeaders() }
      );
    }
    parsedTimestamp = new Date(timestampNum * 1000);
    if (isNaN(parsedTimestamp.getTime())) {
      return NextResponse.json(
        {
          error:
            'Invalid timestamp value after parsing. Please provide a valid Unix timestamp (seconds).',
        },
        { status: 400, headers: getHeaders() }
      );
    }
  }

  try {
    const dao = await db.public
      .selectFrom('dao')
      .where('dao.slug', '=', daoSlug)
      .selectAll()
      .executeTakeFirst();

    if (!dao) {
      return emptyResponse;
    }

    const daoDiscourse = await db.public
      .selectFrom('daoDiscourse')
      .where('daoDiscourse.daoId', '=', dao.id)
      .selectAll()
      .executeTakeFirst();

    if (!daoDiscourse) {
      return emptyResponse;
    }

    const discourseUser = await db.public
      .selectFrom('discourseUser')
      .where('discourseUser.username', '=', username)
      .where('discourseUser.daoDiscourseId', '=', daoDiscourse.id)
      .selectAll()
      .executeTakeFirst();

    if (!discourseUser) {
      return emptyResponse;
    }

    const dtdu = await db.public
      .selectFrom('delegateToDiscourseUser')
      .where('delegateToDiscourseUser.discourseUserId', '=', discourseUser.id)
      .select(['delegateId'])
      .executeTakeFirst();

    if (!dtdu) {
      return emptyResponse;
    }

    const dtvRecords = await db.public
      .selectFrom('delegateToVoter')
      .where('delegateToVoter.delegateId', '=', dtdu.delegateId)
      .select(['voterId'])
      .execute();

    if (dtvRecords.length === 0) {
      return emptyResponse;
    }

    const voterIds = dtvRecords.map((record) => record.voterId);

    const voters = await db.public
      .selectFrom('voter')
      .where('voter.id', 'in', voterIds)
      .select(['address'])
      .execute();

    const voterAddresses = voters.map((v) => v.address);

    if (voterAddresses.length === 0) {
      return emptyResponse;
    }

    let totalCurrentVotingPower = 0;
    let totalHistoricalVotingPower = 0;

    for (const address of voterAddresses) {
      const currentVpEntry = await db.public
        .selectFrom('votingPowerLatest')
        .where('votingPowerLatest.voter', '=', address)
        .where('votingPowerLatest.daoId', '=', dao.id)
        .select('votingPowerLatest.votingPower')
        .executeTakeFirst();

      if (currentVpEntry && currentVpEntry.votingPower !== null) {
        totalCurrentVotingPower += Math.floor(currentVpEntry.votingPower);
      }

      if (parsedTimestamp) {
        const historicalVpEntry = await db.public
          .selectFrom('votingPowerTimeseries')
          .where('votingPowerTimeseries.voter', '=', address)
          .where('votingPowerTimeseries.daoId', '=', dao.id)
          .where('votingPowerTimeseries.timestamp', '<=', parsedTimestamp)
          .orderBy('votingPowerTimeseries.timestamp', 'desc')
          .select('votingPowerTimeseries.votingPower')
          .executeTakeFirst();

        if (historicalVpEntry && historicalVpEntry.votingPower !== null) {
          totalHistoricalVotingPower += Math.floor(
            historicalVpEntry.votingPower
          );
        }
      }
    }

    const responseBody: Record<string, string> = {
      currentVotingPower: formatNumberWithSuffix(totalCurrentVotingPower),
    };

    if (parsedTimestamp) {
      responseBody.historicalVotingPower = formatNumberWithSuffix(
        totalHistoricalVotingPower
      );
    }

    return NextResponse.json(responseBody, { headers: getHeaders() });
  } catch (error) {
    console.error('Error fetching voting power:', error);
    return emptyResponse;
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: getHeaders(),
  });
}
