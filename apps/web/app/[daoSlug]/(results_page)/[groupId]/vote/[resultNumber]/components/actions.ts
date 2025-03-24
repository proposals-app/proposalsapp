import { AsyncReturnType } from '@/lib/utils';
import {
  daoSlugSchema,
  proposalIdSchema,
  voterAddressSchema,
} from '@/lib/validations';
import { dbIndexer } from '@proposalsapp/db-indexer';
import { cacheLife } from 'next/dist/server/use-cache/cache-life';

export async function getProposalGovernor(proposalId: string) {
  'use cache';
  cacheLife('hours');

  proposalIdSchema.parse(proposalId);

  const proposal = await dbIndexer
    .selectFrom('proposal')
    .where('id', '=', proposalId)
    .select(['governorId'])
    .executeTakeFirst();

  if (!proposal) {
    console.warn(`Proposal with id ${proposalId} not found.`);
    return null;
  }

  const daoIndexer = await dbIndexer
    .selectFrom('daoGovernor')
    .where('id', '=', proposal.governorId)
    .selectAll()
    .executeTakeFirst();

  if (!daoIndexer) {
    console.warn(
      `DaoIndexer with id ${proposal.governorId} not found for proposal ${proposalId}.`
    );
    return null;
  }

  return daoIndexer;
}

export async function getNonVoters(proposalId: string) {
  'use cache';
  cacheLife('minutes');

  proposalIdSchema.parse(proposalId);

  const proposal = await dbIndexer
    .selectFrom('proposal')
    .where('id', '=', proposalId)
    .select(['id', 'governorId', 'daoId', 'startAt', 'endAt'])
    .executeTakeFirst();

  if (!proposal) {
    console.warn(`Proposal with id ${proposalId} not found.`);
    return [];
  }

  const votedAddresses = new Set(
    (
      await dbIndexer
        .selectFrom('vote')
        .where('proposalId', '=', proposalId)
        .select('voterAddress')
        .execute()
    ).map((v) => v.voterAddress)
  );

  const eligibleVoters = await dbIndexer
    .selectFrom('votingPower as vp')
    .innerJoin('voter as v', 'v.address', 'vp.voter')
    .where('vp.daoId', '=', proposal.daoId)
    .where('vp.votingPower', '>', 0)
    .where('vp.timestamp', '<=', proposal.startAt)
    .orderBy('vp.voter', 'asc')
    .orderBy('vp.timestamp', 'desc')
    .distinctOn(['vp.voter'])
    .select([
      'vp.voter',
      'vp.votingPower as votingPowerAtStart',
      'v.ens',
      'v.avatar',
    ])
    .execute();

  if (eligibleVoters.length === 0) return [];

  // Process voters in chunks to avoid parameter limit issues
  const CHUNK_SIZE = 1000;
  const voters = eligibleVoters.map((v) => v.voter);
  const currentPowerMap = new Map();

  // Process in chunks
  for (let i = 0; i < voters.length; i += CHUNK_SIZE) {
    const chunk = voters.slice(i, i + CHUNK_SIZE);

    const chunkPowers = await dbIndexer
      .selectFrom('votingPower')
      .where('daoId', '=', proposal.daoId)
      .where('voter', 'in', chunk)
      .select((eb) => [
        'voter',
        eb.fn
          .max('votingPower')
          .over((ob) => ob.partitionBy('voter'))
          .as('currentVotingPower'),
      ])
      .groupBy('voter')
      .groupBy('votingPower')
      .execute();

    // Add results to our map
    chunkPowers.forEach((cp) => {
      currentPowerMap.set(cp.voter, cp.currentVotingPower);
    });
  }

  const nonVoters = eligibleVoters
    .filter((v) => !votedAddresses.has(v.voter))
    .map((voter) => {
      const currentVotingPower = currentPowerMap.get(voter.voter) ?? 0;

      return {
        voterAddress: voter.voter,
        ens: voter.ens,
        avatar:
          voter.avatar ||
          `https://api.dicebear.com/9.x/pixel-art/png?seed=${voter.voter}`,
        votingPowerAtStart: voter.votingPowerAtStart,
        currentVotingPower,
      };
    })
    .filter((voter) => voter.votingPowerAtStart > 0);

  return nonVoters;
}

export type NonVotersData = AsyncReturnType<typeof getNonVoters>;

export async function getVotesWithVoters(proposalId: string) {
  'use cache';
  cacheLife('minutes');

  proposalIdSchema.parse(proposalId);

  // 1. Fetch votes, including only the necessary voter address
  const votes = await dbIndexer
    .selectFrom('vote')
    .select([
      'id',
      'choice',
      'createdAt',
      'proposalId',
      'reason',
      'voterAddress',
      'votingPower',
    ])
    .where('proposalId', '=', proposalId)
    .execute();

  // 2. Optimize: Fetch all unique voter addresses at once for efficient lookups
  const voterAddresses = [...new Set(votes.map((vote) => vote.voterAddress))];

  if (voterAddresses.length === 0) {
    return votes.map((vote) => ({
      ...vote,
      ens: null,
      avatar: `https://api.dicebear.com/9.x/pixel-art/png?seed=${vote.voterAddress}`,
      latestVotingPower: null,
      voterAddress: vote.voterAddress,
    }));
  }

  // Fetch all voters in a single query
  const voters = await dbIndexer
    .selectFrom('voter')
    .select(['address', 'ens', 'avatar'])
    .where('address', 'in', voterAddresses)
    .execute();

  // Create a map for efficient voter lookup by address
  const voterMap = new Map(voters.map((voter) => [voter.address, voter]));

  // 3. Fetch latest voting power for each voter in a single query (optimized)
  // Fetch latest voting power for all relevant voters
  const latestVotingPowers = await dbIndexer
    .selectFrom('votingPower')
    .select(['voter', 'votingPower'])
    .where('voter', 'in', voterAddresses) // Filter by addresses we have votes for
    .orderBy('voter', 'asc')
    .orderBy('timestamp', 'desc')
    .distinctOn('votingPower.voter')
    .execute();

  // Create a map for efficient latest voting power lookup by voter address
  const latestVotingPowerMap = new Map(
    latestVotingPowers.map((vp) => [vp.voter, vp.votingPower])
  );

  // 4. Combine vote data with voter and voting power information
  const votesWithVoters = votes.map((vote) => {
    const voter = voterMap.get(vote.voterAddress);
    const latestVotingPower = latestVotingPowerMap.get(vote.voterAddress);

    return {
      ...vote,
      ens: voter?.ens || null,
      avatar:
        voter?.avatar ||
        `https://api.dicebear.com/9.x/pixel-art/png?seed=${vote.voterAddress}`,
      latestVotingPower: latestVotingPower || null,
      voterAddress: vote.voterAddress,
    };
  });

  return votesWithVoters;
}

export type DelegateInfo = {
  id: string | null | undefined;
  address: string;
  ens: string | null;
  profilePictureUrl: string | null;
} | null;

export async function getVoter(voterAddress: string): Promise<DelegateInfo> {
  'use cache';
  cacheLife('hours');

  voterAddressSchema.parse(voterAddress);

  // Get the voter
  const voter = await dbIndexer
    .selectFrom('voter')
    .where('address', '=', voterAddress)
    .selectAll()
    .executeTakeFirst();

  if (!voter) return null;

  // Fallback to address
  return {
    id: null,
    address: voter.address,
    ens: voter.ens,
    profilePictureUrl:
      voter.avatar ??
      `https://api.dicebear.com/9.x/pixel-art/png?seed=${voterAddress}`,
  };
}

export type DelegateVotingPower = {
  votingPowerAtVote: number;
  latestVotingPower: number;
  change: number | null;
};

export async function getDelegateVotingPower(
  voterAddress: string,
  daoSlug: string,
  proposalId: string
): Promise<DelegateVotingPower | null> {
  'use cache';
  cacheLife('hours');

  voterAddressSchema.parse(voterAddress);
  daoSlugSchema.parse(daoSlug);
  proposalIdSchema.parse(proposalId);

  // Get the proposal to determine timestamps
  const proposal = await dbIndexer
    .selectFrom('proposal')
    .where('id', '=', proposalId)
    .selectAll()
    .executeTakeFirst();

  if (!proposal) return null;

  // Get the dao
  const dao = await dbIndexer
    .selectFrom('dao')
    .where('slug', '=', daoSlug)
    .selectAll()
    .executeTakeFirst();

  if (!dao) return null;

  // Get the vote
  const vote = await dbIndexer
    .selectFrom('vote')
    .where('voterAddress', '=', voterAddress)
    .where('proposalId', '=', proposalId)
    .selectAll()
    .executeTakeFirst();

  if (!vote) return null;

  // Get the latest voting power
  const latestVotingPowerRecord = await dbIndexer
    .selectFrom('votingPower')
    .where('voter', '=', voterAddress)
    .where('daoId', '=', dao.id)
    .orderBy('timestamp', 'desc')
    .limit(1)
    .selectAll()
    .executeTakeFirst();

  const latestVotingPower = latestVotingPowerRecord?.votingPower ?? 0;
  const votingPowerAtVote = vote.votingPower;

  // Compute relative change
  let change: number | null = null;
  if (votingPowerAtVote !== 0) {
    const rawChange =
      ((latestVotingPower - votingPowerAtVote) / votingPowerAtVote) * 100;
    if (rawChange > 0.01 || rawChange < -0.01) {
      change = rawChange;
    }
  }

  return {
    votingPowerAtVote,
    latestVotingPower,
    change,
  };
}

export type VotesWithVoters = AsyncReturnType<typeof getVotesWithVoters>;
