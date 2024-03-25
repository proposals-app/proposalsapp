"use server";

import { AsyncReturnType } from "@/lib/utils";
import { db } from "@proposalsapp/db";

export const getHotDaos = async () => {
  const daosList = await db
    .selectFrom("dao")
    .where("dao.hot", "=", 1)
    .innerJoin("daoSettings", "dao.id", "daoSettings.daoId")
    .selectAll()
    .execute();

  return daosList;
};

export type hotDaosType = AsyncReturnType<typeof getHotDaos>;
