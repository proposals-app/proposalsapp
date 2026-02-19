import { db, ProposalState, sql } from '@proposalsapp/db';

export async function getLandingPageStats() {
  // 'use cache';

  // Cache for 5 minutes and tag for landing page stats
  // cacheTag('landing-page-stats');
  // cacheLife('minutes');

  try {
    const now = new Date();
    const [daoCountResult, activeProposalsResult] = await Promise.all([
      db
        .selectFrom('dao')
        .select(sql<number>`count(*)::int`.as('count'))
        .executeTakeFirst(),
      db
        .selectFrom('proposal')
        .where('proposal.endAt', '>', now)
        .where('proposal.startAt', '<=', now)
        .where('proposal.proposalState', '=', ProposalState.ACTIVE)
        .select(sql<number>`count(*)::int`.as('count'))
        .executeTakeFirst(),
    ]);

    return {
      activeProposals: activeProposalsResult?.count ?? 0,
      daosCount: daoCountResult?.count ?? 0,
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
