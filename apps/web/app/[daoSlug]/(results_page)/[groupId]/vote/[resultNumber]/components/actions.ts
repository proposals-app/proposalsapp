import { otel } from '@/lib/otel';
import { superjson_cache } from '@/lib/utils';
import { db, ProposalState } from '@proposalsapp/db-indexer';
import { unstable_cache } from 'next/cache';

async function getProposalGovernor(proposalId: string) {
  return otel('get-proposal-governor', async () => {
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
  });
}

export const getProposalGovernor_cached = unstable_cache(
  async (proposalId: string) => {
    return await getProposalGovernor(proposalId);
  },
  ['get-proposal-governor'],
  { revalidate: 60 * 5, tags: ['get-proposal-governor'] }
);

async function getVotesAction(proposalId: string) {
  return otel('get-votes', async () => {
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
    return votes;
  });
}

export const getVotesAction_cached = superjson_cache(
  async (groupId: string) => {
    return await getVotesAction(groupId);
  },
  ['get-votes'],
  { revalidate: 60 * 5, tags: ['get-votes'] }
);

export type DelegateInfo = {
  id: string | null | undefined;
  address: string;
  ens: string | null;
  discourseName: string | null;
  profilePictureUrl: string | null;
} | null;

async function getDelegateForVoter(
  voterAddress: string,
  daoSlug: string,
  proposalId: string,
  withPeriodCheck: boolean
): Promise<DelegateInfo> {
  return otel('get-delegate-for-voter', async () => {
    const dao = await db
      .selectFrom('dao')
      .where('slug', '=', daoSlug)
      .selectAll()
      .executeTakeFirst();

    if (!dao) return null;

    // Get the proposal to determine the time range
    const proposal = await db
      .selectFrom('proposal')
      .selectAll()
      .where('id', '=', proposalId)
      .executeTakeFirst();

    if (!proposal) return null;

    // Get the voter
    const voter = await db
      .selectFrom('voter')
      .where('address', '=', voterAddress)
      .selectAll()
      .executeTakeFirst();

    if (!voter) return null;

    // Try to get delegate information
    const delegateData = await db
      .selectFrom('delegate')
      .innerJoin('delegateToVoter', 'delegate.id', 'delegateToVoter.delegateId')
      .where('delegateToVoter.voterId', '=', voter.id)
      .where('delegate.daoId', '=', dao.id)
      .select('delegate.id')
      .executeTakeFirst();

    if (!delegateData)
      return {
        id: null,
        address: voter.address,
        ens: voter.ens?.length ? voter.ens : null,
        discourseName: null,
        profilePictureUrl: `https://api.dicebear.com/9.x/pixel-art/png?seed=${voterAddress}`,
      };

    // Try to get discourse user first
    let discourseUserQuery = db
      .selectFrom('delegateToDiscourseUser')
      .where('delegateId', '=', delegateData.id)
      .leftJoin(
        'discourseUser',
        'discourseUser.id',
        'delegateToDiscourseUser.discourseUserId'
      );

    if (withPeriodCheck) {
      discourseUserQuery = discourseUserQuery.where(
        'periodStart',
        '<=',
        proposal.startAt
      );

      // Only apply the periodEnd condition if the proposal is not active
      if (proposal.proposalState !== ProposalState.ACTIVE) {
        discourseUserQuery = discourseUserQuery.where(
          'periodEnd',
          '>=',
          proposal.endAt
        );
      }
    }

    const discourseUser = await discourseUserQuery
      .selectAll()
      .executeTakeFirst();

    if (discourseUser) {
      return {
        id: delegateData.id,
        address: voter.address,
        ens: voter.ens?.length ? voter.ens : null,
        discourseName: discourseUser.name || discourseUser.username,
        profilePictureUrl: discourseUser.avatarTemplate,
      };
    }

    // Fallback to ENS
    let ensQuery = db
      .selectFrom('delegateToVoter')
      .where('delegateId', '=', delegateData.id)
      .leftJoin('voter', 'voter.id', 'delegateToVoter.voterId');

    if (withPeriodCheck) {
      ensQuery = ensQuery.where('periodStart', '<=', proposal.startAt);

      // Only apply the periodEnd condition if the proposal is not active
      if (proposal.proposalState !== ProposalState.ACTIVE) {
        ensQuery = ensQuery.where('periodEnd', '>=', proposal.endAt);
      }
    }

    const ens = await ensQuery.select('voter.ens').executeTakeFirst();

    if (ens?.ens) {
      return {
        id: delegateData.id,
        address: voter.address,
        ens: voter.ens?.length ? voter.ens : null,
        discourseName: null,
        profilePictureUrl: `https://api.dicebear.com/9.x/pixel-art/png?seed=${voter.address}`,
      };
    }

    // Fallback to address
    return {
      id: null,
      address: `${voterAddress}`,
      ens: null,
      discourseName: null,
      profilePictureUrl: `https://api.dicebear.com/9.x/pixel-art/png?seed=${voterAddress}`,
    };
  });
}

export const getDelegateForVoter_cached = unstable_cache(
  async (voterAddress: string, daoSlug: string, proposalId: string) => {
    return await getDelegateForVoter(voterAddress, daoSlug, proposalId, false);
  },
  ['delegate-for-voter'],
  { revalidate: 60 * 30, tags: ['delegate-for-voter'] }
);
export type DelegateVotingPower = {
  votingPowerAtVote: number;
  latestVotingPower: number;
  change: number | null;
};

async function getDelegateVotingPower(
  voterAddress: string,
  daoSlug: string,
  proposalId: string
): Promise<DelegateVotingPower | null> {
  return otel('get-delegate-voting-power', async () => {
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
  });
}

export const getDelegateVotingPower_cached = unstable_cache(
  async (voterAddress: string, daoSlug: string, proposalId: string) => {
    return await getDelegateVotingPower(voterAddress, daoSlug, proposalId);
  },
  ['get-delegate-voting-power'],
  { revalidate: 60 * 30, tags: ['get-delegate-voting-power'] }
);
