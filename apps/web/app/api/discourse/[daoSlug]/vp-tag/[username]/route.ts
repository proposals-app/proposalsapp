import { NextRequest, NextResponse } from 'next/server';
import { db } from '@proposalsapp/db';
import { formatNumberWithSuffix } from '@/lib/utils';

const IGNORED_USERS: Record<string, string[]> = {
  uniswap: ['admin', 'system'],
};

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Requested-With, Discourse-Logged-In, Discourse-Present',
  'Access-Control-Allow-Credentials': 'true',
  'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
};

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
      { status: 403, headers: HEADERS }
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
        { status: 400, headers: HEADERS }
      );
    }
    parsedTimestamp = new Date(timestampNum * 1000);
    if (isNaN(parsedTimestamp.getTime())) {
      // This secondary check might be redundant if parseInt handles non-numeric strings well,
      // but it's a good safeguard for the Date constructor.
      return NextResponse.json(
        {
          error:
            'Invalid timestamp value after parsing. Please provide a valid Unix timestamp (seconds).',
        },
        { status: 400, headers: HEADERS }
      );
    }
  }

  try {
    const dao = await db.public
      .selectFrom('dao')
      .where('dao.slug', '=', daoSlug)
      .selectAll()
      .executeTakeFirstOrThrow();

    const daoDiscourse = await db.public
      .selectFrom('daoDiscourse')
      .where('daoDiscourse.daoId', '=', dao.id)
      .selectAll()
      .executeTakeFirstOrThrow();

    const discourseUser = await db.public
      .selectFrom('discourseUser')
      .where('discourseUser.username', '=', username)
      .where('discourseUser.daoDiscourseId', '=', daoDiscourse.id)
      .selectAll()
      .executeTakeFirstOrThrow();

    // dtdu means delegateToDiscourseUser records
    const dtduRecords = await db.public
      .selectFrom('delegateToDiscourseUser')
      .where('delegateToDiscourseUser.discourseUserId', '=', discourseUser.id)
      .select(['delegateId'])
      .execute();

    if (dtduRecords.length === 0) {
      return NextResponse.json(
        {
          currentVotingPower: 0,
          historicalVotingPower: 0,
        },
        { headers: HEADERS }
      );
    }

    const delegateIds = dtduRecords.map((record) => record.delegateId);

    const dtvRecords = await db.public
      .selectFrom('delegateToVoter')
      .where('delegateToVoter.delegateId', 'in', delegateIds)
      .select(['voterId'])
      .execute();

    if (dtvRecords.length === 0) {
      return NextResponse.json(
        {
          currentVotingPower: 0,
          historicalVotingPower: 0,
        },
        { headers: HEADERS }
      );
    }

    const voterIds = dtvRecords.map((record) => record.voterId);

    const voters = await db.public
      .selectFrom('voter')
      .where('voter.id', 'in', voterIds)
      .select(['address'])
      .execute();

    const voterAddresses = voters.map((v) => v.address);

    if (voterAddresses.length === 0) {
      return NextResponse.json(
        {
          currentVotingPower: 0,
          historicalVotingPower: 0,
        },
        { headers: HEADERS }
      );
    }

    let totalCurrentVotingPower = 0;
    let totalHistoricalVotingPower = 0;

    for (const address of voterAddresses) {
      // Get current voting power (latest entry)
      const currentVpEntry = await db.public
        .selectFrom('votingPower')
        .where('votingPower.voter', '=', address)
        .where('votingPower.daoId', '=', dao.id)
        .orderBy('votingPower.timestamp', 'desc')
        .select('votingPower.votingPower')
        .executeTakeFirst();

      if (currentVpEntry && currentVpEntry.votingPower !== null) {
        totalCurrentVotingPower += Math.floor(currentVpEntry.votingPower);
      }

      // Get historical voting power (latest entry at or before timestamp)
      if (parsedTimestamp) {
        const historicalVpEntry = await db.public
          .selectFrom('votingPower')
          .where('votingPower.voter', '=', address)
          .where('votingPower.daoId', '=', dao.id)
          .where('votingPower.timestamp', '<=', parsedTimestamp)
          .orderBy('votingPower.timestamp', 'desc')
          .select('votingPower.votingPower')
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

    return NextResponse.json(responseBody, { headers: HEADERS });
  } catch (error) {
    console.error('Error fetching voting power:', error);
    return NextResponse.json(
      {
        currentVotingPower: 0,
        historicalVotingPower: 0,
      },
      { headers: HEADERS }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: HEADERS,
  });
}
