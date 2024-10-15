import type { Insertable, Kysely } from "kysely";
import {
  Dao,
  DaoDiscourse,
  DaoIndexer,
  DB,
  IndexerType,
  IndexerVariant,
} from "../src/kysely_db";

interface DaoData {
  dao: Insertable<Dao> & { id: string };
  indexers: Omit<Insertable<DaoIndexer>, "daoId">[];
  discourse: Omit<Insertable<DaoDiscourse>, "daoId">[];
}

export async function seed(db: Kysely<DB>): Promise<void> {
  const daoData: DaoData[] = [
    {
      dao: {
        id: "0900a19a-6e7b-4056-a144-26aa0c804258",
        name: "Nouns",
        slug: "nouns",
        picture: "assets/project-logos/nouns",
        backgroundColor: "#904757",
        hot: true,
      },
      indexers: [
        {
          portalUrl: "https://nouns.wtf/vote",
          indexerType: IndexerType.PROPOSALS,
          indexerVariant: IndexerVariant.NOUNSPROPOSALSMAINNETPROPOSALS,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.NOUNSPROPOSALSMAINNETVOTES,
        },
      ],
      discourse: [
        {
          discourseBaseUrl: "https://discourse.nouns.wtf",
          enabled: true,
        },
      ],
    },
    {
      dao: {
        id: "379291dd-967a-42ed-9f71-9d650388ea4f",
        name: "Hop Protocol",
        slug: "hop_protocol",
        picture: "assets/project-logos/hop-protocol",
        backgroundColor: "#d27ecc",
        hot: true,
      },
      indexers: [
        {
          portalUrl: "https://www.tally.xyz/gov/hop",
          indexerType: IndexerType.PROPOSALS,
          indexerVariant: IndexerVariant.HOPMAINNETPROPOSALS,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.HOPMAINNETVOTES,
        },
        {
          portalUrl: "https://snapshot.org/#/hop.eth",
          indexerType: IndexerType.PROPOSALS,
          indexerVariant: IndexerVariant.SNAPSHOTPROPOSALS,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.SNAPSHOTVOTES,
        },
      ],
      discourse: [
        {
          discourseBaseUrl: "https://forum.hop.exchange",
          enabled: true,
        },
      ],
    },
    {
      dao: {
        id: "af6ec7bb-ca67-4258-b566-31ef05ea6b03",
        name: "Uniswap",
        slug: "uniswap",
        picture: "assets/project-logos/uniswap",
        backgroundColor: "#ffd5f5",
        hot: true,
      },
      indexers: [
        {
          portalUrl: "https://app.uniswap.org/#/vote",
          indexerType: IndexerType.PROPOSALS,
          indexerVariant: IndexerVariant.UNISWAPMAINNETPROPOSALS,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.UNISWAPMAINNETVOTES,
        },
        {
          portalUrl: "https://snapshot.org/#/uniswapgovernance.eth",
          indexerType: IndexerType.PROPOSALS,
          indexerVariant: IndexerVariant.SNAPSHOTPROPOSALS,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.SNAPSHOTVOTES,
        },
      ],
      discourse: [
        {
          discourseBaseUrl: "https://gov.uniswap.org",
          enabled: true,
        },
      ],
    },
    {
      dao: {
        id: "c3f06487-aab9-409b-bec3-797f0279c7d5",
        name: "Gitcoin",
        slug: "gitcoin",
        picture: "assets/project-logos/gitcoin",
        backgroundColor: "#05d4a2",
        hot: true,
      },
      indexers: [
        {
          portalUrl: "https://www.tally.xyz/gov/gitcoin",
          indexerType: IndexerType.PROPOSALS,
          indexerVariant: IndexerVariant.GITCOINMAINNETPROPOSALS,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.GITCOINMAINNETVOTES,
        },
        {
          portalUrl: "https://www.tally.xyz/gov/gitcoin",
          indexerType: IndexerType.PROPOSALS,
          indexerVariant: IndexerVariant.GITCOINV2MAINNETPROPOSALS,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.GITCOINV2MAINNETVOTES,
        },
        {
          portalUrl: "https://snapshot.org/#/gitcoindao.eth",
          indexerType: IndexerType.PROPOSALS,
          indexerVariant: IndexerVariant.SNAPSHOTPROPOSALS,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.SNAPSHOTVOTES,
        },
      ],
      discourse: [
        {
          discourseBaseUrl: "https://gov.gitcoin.co",
          enabled: true,
        },
      ],
    },
    {
      dao: {
        id: "c5c825bf-f6e4-41da-929f-b877d9542d84",
        name: "Optimism",
        slug: "optimism",
        picture: "assets/project-logos/optimism",
        backgroundColor: "#ff444b",
        hot: true,
      },
      indexers: [
        {
          portalUrl: "https://vote.optimism.io/proposals",
          indexerType: IndexerType.PROPOSALS,
          indexerVariant: IndexerVariant.OPOPTIMISMPROPOSALS,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.OPOPTIMISMVOTES,
        },
        {
          portalUrl: "https://snapshot.org/#/opcollective.eth",
          indexerType: IndexerType.PROPOSALS,
          indexerVariant: IndexerVariant.SNAPSHOTPROPOSALS,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.SNAPSHOTVOTES,
        },
      ],
      discourse: [
        {
          discourseBaseUrl: "https://gov.optimism.io",
          enabled: true,
        },
      ],
    },
    {
      dao: {
        id: "cabb8c4b-45f4-4f39-8c8c-9df42608a79a",
        name: "Frax",
        slug: "frax",
        picture: "assets/project-logos/frax",
        backgroundColor: "#484848",
        hot: true,
      },
      indexers: [
        {
          portalUrl: "https://app.frax.finance/gov/frax",
          indexerType: IndexerType.PROPOSALS,
          indexerVariant: IndexerVariant.FRAXALPHAMAINNETPROPOSALS,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.FRAXALPHAMAINNETVOTES,
        },
        {
          portalUrl: "https://app.frax.finance/gov/frax",
          indexerType: IndexerType.PROPOSALS,
          indexerVariant: IndexerVariant.FRAXOMEGAMAINNETPROPOSALS,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.FRAXOMEGAMAINNETVOTES,
        },
        {
          portalUrl: "https://snapshot.org/#/frax.eth",
          indexerType: IndexerType.PROPOSALS,
          indexerVariant: IndexerVariant.SNAPSHOTPROPOSALS,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.SNAPSHOTVOTES,
        },
      ],
      discourse: [
        {
          discourseBaseUrl: "https://gov.frax.finance",
          enabled: true,
        },
      ],
    },
    {
      dao: {
        id: "d86b6b16-9a0f-40ef-82cf-4f2d9e946612",
        name: "Aave",
        slug: "aave",
        picture: "assets/project-logos/aave",
        backgroundColor: "#a5a9c6",
        hot: true,
      },
      indexers: [
        {
          portalUrl: "https://app.aave.com/governance",
          indexerType: IndexerType.PROPOSALS,
          indexerVariant: IndexerVariant.AAVEV2MAINNETPROPOSALS,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.AAVEV2MAINNETVOTES,
        },
        {
          portalUrl: "https://app.aave.com/governance",
          indexerType: IndexerType.PROPOSALS,
          indexerVariant: IndexerVariant.AAVEV3MAINNETPROPOSALS,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.AAVEV3MAINNETVOTES,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.AAVEV3POLYGONVOTES,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.AAVEV3AVALANCHEVOTES,
        },
        {
          portalUrl: "https://snapshot.org/#/aave.eth",
          indexerType: IndexerType.PROPOSALS,
          indexerVariant: IndexerVariant.SNAPSHOTPROPOSALS,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.SNAPSHOTVOTES,
        },
      ],
      discourse: [
        {
          discourseBaseUrl: "https://governance.aave.com",
          enabled: true,
        },
      ],
    },
    {
      dao: {
        id: "e6f29269-eb45-4ffa-a4ff-c3f703df765a",
        name: "ENS",
        slug: "ens",
        picture: "assets/project-logos/ens",
        backgroundColor: "#6daef6",
        hot: true,
      },
      indexers: [
        {
          portalUrl: "https://www.tally.xyz/gov/ens",
          indexerType: IndexerType.PROPOSALS,
          indexerVariant: IndexerVariant.ENSMAINNETPROPOSALS,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.ENSMAINNETVOTES,
        },
        {
          portalUrl: "https://snapshot.org/#/ens.eth",
          indexerType: IndexerType.PROPOSALS,
          indexerVariant: IndexerVariant.SNAPSHOTPROPOSALS,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.SNAPSHOTVOTES,
        },
      ],
      discourse: [
        {
          discourseBaseUrl: "https://discuss.ens.domains",
          enabled: true,
        },
      ],
    },
    {
      dao: {
        id: "f04bd1f8-e1ab-45bf-b5fa-eb7917dccd41",
        name: "Compound",
        slug: "compound",
        picture: "assets/project-logos/compound",
        backgroundColor: "#00573e",
        hot: true,
      },
      indexers: [
        {
          portalUrl: "https://compound.finance/governance",
          indexerType: IndexerType.PROPOSALS,
          indexerVariant: IndexerVariant.COMPOUNDMAINNETPROPOSALS,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.COMPOUNDMAINNETVOTES,
        },
        {
          portalUrl: "https://snapshot.org/#/comp-vote.eth",
          indexerType: IndexerType.PROPOSALS,
          indexerVariant: IndexerVariant.SNAPSHOTPROPOSALS,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.SNAPSHOTVOTES,
        },
      ],
      discourse: [
        {
          discourseBaseUrl: "https://www.comp.xyz",
          enabled: true,
        },
      ],
    },
    {
      dao: {
        id: "f3a08c9f-267e-4df4-9fe0-048b405a3179",
        name: "MakerDAO",
        slug: "makerdao",
        picture: "assets/project-logos/makerdao",
        backgroundColor: "#68baaa",
        hot: true,
      },
      indexers: [
        {
          portalUrl: "https://vote.makerdao.com/executive",
          indexerType: IndexerType.PROPOSALS,
          indexerVariant: IndexerVariant.MAKEREXECUTIVEMAINNETPROPOSALS,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.MAKEREXECUTIVEMAINNETVOTES,
        },
        {
          portalUrl: "https://vote.makerdao.com/polling/",
          indexerType: IndexerType.PROPOSALS,
          indexerVariant: IndexerVariant.MAKERPOLLMAINNETPROPOSALS,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.MAKERPOLLMAINNETVOTES,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.MAKERPOLLARBITRUMVOTES,
        },
      ],
      discourse: [
        {
          discourseBaseUrl: "https://forum.makerdao.com",
          enabled: false,
        },
        {
          discourseBaseUrl: "https://forum.sky.money",
          enabled: true,
        },
      ],
    },
    {
      dao: {
        id: "f4b728d7-8117-4756-85d6-ca1a95412eaa",
        name: "Arbitrum DAO",
        slug: "arbitrum_dao",
        picture: "assets/project-logos/arbitrum",
        backgroundColor: "#55677b",
        hot: true,
      },
      indexers: [
        {
          portalUrl: "https://www.tally.xyz/gov/arbitrum",
          indexerType: IndexerType.PROPOSALS,
          indexerVariant: IndexerVariant.ARBCOREARBITRUMPROPOSALS,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.ARBCOREARBITRUMVOTES,
        },
        {
          portalUrl: "https://www.tally.xyz/gov/arbitrum",
          indexerType: IndexerType.PROPOSALS,
          indexerVariant: IndexerVariant.ARBTREASURYARBITRUMPROPOSALS,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.ARBTREASURYARBITRUMVOTES,
        },
        {
          portalUrl: "https://snapshot.org/#/arbitrumfoundation.eth",
          indexerType: IndexerType.PROPOSALS,
          indexerVariant: IndexerVariant.SNAPSHOTPROPOSALS,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.SNAPSHOTVOTES,
        },
      ],
      discourse: [
        {
          discourseBaseUrl: "https://forum.arbitrum.foundation",
          enabled: true,
        },
      ],
    },
    {
      dao: {
        id: "fa8fd707-b963-403b-8539-00674db3560d",
        name: "dYdX",
        slug: "dydx",
        picture: "assets/project-logos/dYdX",
        backgroundColor: "#51515a",
        hot: true,
      },
      indexers: [
        {
          portalUrl: "https://dydx.community/dashboard",
          indexerType: IndexerType.PROPOSALS,
          indexerVariant: IndexerVariant.DYDXMAINNETPROPOSALS,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.DYDXMAINNETVOTES,
        },
        {
          portalUrl: "https://snapshot.org/#/dydxgov.eth",
          indexerType: IndexerType.PROPOSALS,
          indexerVariant: IndexerVariant.SNAPSHOTPROPOSALS,
        },
        {
          indexerType: IndexerType.VOTES,
          indexerVariant: IndexerVariant.SNAPSHOTVOTES,
        },
      ],
      discourse: [
        {
          discourseBaseUrl: "https://dydx.forum",
          enabled: true,
        },
      ],
    },
  ];

  for (const data of daoData) {
    // Insert DAO
    await db
      .insertInto("dao")
      .values(data.dao)
      .onConflict((oc) => oc.column("id").doNothing())
      .execute();

    // Insert Indexers
    for (const indexer of data.indexers) {
      await db
        .insertInto("daoIndexer")
        .values({ ...indexer, daoId: data.dao.id })
        .onConflict((oc) => oc.column("id").doNothing())
        .execute();
    }

    // Insert Discourse
    for (const discourse of data.discourse) {
      await db
        .insertInto("daoDiscourse")
        .values({ ...discourse, daoId: data.dao.id })
        .onConflict((oc) => oc.column("id").doNothing())
        .execute();
    }
  }

  console.log("Seed completed successfully");
}
