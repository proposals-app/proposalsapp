export interface DAO {
  name: string;
  logo: string;
  link: string;
  subdomain: string;
}

export const SUPPORTED_DAOS: DAO[] = [
  {
    name: 'Arbitrum',
    logo: '/assets/project-logos/arbitrum.svg',
    link: 'https://arbitrum.proposals.app',
    subdomain: 'arbitrum',
  },
  // {
  //   name: 'Uniswap',
  //   logo: '/assets/project-logos/uniswap.svg',
  //   link: 'https://uniswap.proposals.app',
  //   subdomain: 'uniswap',
  // },
];

export const getDAOBySubdomain = (subdomain: string): DAO | undefined => {
  return SUPPORTED_DAOS.find((dao) => dao.subdomain === subdomain);
};
