export const SUPPORTED_DAO_SLUGS = ['arbitrum', 'uniswap'] as const;

export type SupportedDaoSlug = (typeof SUPPORTED_DAO_SLUGS)[number];

const DAO_CONFIG = {
  arbitrum: {
    tokenSymbol: 'ARB',
    forumBaseUrl: 'https://forum.arbitrum.foundation',
    tallySlug: 'arbitrum',
    exclusionAddress: '0x00000000000000000000000000000000000A4B86',
  },
  uniswap: {
    tokenSymbol: 'UNI',
    forumBaseUrl: 'https://gov.uniswap.org',
    tallySlug: 'uniswap',
  },
} as const satisfies Record<
  SupportedDaoSlug,
  {
    tokenSymbol: string;
    forumBaseUrl: string;
    tallySlug: string;
    exclusionAddress?: string;
  }
>;

export function isSupportedDaoSlug(value: string): value is SupportedDaoSlug {
  return (SUPPORTED_DAO_SLUGS as readonly string[]).includes(value);
}

export function getDaoTokenSymbol(daoSlug: string): string {
  return isSupportedDaoSlug(daoSlug)
    ? DAO_CONFIG[daoSlug].tokenSymbol
    : 'TOKEN';
}

export function getDaoForumBaseUrl(daoSlug: string): string | undefined {
  return isSupportedDaoSlug(daoSlug)
    ? DAO_CONFIG[daoSlug].forumBaseUrl
    : undefined;
}

export function getDaoDelegateProfileUrl(
  daoSlug: string,
  voterAddress: string
): string | undefined {
  if (
    !isSupportedDaoSlug(daoSlug) ||
    !/^0x[a-fA-F0-9]{40}$/.test(voterAddress)
  ) {
    return undefined;
  }

  return `https://www.tally.xyz/gov/${DAO_CONFIG[daoSlug].tallySlug}/delegate/${voterAddress}`;
}

export function getDaoExcludedVoterAddress(
  daoSlug: string
): string | undefined {
  if (!isSupportedDaoSlug(daoSlug)) {
    return undefined;
  }

  const config = DAO_CONFIG[daoSlug];
  return 'exclusionAddress' in config ? config.exclusionAddress : undefined;
}
