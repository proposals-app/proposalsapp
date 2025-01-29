import { otel } from '@/lib/otel';
import { db, ProposalState } from '@proposalsapp/db';

export async function getVotesAction(proposalId: string) {
  'use server';
  const votes = await db
    .selectFrom('vote')
    .selectAll()
    .where('proposalId', '=', proposalId)
    .execute();
  return votes;
}

export type DelegateInfo = {
  name: string | null;
} | null;

export async function getDelegateForVoter(
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
        name: `${voterAddress}`,
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
        name: discourseUser.name || discourseUser.username,
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
        name: ens.ens,
      };
    }

    // Fallback to address
    return {
      name: `${voterAddress}`,
    };
  });
}
