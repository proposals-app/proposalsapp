import { NextRequest, NextResponse } from 'next/server';
import { db } from '@proposalsapp/db';
import { formatNumberWithSuffix } from '@/lib/utils';

const DAO_SLUG = 'uniswap';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
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
        { status: 400 }
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
        { status: 400 }
      );
    }
  }

  try {
    const uniswapDao = await db.public
      .selectFrom('dao')
      .where('dao.slug', '=', DAO_SLUG)
      .selectAll()
      .executeTakeFirstOrThrow();

    const uniswapDiscourse = await db.public
      .selectFrom('daoDiscourse')
      .where('daoDiscourse.daoId', '=', uniswapDao.id)
      .selectAll()
      .executeTakeFirstOrThrow();

    const discourseUser = await db.public
      .selectFrom('discourseUser')
      .where('discourseUser.username', '=', username)
      .where('discourseUser.daoDiscourseId', '=', uniswapDiscourse.id)
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
        { error: 'No delegates found for this Discourse user.' },
        { status: 400 }
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
          error:
            'No voters found for the delegates associated with this Discourse user.',
        },
        { status: 400 }
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
          error: 'No voter addresses found for the associated voter IDs.',
        },
        { status: 400 }
      );
    }

    let totalCurrentVotingPower = 0;
    let totalHistoricalVotingPower = 0;

    for (const address of voterAddresses) {
      // Get current voting power (latest entry)
      const currentVpEntry = await db.public
        .selectFrom('votingPower')
        .where('votingPower.voter', '=', address)
        .where('votingPower.daoId', '=', uniswapDao.id)
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
          .where('votingPower.daoId', '=', uniswapDao.id)
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
      username,
      daoSlug: DAO_SLUG,
      currentVotingPower: formatNumberWithSuffix(totalCurrentVotingPower),
    };

    if (parsedTimestamp) {
      responseBody.historicalVotingPower = formatNumberWithSuffix(
        totalHistoricalVotingPower
      );
    }

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error('Failed to fetch voting power:', error);
    // Check if the error is a Kysely NoResultError (or similar if it's wrapped)
    if (error instanceof Error && error.name === 'NoResultError') {
      // Kysely might not throw this name, adjust if needed. Check actual error.
      return NextResponse.json(
        { error: 'User or associated DAO data not found.' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
