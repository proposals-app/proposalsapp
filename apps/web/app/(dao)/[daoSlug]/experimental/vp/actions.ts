'use server';

import { daoSlugSchema } from '@/lib/validations';
import { db } from '@proposalsapp/db';
import { cacheLife } from 'next/dist/server/use-cache/cache-life';
import { cacheTag } from 'next/dist/server/use-cache/cache-tag';
import { add, startOfDay, sub } from 'date-fns';

const TOP_N_VOTERS = 20;
const DURATION_DAYS = 90;

export type VoterRankData = {
  voterAddress: string;
  ens: string | null;
  avatar: string;
  // Ranks corresponding to the timestamps array. Null if no data/rank for that day.
  ranks: (number | null)[];
};

export type VpRankingReturnType = {
  voters: VoterRankData[];
  // Array of daily timestamps (start of day UTC) in milliseconds for the x-axis
  timestamps: number[];
};

/**
 * Calculates the rank of voters based on voting power at a specific time.
 * Returns a map of voterAddress -> rank.
 */
function calculateRanks(
  voterPowerMap: Map<string, number>,
  voterAddresses: string[]
): Map<string, number> {
  const sortedVoters = voterAddresses
    .map((address) => ({
      address,
      power: voterPowerMap.get(address) ?? 0, // Default to 0 if no power found
    }))
    .sort((a, b) => b.power - a.power); // Sort descending by power

  const ranks = new Map<string, number>();
  let currentRank = 1;
  let rankCount = 0; // How many voters share the current rank
  let lastPower = -1;

  for (let i = 0; i < sortedVoters.length; i++) {
    const voter = sortedVoters[i];
    if (voter.power === 0) {
      // Voters with 0 power don't get ranked within the top N for the chart
      ranks.set(voter.address, TOP_N_VOTERS + 1); // Assign rank outside the top N
      continue;
    }

    if (i > 0 && voter.power < lastPower) {
      currentRank += rankCount; // Increment rank only if power decreased
      rankCount = 1;
    } else {
      rankCount++; // Increment count for ties or first element
    }
    ranks.set(voter.address, currentRank);
    lastPower = voter.power;
  }

  return ranks;
}

export async function getVotingPowerRanking(
  daoSlug: string
): Promise<VpRankingReturnType> {
  'use cache';
  daoSlugSchema.parse(daoSlug);
  cacheTag(`vp-ranking-${daoSlug}`);
  cacheLife('minutes'); // Cache for a few minutes as VP changes

  const dao = await db.public
    .selectFrom('dao')
    .where('slug', '=', daoSlug)
    .select('id')
    .executeTakeFirst();

  if (!dao) {
    throw new Error(`DAO not found for slug: ${daoSlug}`);
  }

  const daoId = dao.id;

  // 1. Identify Top N Voters based on LATEST voting power using CTE
  const topVotersLatest = await db.public
    .with(
      'latest_vp_per_voter',
      (db) =>
        db
          .selectFrom('votingPower')
          .select(['voter', 'votingPower', 'timestamp'])
          .where('daoId', '=', daoId)
          .distinctOn('voter') // Get distinct voters
          .orderBy('voter') // First ORDER BY must match DISTINCT ON
          .orderBy('timestamp', 'desc') // Then order by timestamp to get the latest
    )
    .selectFrom('latest_vp_per_voter')
    .select(['voter', 'votingPower'])
    .orderBy('votingPower', 'desc') // Now sort the results by power
    .limit(TOP_N_VOTERS)
    .execute();

  const topVoterAddresses = topVotersLatest.map((v) => v.voter);

  if (topVoterAddresses.length === 0) {
    return { voters: [], timestamps: [] };
  }

  // 2. Fetch Voter Details (ENS, Avatar) for the top N
  const voterDetails = await db.public
    .selectFrom('voter')
    .select(['address', 'ens', 'avatar'])
    .where('address', 'in', topVoterAddresses)
    .execute();

  const voterDetailMap = new Map(
    voterDetails.map((v) => [
      v.address,
      {
        ens: v.ens,
        avatar:
          v.avatar ??
          `https://api.dicebear.com/9.x/pixel-art/png?seed=${v.address}`,
      },
    ])
  );

  // 3. Generate daily timestamps for the last DURATION_DAYS
  const now = new Date();
  const timestamps: Date[] = [];
  for (let i = 0; i < DURATION_DAYS; i++) {
    timestamps.push(startOfDay(sub(now, { days: i })));
  }
  timestamps.reverse(); // Oldest first

  const timestampMillis = timestamps.map((ts) => ts.getTime());

  // 4. Fetch relevant Voting Power history for the top N voters within the timeframe
  // Find the *last* record for each voter *before* the start of our window
  const initialVpRecords = await db.public
    .selectFrom('votingPower')
    .select(['voter', 'votingPower', 'timestamp'])
    .where('daoId', '=', daoId)
    .where('voter', 'in', topVoterAddresses)
    .where('timestamp', '<', timestamps[0]) // Records strictly before the first day's start
    .distinctOn('voter')
    .orderBy('voter')
    .orderBy('timestamp', 'desc')
    .execute();

  // Fetch records *within* the window
  const withinWindowVpRecords = await db.public
    .selectFrom('votingPower')
    .select(['voter', 'votingPower', 'timestamp'])
    .where('daoId', '=', daoId)
    .where('voter', 'in', topVoterAddresses)
    .where('timestamp', '>=', timestamps[0]) // Records on or after the first day's start
    .orderBy('timestamp', 'asc') // Order by time ascending for easier processing
    .execute();

  // Combine initial state with changes within the window
  const vpHistory = [...initialVpRecords, ...withinWindowVpRecords];

  // 5. Process Data: Calculate daily ranks
  const voterRanksMap = new Map<string, (number | null)[]>(
    topVoterAddresses.map((addr) => [addr, Array(timestamps.length).fill(null)]) // Initialize with nulls
  );

  const voterPowerAtTime = new Map<string, number>(
    initialVpRecords.map((r) => [r.voter, r.votingPower])
  );
  topVoterAddresses.forEach((addr) => {
    if (!voterPowerAtTime.has(addr)) {
      voterPowerAtTime.set(addr, 0); // Ensure all top voters have an initial power entry (even if 0)
    }
  });

  let historyIndex = initialVpRecords.length; // Start processing from records within the window

  for (let i = 0; i < timestamps.length; i++) {
    const dayStart = timestamps[i];
    const dayEnd = add(dayStart, { days: 1 });

    // Apply updates that happened *during* this day
    while (
      historyIndex < vpHistory.length &&
      vpHistory[historyIndex].timestamp >= dayStart && // Should always be true given the query order
      vpHistory[historyIndex].timestamp < dayEnd
    ) {
      const record = vpHistory[historyIndex];
      voterPowerAtTime.set(record.voter, record.votingPower);
      historyIndex++;
    }

    // Calculate ranks based on the state at the *end* of this day (or start of next)
    const dailyRanks = calculateRanks(voterPowerAtTime, topVoterAddresses);

    // Store the rank for each voter for this day
    topVoterAddresses.forEach((address) => {
      const rank = dailyRanks.get(address);
      const ranksArray = voterRanksMap.get(address);
      if (ranksArray) {
        ranksArray[i] =
          rank !== undefined && rank <= TOP_N_VOTERS ? rank : null;
      }
    });
  }

  // 6. Format the final output
  const votersData: VoterRankData[] = topVoterAddresses.map((address) => {
    const details = voterDetailMap.get(address);
    return {
      voterAddress: address,
      ens: details?.ens ?? null,
      avatar:
        details?.avatar ??
        `https://api.dicebear.com/9.x/pixel-art/png?seed=${address}`,
      ranks: voterRanksMap.get(address) || [],
    };
  });

  // Sort final list by the rank on the *last* day (most recent)
  votersData.sort((a, b) => {
    const rankA = a.ranks[a.ranks.length - 1] ?? Infinity;
    const rankB = b.ranks[b.ranks.length - 1] ?? Infinity;
    // Primary sort: rank ascending (nulls/infinity last)
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    // Secondary sort: voter address ascending for consistent tie-breaking
    return a.voterAddress.localeCompare(b.voterAddress);
  });

  return {
    voters: votersData,
    timestamps: timestampMillis,
  };
}
