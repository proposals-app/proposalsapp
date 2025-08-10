import { db, ProposalState } from '@proposalsapp/db';

export async function getLandingPageStats() {
  // 'use cache';

  // Cache for 5 minutes and tag for landing page stats
  // cacheTag('landing-page-stats');
  // cacheLife('minutes');

  try {
    // Get count of active DAOs
    const activeDaos = await db.selectFrom('dao').selectAll().execute();

    const daoCount = activeDaos.length;

    // Get count of active proposals (ongoing votes)
    const now = new Date();

    // Count all active proposals (both onchain and snapshot)
    // Active means: current time is between startAt and endAt, and state is ACTIVE
    const activeProposals = await db
      .selectFrom('proposal')
      .where('proposal.endAt', '>', now)
      .where('proposal.startAt', '<=', now)
      .where('proposal.proposalState', '=', ProposalState.ACTIVE)
      .execute();

    const activeProposalsCount = activeProposals.length;

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
