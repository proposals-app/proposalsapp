import { HeroClient } from './HeroClient';
import { getLandingPageStats } from './actions';

const DAO_LOGOS = [
  {
    name: 'Arbitrum',
    logo: '/assets/project-logos/arbitrum.svg',
    link: 'https://arbitrum.proposals.app',
  },
  {
    name: 'Uniswap',
    logo: '/assets/project-logos/uniswap.svg',
    link: 'https://uniswap.proposals.app',
  },
];

export async function Hero() {
  const stats = await getLandingPageStats();

  return (
    <HeroClient
      activeProposals={stats.activeProposals}
      daosCount={stats.daosCount}
      daoLogos={DAO_LOGOS}
    />
  );
}
