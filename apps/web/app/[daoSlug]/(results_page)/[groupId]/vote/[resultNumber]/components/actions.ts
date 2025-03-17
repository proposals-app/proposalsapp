import { AsyncReturnType } from '@/lib/utils';
import { db } from '@proposalsapp/db-indexer';

export async function getProposalGovernor(proposalId: string) {
  const proposal = await db
    .selectFrom('proposal')
    .where('id', '=', proposalId)
    .select(['governorId'])
    .executeTakeFirst();

  if (!proposal) {
    console.warn(`Proposal with id ${proposalId} not found.`);
    return null;
  }

  const daoIndexer = await db
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

export async function getVotesWithVoters(proposalId: string) {
  'use server';

  // 1. Fetch votes, including only the necessary voter address
  const votes = await db
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

  // Fetch all voters in a single query
  const voters = await db
    .selectFrom('voter')
    .select(['address', 'ens', 'avatar'])
    .where('address', 'in', voterAddresses)
    .execute();

  // Create a map for efficient voter lookup by address
  const voterMap = new Map(voters.map((voter) => [voter.address, voter]));

  // 3. Fetch latest voting power for each voter in a single query (optimized)
  // Fetch latest voting power for all relevant voters
  const latestVotingPowers = await db
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
  // Get the voter
  const voter = await db
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
  try {
    // Get the proposal to determine timestamps
    const proposal = await db
      .selectFrom('proposal')
      .where('id', '=', proposalId)
      .selectAll()
      .executeTakeFirst();

    if (!proposal) return null;

    // Get the dao
    const dao = await db
      .selectFrom('dao')
      .where('slug', '=', daoSlug)
      .selectAll()
      .executeTakeFirst();

    if (!dao) return null;

    // Get the vote
    const vote = await db
      .selectFrom('vote')
      .where('voterAddress', '=', voterAddress)
      .where('proposalId', '=', proposalId)
      .selectAll()
      .executeTakeFirst();

    if (!vote) return null;

    // Get the latest voting power
    const latestVotingPowerRecord = await db
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
  } catch (error) {
    console.error('Error fetching delegate voting power:', error);
    return null;
  }
}

export type VotesWithVoters = AsyncReturnType<typeof getVotesWithVoters>;
