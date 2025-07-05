import { HeroClient } from './HeroClient';
import { getLandingPageStats } from './actions';
import { SUPPORTED_DAOS } from './dao-config';

export async function Hero() {
  const stats = await getLandingPageStats();

  return (
    <HeroClient
      activeProposals={stats.activeProposals}
      daosCount={stats.daosCount}
      daoLogos={SUPPORTED_DAOS}
    />
  );
}
