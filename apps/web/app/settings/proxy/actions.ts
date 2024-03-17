"use server";

import { db } from "@proposalsapp/db";
import { validateRequest } from "../../../server/auth";
import { createPublicClient } from "viem";
import { http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { normalize } from "viem/ens";

export const addVoter = async (address: string) => {
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
};

export const removeVoter = async (address: string) => {
  let { user } = await validateRequest();
  if (!user) return;

  const voter = await db
    .selectFrom("voter")
    .select("voter.id")
    .where("voter.address", "=", address)
    .executeTakeFirstOrThrow();

  await db
    .deleteFrom("userToVoter")
    .where("userToVoter.userId", "=", user.id)
    .where("userToVoter.voterId", "=", voter.id)
    .execute();
};

export const getVoters = async () => {
  let { user } = await validateRequest();
  if (!user) return [];

  const u = await db
    .selectFrom("user")
    .select(["user.id"])
    .where("user.id", "=", user.id)
    .executeTakeFirstOrThrow();

  const voters = await db
    .selectFrom("userToVoter")
    .where("userToVoter.userId", "=", u.id)
    .leftJoin("voter", "userToVoter.voterId", "voter.id")
    .select(["voter.address", "voter.ens"])
    .execute();

  return voters.map((v) => {
    if (v.address && v.ens) return { address: v.address, ens: v.ens };
    else if (v.address && !v.ens) return { address: v.address, ens: "" };
    else return { address: "", ens: "" };
  });
};

type AsyncReturnType<T extends (...args: any) => Promise<any>> = T extends (
  ...args: any
) => Promise<infer R>
  ? R
  : any;

export type getVotesType = AsyncReturnType<typeof getVoters>;
