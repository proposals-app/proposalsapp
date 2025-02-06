import { otel } from '@/lib/otel';
import { superjson_cache } from '@/lib/utils';
import { db, ProposalState } from '@proposalsapp/db';
import { unstable_cache } from 'next/cache';

async function getProposalGovernor(proposalId: string) {
  return otel('get-proposal-governor', async () => {
    const proposal = await db
      .selectFrom('proposal')
      .where('id', '=', proposalId)
      .select(['daoIndexerId'])
      .executeTakeFirst();

    if (!proposal) {
      console.warn(`Proposal with id ${proposalId} not found.`);
      return null;
    }

    const daoIndexer = await db
      .selectFrom('daoIndexer')
      .where('id', '=', proposal.daoIndexerId)
      .selectAll()
      .executeTakeFirst();

    if (!daoIndexer) {
      console.warn(
        `DaoIndexer with id ${proposal.daoIndexerId} not found for proposal ${proposalId}.`
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
  [],
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
  [],
  { revalidate: 60 * 5, tags: ['get-votes'] }
);

export type DelegateInfo = {
  id: string | null | undefined;
  address: string;
  ens: string | null;
  discourseName: string | null;
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
      };
    }

    // Fallback to address
    return {
      id: null,
      address: `${voterAddress}`,
      ens: null,
      discourseName: null,
    };
  });
}

export const getDelegateForVoter_cached = unstable_cache(
  async (voterAddress: string, daoSlug: string, proposalId: string) => {
    return await getDelegateForVoter(voterAddress, daoSlug, proposalId, false);
  },
  [],
  { revalidate: 60 * 5, tags: ['delegate-for-voter'] }
);
