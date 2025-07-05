import { db, ProposalState } from '@proposalsapp/db';
import { cacheLife } from 'next/dist/server/use-cache/cache-life';
import { cacheTag } from 'next/dist/server/use-cache/cache-tag';

export async function getLandingPageStats() {
  'use cache';

  // Cache for 5 minutes and tag for landing page stats
  cacheTag('landing-page-stats');
  cacheLife('minutes');

  try {
    // Get count of active DAOs
    const activeDaos = await db.public
      .selectFrom('dao')
      .select(db.public.fn.count('id').as('count'))
      .executeTakeFirst();

    const daoCount = Number(activeDaos?.count ?? 0);

    // Get count of active proposals (ongoing votes)
    const now = new Date();

    // Count all active proposals (both onchain and snapshot)
    // Active means: current time is between startAt and endAt, and state is ACTIVE
    const activeProposals = await db.public
      .selectFrom('proposal')
      .where('proposal.endAt', '>', now)
      .where('proposal.startAt', '<=', now)
      .where('proposal.proposalState', '=', ProposalState.ACTIVE)
      .select(db.public.fn.count('id').as('count'))
      .executeTakeFirst();

    const activeProposalsCount = Number(activeProposals?.count ?? 0);

    return {
      activeProposals: activeProposalsCount,
      daosCount: daoCount,
    };
  } catch (error) {
    console.error('Error fetching landing page stats:', error);
    // Return fallback values if there's an error
    return {
      activeProposals: 0,
      daosCount: 0,
    };
  }
}
