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
  // Fetch proposal to get daoId
  const proposal = await db
    .selectFrom('proposal')
    .where('id', '=', proposalId)
    .select(['daoId'])
    .executeTakeFirst();

  if (!proposal) {
    console.warn(`Proposal with id ${proposalId} not found.`);
    return []; // Or throw an error, depending on desired behavior
  }
  const daoId = proposal.daoId;

  const votes = await db
    .selectFrom('vote')
    .innerJoin('voter', 'vote.voterAddress', 'voter.address')
    .leftJoin(
      db
        .selectFrom('votingPower')
        .select([
          'votingPower.voter',
          'votingPower.votingPower as latestVotingPower',
          'votingPower.timestamp',
        ])
        .where('votingPower.daoId', '=', daoId)
        .distinctOn(['votingPower.voter'])
        .orderBy('votingPower.voter', 'asc')
        .orderBy('votingPower.timestamp', 'desc')
        .as('latestVotingPowerForVoter'),
      (join) =>
        join.onRef('vote.voterAddress', '=', 'latestVotingPowerForVoter.voter')
    )
    .select([
      'vote.id',
      'vote.choice',
      'vote.createdAt',
      'vote.proposalId',
      'vote.reason',
      'vote.voterAddress',
      'vote.votingPower',
      'voter.ens',
      'voter.avatar',
      'latestVotingPowerForVoter.latestVotingPower',
    ])
    .where('proposalId', '=', proposalId)
    .execute();

  return votes.map((vote) => ({
    ...vote,
    latestVotingPower: vote.latestVotingPower,
    avatar:
      vote.avatar === null
        ? `https://api.dicebear.com/9.x/pixel-art/png?seed=${vote.voterAddress}`
        : vote.avatar,
  }));
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
