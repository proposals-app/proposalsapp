export enum DaoHandlerEnumV2 {
  AAVEV2MAINNET = "AAVE_V2_MAINNET",
  AAVEV3AVALANCHE = "AAVE_V3_AVALANCHE",
  AAVEV3MAINNET = "AAVE_V3_MAINNET",
  AAVEV3POLYGONPOS = "AAVE_V3_POLYGON_POS",
  ARBCOREARBITRUM = "ARB_CORE_ARBITRUM",
  ARBTREASURYARBITRUM = "ARB_TREASURY_ARBITRUM",
  COMPOUNDMAINNET = "COMPOUND_MAINNET",
  DYDXMAINNET = "DYDX_MAINNET",
  ENSMAINNET = "ENS_MAINNET",
  FRAXALPHAMAINNET = "FRAX_ALPHA_MAINNET",
  FRAXOMEGAMAINNET = "FRAX_OMEGA_MAINNET",
  GITCOINMAINNET = "GITCOIN_MAINNET",
  GITCOINV2MAINNET = "GITCOIN_V2_MAINNET",
  HOPMAINNET = "HOP_MAINNET",
  MAKEREXECUTIVEMAINNET = "MAKER_EXECUTIVE_MAINNET",
  MAKERPOLLARBITRUM = "MAKER_POLL_ARBITRUM",
  MAKERPOLLMAINNET = "MAKER_POLL_MAINNET",
  NOUNSPROPOSALSMAINNET = "NOUNS_PROPOSALS_MAINNET",
  OPOPTIMISM = "OP_OPTIMISM",
  SNAPSHOT = "SNAPSHOT",
  UNISWAPMAINNET = "UNISWAP_MAINNET",
}

export interface DaoSeedData {
  name: string;
  slug: string;
  hot: boolean;
  handlers: HandlerData[];
  settings: SettingsData;
}

export interface HandlerData {
  handler_type: DaoHandlerEnumV2;
  governance_portal: string;
  refresh_enabled: boolean;
  proposals_index: number;
  proposals_refresh_speed: number;
  votes_index: number;
  votes_refresh_speed: number;
}

export interface SettingsData {
  picture: string;
  background_color: string;
}

export function seedData(): DaoSeedData[] {
  return [
    {
      name: "Aave",
      slug: "aave",
      hot: true,
      settings: {
        picture: "assets/project-logos/aave",
        background_color: "#a5a9c6",
      },
      handlers: [
        {
          handler_type: DaoHandlerEnumV2.SNAPSHOT,
          governance_portal: "https://snapshot.org/#/aave.eth",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000,
          votes_index: 0,
          votes_refresh_speed: 0,
        },
        {
          handler_type: DaoHandlerEnumV2.AAVEV2MAINNET,
          governance_portal: "https://app.aave.com/governance",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000000,
          votes_index: 0,
          votes_refresh_speed: 1000000,
        },
        {
          handler_type: DaoHandlerEnumV2.AAVEV3MAINNET,
          governance_portal: "https://app.aave.com/governance",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000000,
          votes_index: 0,
          votes_refresh_speed: 1000000,
        },
        {
          handler_type: DaoHandlerEnumV2.AAVEV3POLYGONPOS,
          governance_portal: "https://app.aave.com/governance",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000000,
          votes_index: 0,
          votes_refresh_speed: 1000000,
        },
        {
          handler_type: DaoHandlerEnumV2.AAVEV3AVALANCHE,
          governance_portal: "https://app.aave.com/governance",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000000,
          votes_index: 0,
          votes_refresh_speed: 1000000,
        },
      ],
    },
    {
      name: "Compound",
      slug: "compound",
      hot: true,
      settings: {
        picture: "assets/project-logos/compound",
        background_color: "#00573e",
      },
      handlers: [
        {
          handler_type: DaoHandlerEnumV2.SNAPSHOT,
          governance_portal: "https://snapshot.org/#/comp-vote.eth",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000,
          votes_index: 0,
          votes_refresh_speed: 0,
        },
        {
          handler_type: DaoHandlerEnumV2.COMPOUNDMAINNET,
          governance_portal: "https://compound.finance/governance",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000000,
          votes_index: 0,
          votes_refresh_speed: 1000000,
        },
      ],
    },
    {
      name: "dYdX",
      slug: "dydx",
      hot: true,
      settings: {
        picture: "assets/project-logos/dYdX",
        background_color: "#51515a",
      },
      handlers: [
        {
          handler_type: DaoHandlerEnumV2.SNAPSHOT,
          governance_portal: "https://snapshot.org/#/dydxgov.eth",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000,
          votes_index: 0,
          votes_refresh_speed: 0,
        },
        {
          handler_type: DaoHandlerEnumV2.DYDXMAINNET,
          governance_portal: "https://dydx.community/dashboard",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000000,
          votes_index: 0,
          votes_refresh_speed: 1000000,
        },
      ],
    },
    {
      name: "ENS",
      slug: "ens",
      hot: true,
      settings: {
        picture: "assets/project-logos/ens",
        background_color: "#6daef6",
      },
      handlers: [
        {
          handler_type: DaoHandlerEnumV2.SNAPSHOT,
          governance_portal: "https://snapshot.org/#/ens.eth",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000,
          votes_index: 0,
          votes_refresh_speed: 0,
        },
        {
          handler_type: DaoHandlerEnumV2.ENSMAINNET,
          governance_portal: "https://www.tally.xyz/gov/ens",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000000,
          votes_index: 0,
          votes_refresh_speed: 1000000,
        },
      ],
    },
    {
      name: "Gitcoin",
      slug: "gitcoin",
      hot: true,
      settings: {
        picture: "assets/project-logos/gitcoin",
        background_color: "#05d4a2",
      },
      handlers: [
        {
          handler_type: DaoHandlerEnumV2.SNAPSHOT,
          governance_portal: "https://snapshot.org/#/gitcoindao.eth",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000,
          votes_index: 0,
          votes_refresh_speed: 0,
        },
        {
          handler_type: DaoHandlerEnumV2.GITCOINMAINNET,
          governance_portal: "https://www.tally.xyz/gov/gitcoin",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000000,
          votes_index: 0,
          votes_refresh_speed: 1000000,
        },
        {
          handler_type: DaoHandlerEnumV2.GITCOINV2MAINNET,
          governance_portal: "https://www.tally.xyz/gov/gitcoin",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000000,
          votes_index: 0,
          votes_refresh_speed: 1000000,
        },
      ],
    },
    {
      name: "Hop Protocol",
      slug: "hop_protocol",
      hot: true,
      settings: {
        picture: "assets/project-logos/hop-protocol",
        background_color: "#d27ecc",
      },
      handlers: [
        {
          handler_type: DaoHandlerEnumV2.SNAPSHOT,
          governance_portal: "https://snapshot.org/#/hop.eth",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000,
          votes_index: 0,
          votes_refresh_speed: 0,
        },
        {
          handler_type: DaoHandlerEnumV2.HOPMAINNET,
          governance_portal: "https://www.tally.xyz/gov/hop",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000000,
          votes_index: 0,
          votes_refresh_speed: 1000000,
        },
      ],
    },
    {
      name: "Uniswap",
      slug: "uniswap",
      hot: true,
      settings: {
        picture: "assets/project-logos/uniswap",
        background_color: "#ffd5f5",
      },
      handlers: [
        {
          handler_type: DaoHandlerEnumV2.SNAPSHOT,
          governance_portal: "https://snapshot.org/#/uniswapgovernance.eth",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000,
          votes_index: 0,
          votes_refresh_speed: 0,
        },
        {
          handler_type: DaoHandlerEnumV2.UNISWAPMAINNET,
          governance_portal: "https://app.uniswap.org/#/vote",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000000,
          votes_index: 0,
          votes_refresh_speed: 1000000,
        },
      ],
    },
    {
      name: "Optimism",
      slug: "optimism",
      hot: true,
      settings: {
        picture: "assets/project-logos/optimism",
        background_color: "#ff444b",
      },
      handlers: [
        {
          handler_type: DaoHandlerEnumV2.SNAPSHOT,
          governance_portal: "https://snapshot.org/#/opcollective.eth",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000,
          votes_index: 0,
          votes_refresh_speed: 0,
        },
        {
          handler_type: DaoHandlerEnumV2.OPOPTIMISM,
          governance_portal: "https://vote.optimism.io/proposals",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000000,
          votes_index: 0,
          votes_refresh_speed: 1000000,
        },
      ],
    },
    {
      name: "Arbitrum DAO",
      slug: "arbitrum_dao",
      hot: true,
      settings: {
        picture: "assets/project-logos/arbitrum",
        background_color: "#55677b",
      },
      handlers: [
        {
          handler_type: DaoHandlerEnumV2.SNAPSHOT,
          governance_portal: "https://snapshot.org/#/arbitrumfoundation.eth",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000,
          votes_index: 0,
          votes_refresh_speed: 0,
        },
        {
          handler_type: DaoHandlerEnumV2.ARBCOREARBITRUM,
          governance_portal: "https://www.tally.xyz/gov/arbitrum",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000000,
          votes_index: 0,
          votes_refresh_speed: 1000000,
        },
        {
          handler_type: DaoHandlerEnumV2.ARBTREASURYARBITRUM,
          governance_portal: "https://www.tally.xyz/gov/arbitrum",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000000,
          votes_index: 0,
          votes_refresh_speed: 1000000,
        },
      ],
    },
    {
      name: "Frax",
      slug: "frax",
      hot: true,
      settings: {
        picture: "assets/project-logos/frax",
        background_color: "#484848",
      },
      handlers: [
        {
          handler_type: DaoHandlerEnumV2.SNAPSHOT,
          governance_portal: "https://snapshot.org/#/frax.eth",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000,
          votes_index: 0,
          votes_refresh_speed: 0,
        },
        {
          handler_type: DaoHandlerEnumV2.FRAXALPHAMAINNET,
          governance_portal: "https://app.frax.finance/gov/frax",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000000,
          votes_index: 0,
          votes_refresh_speed: 1000000,
        },
        {
          handler_type: DaoHandlerEnumV2.FRAXOMEGAMAINNET,
          governance_portal: "https://app.frax.finance/gov/frax",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000000,
          votes_index: 0,
          votes_refresh_speed: 1000000,
        },
      ],
    },
    {
      name: "Nouns",
      slug: "nouns",
      hot: true,
      settings: {
        picture: "assets/project-logos/nouns",
        background_color: "#904757",
      },
      handlers: [
        {
          handler_type: DaoHandlerEnumV2.NOUNSPROPOSALSMAINNET,
          governance_portal: "https://nouns.wtf/vote",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000000,
          votes_index: 0,
          votes_refresh_speed: 1000000,
        },
      ],
    },
    {
      name: "MakerDAO",
      slug: "makerdao",
      hot: true,
      settings: {
        picture: "assets/project-logos/makerdao",
        background_color: "#68baaa",
      },
      handlers: [
        {
          handler_type: DaoHandlerEnumV2.MAKEREXECUTIVEMAINNET,
          governance_portal: "https://vote.makerdao.com/executive",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000000,
          votes_index: 0,
          votes_refresh_speed: 1000000,
        },
        {
          handler_type: DaoHandlerEnumV2.MAKERPOLLMAINNET,
          governance_portal: "https://vote.makerdao.com/polling/",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000000,
          votes_index: 0,
          votes_refresh_speed: 1000000,
        },
        {
          handler_type: DaoHandlerEnumV2.MAKERPOLLARBITRUM,
          governance_portal: "https://vote.makerdao.com/polling/",
          refresh_enabled: true,
          proposals_index: 0,
          proposals_refresh_speed: 1000000,
          votes_index: 0,
          votes_refresh_speed: 1000000,
        },
      ],
    },
  ];
}
