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
}

export async function seed(db: Kysely<DB>): Promise<void> {
  const daoData: DaoData[] = [
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
          indexerType: IndexerType.PROPOSALS_AND_VOTES,
          indexerVariant: IndexerVariant.ARBITRUM_COUNCIL_NOMINATIONS,
          portalUrl:
            "https://www.tally.xyz/gov/arbitrum/council/security-council",
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
        .onConflict((oc) => oc.constraint("unique_dao_indexer").doNothing())
        .execute();
    }
  }

  console.log("Seed completed successfully");
}
