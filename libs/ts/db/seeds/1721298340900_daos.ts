import { Kysely } from "kysely";
import { DB } from "../src/kysely_db";
import {
  DaoSeedData,
  HandlerData,
  seedData,
  SettingsData,
} from "./initial_data";

async function upsertDao(db: Kysely<DB>, daoData: DaoSeedData) {
  const existingDao = await db
    .selectFrom("dao")
    .selectAll()
    .where("name", "=", daoData.name)
    .executeTakeFirst();

  if (existingDao) {
    await db
      .updateTable("dao")
      .set({
        name: daoData.name,
        slug: daoData.slug,
        hot: daoData.hot,
      })
      .where("id", "=", existingDao.id)
      .execute();
  } else {
    await db
      .insertInto("dao")
      .values({
        name: daoData.name,
        slug: daoData.slug,
        hot: daoData.hot,
      })
      .execute();
  }

  const updatedDao = await db
    .selectFrom("dao")
    .selectAll()
    .where("name", "=", daoData.name)
    .executeTakeFirstOrThrow();

  return updatedDao;
}

async function upsertHandlers(
  db: Kysely<DB>,
  daoId: string,
  handlers: HandlerData[],
) {
  for (const handler of handlers) {
    const existingHandler = await db
      .selectFrom("daoHandler")
      .selectAll()
      .where("daoId", "=", daoId)
      .where("handlerType", "=", handler.handler_type)
      .executeTakeFirst();

    if (existingHandler) {
      await db
        .updateTable("daoHandler")
        .set({
          governancePortal: handler.governance_portal,
          refreshEnabled: handler.refresh_enabled,
          proposalsRefreshSpeed: handler.proposals_refresh_speed,
          votesRefreshSpeed: handler.votes_refresh_speed,
        })
        .where("id", "=", existingHandler.id)
        .execute();
    } else {
      await db
        .insertInto("daoHandler")
        .values({
          daoId: daoId,
          handlerType: handler.handler_type,
          governancePortal: handler.governance_portal,
          refreshEnabled: handler.refresh_enabled,
          proposalsIndex: handler.proposals_index,
          proposalsRefreshSpeed: handler.proposals_refresh_speed,
          votesIndex: handler.votes_index,
          votesRefreshSpeed: handler.votes_refresh_speed,
        })
        .execute();
    }
  }
}

async function upsertSettings(
  db: Kysely<DB>,
  daoId: string,
  settings: SettingsData,
) {
  const existingSettings = await db
    .selectFrom("daoSettings")
    .selectAll()
    .where("daoId", "=", daoId)
    .executeTakeFirst();

  if (existingSettings) {
    await db
      .updateTable("daoSettings")
      .set({
        picture: settings.picture,
        backgroundColor: settings.background_color,
      })
      .where("id", "=", existingSettings.id)
      .execute();
  } else {
    await db
      .insertInto("daoSettings")
      .values({
        daoId: daoId,
        picture: settings.picture,
        backgroundColor: settings.background_color,
      })
      .execute();
  }
}

export async function seed(db: Kysely<DB>): Promise<void> {
  const daos = seedData();
  for (const daoData of daos) {
    const dao = await upsertDao(db, daoData);
    await upsertHandlers(db, dao.id, daoData.handlers);
    await upsertSettings(db, dao.id, daoData.settings);
  }
}
