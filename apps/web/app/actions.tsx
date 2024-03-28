"use server";

import { validateRequest } from "@/lib/auth";
import { AsyncReturnType } from "@/lib/utils";
import { db } from "@proposalsapp/db";
import { revalidateTag } from "next/cache";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";
import { z } from "zod";

enum StateFilterEnum {
  ALL = "all",
  OPEN = "open",
  CLOSED = "closed",
}

export const getVoters = async () => {
  let { user } = await validateRequest();
  if (!user) return;

  const voters = await db
    .selectFrom("userToVoter")
    .where("userToVoter.userId", "=", user.id)
    .selectAll()
    .execute();

  return voters;
};

export const getSubscripions = async () => {
  let { user } = await validateRequest();
  if (!user) return;

  const subscriptions = await db
    .selectFrom("subscription")
    .where("subscription.userId", "=", user.id)
    .selectAll()
    .execute();

  return subscriptions;
};

const ethereumAddressRegex = /^(0x)?[0-9a-fA-F]{40}$/;
const ensDomainRegex = /^(?=.{3,255}$)([a-zA-Z0-9-]+\.)+eth$/;

const voterFormSchema = z.object({
  address: z
    .string()
    .refine(
      (value) => ethereumAddressRegex.test(value) || ensDomainRegex.test(value),
      {
        message: "Must be a valid Ethereum address or ENS domain name",
      },
    ),
});

export const addVoter = async (formData: FormData) => {
  const { address } = voterFormSchema.parse({
    address: formData.get("address"),
  });

  let { user } = await validateRequest();
  if (!user) return;

  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(),
  });

  let voterAddress = address;
  if (address.includes(".eth")) {
    const ensAddress = await publicClient.getEnsAddress({
      name: normalize(address),
    });
    if (!ensAddress) return;
    else voterAddress = ensAddress;
  }

  const ensName = await publicClient.getEnsName({
    address: voterAddress as `0x${string}`,
  });

  let voter = await db
    .selectFrom("voter")
    .select(["voter.id", "voter.ens"])
    .where("voter.address", "=", voterAddress)
    .executeTakeFirst();

  if (!voter) {
    await db
      .insertInto("voter")
      .values({ address: voterAddress, ens: ensName })
      .execute();

    let newVoter = await db
      .selectFrom("voter")
      .select(["voter.id", "voter.ens"])
      .where("voter.address", "=", voterAddress)
      .executeTakeFirstOrThrow();

    await db
      .insertInto("userToVoter")
      .values({ userId: user.id, voterId: newVoter.id })
      .executeTakeFirst();
  } else {
    if (ensName && voter.ens != ensName)
      await db
        .updateTable("voter")
        .set({ ens: ensName })
        .where("voter.id", "=", voter.id)
        .execute();

    await db
      .insertInto("userToVoter")
      .values({ userId: user.id, voterId: voter.id })
      .executeTakeFirst();
  }

  revalidateTag("voters");
};

export const getGuestProposals = async (
  active: StateFilterEnum,
  daos: string | string[],
  page: number,
) => {
  let daos_query = db.selectFrom("dao");

  if (daos && !Array.isArray(daos))
    daos_query = daos_query.where("dao.slug", "=", daos);

  if (daos && Array.isArray(daos))
    daos_query = daos_query.where("dao.slug", "in", [...daos]);

  let db_daos = await daos_query.selectAll().execute();

  let proposals_query = db
    .selectFrom("proposal")
    .select([
      "proposal.id",
      "proposal.daoId",
      "proposal.name",
      "proposal.url",
      "proposal.timeEnd",
    ])
    .where("proposal.flagged", "=", 0)
    .leftJoin("dao", "proposal.daoId", "dao.id")
    .select("dao.name as daoName")
    .leftJoin("daoSettings", "proposal.daoId", "daoSettings.daoId")
    .select("daoSettings.picture as daoPicture")
    .offset(page * 25)
    .limit(25)
    .where(
      "proposal.daoId",
      "in",
      db_daos.map((d) => d.id),
    );

  if (active == StateFilterEnum.ALL) {
    proposals_query = proposals_query.where("proposal.proposalState", "in", [
      "QUEUED",
      "DEFEATED",
      "EXECUTED",
      "EXPIRED",
      "SUCCEEDED",
      "HIDDEN",
      "ACTIVE",
    ]);
    proposals_query = proposals_query.orderBy("proposal.timeEnd", "desc");
  }

  if (active == StateFilterEnum.OPEN) {
    proposals_query = proposals_query.where(
      "proposal.proposalState",
      "=",
      "ACTIVE",
    );
    proposals_query = proposals_query.orderBy("timeEnd", "asc");
  }

  if (active == StateFilterEnum.CLOSED) {
    proposals_query = proposals_query.where("proposal.proposalState", "in", [
      "QUEUED",
      "DEFEATED",
      "EXECUTED",
      "EXPIRED",
      "SUCCEEDED",
      "HIDDEN",
    ]);
    proposals_query = proposals_query.orderBy("timeEnd", "desc");
  }

  proposals_query = proposals_query.orderBy("proposal.name", "asc");

  const proposals = await proposals_query.execute();

  return proposals;
};

export type getGuestProposalsType = AsyncReturnType<typeof getGuestProposals>;

export const getHotDaos = async () => {
  const daosList = await db
    .selectFrom("dao")
    .where("dao.hot", "=", 1)
    .innerJoin("daoSettings", "dao.id", "daoSettings.daoId")
    .orderBy("dao.name", "asc")
    .selectAll()
    .execute();

  return daosList;
};

export type hotDaosType = AsyncReturnType<typeof getHotDaos>;
