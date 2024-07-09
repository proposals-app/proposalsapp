import type { AsyncReturnType } from "@/lib/utils";
import { db } from "@proposalsapp/db";

export const getHotDaos = async () => {
  return await db
    .selectFrom("dao")
    .where("dao.hot", "=", true)
    .innerJoin("daoSettings", "dao.id", "daoSettings.daoId")
    .orderBy("dao.name", "asc")
    .selectAll()
    .execute();
};

export type hotDaosType = AsyncReturnType<typeof getHotDaos>;
