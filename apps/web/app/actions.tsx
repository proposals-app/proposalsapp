"use server";

import { validateRequest } from "@/lib/auth";
import { AsyncReturnType } from "@/lib/utils";
import { db, ProposalStateEnum } from "@proposalsapp/db";
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

export async function onboardingSubscribeDaos(daoSlugs: string[]) {
  let { user } = await validateRequest();
  if (!user) return;

  const u = await db
    .selectFrom("user")
    .selectAll()
    .where("user.id", "=", user.id)
    .executeTakeFirstOrThrow();

  for (const slug of daoSlugs) {
    const d = await db
      .selectFrom("dao")
      .selectAll()
      .where("slug", "=", slug)
      .executeTakeFirstOrThrow();

    await db
      .insertInto("subscription")
      .values({
        userId: u.id,
        daoId: d.id,
      })
      .execute();
  }

  await db
    .updateTable("user")
    .where("user.id", "=", user.id)
    .set({ onboardingStep: 2 })
    .execute();

  revalidateTag("subscriptions");
}

export const getOnboardingStep = async () => {
  let { user } = await validateRequest();
  if (!user) return;

  let onboardingStep = await db
    .selectFrom("user")
    .where("user.id", "=", user.id)
    .select("onboardingStep")
    .executeTakeFirstOrThrow();

  return onboardingStep;
};

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

export const onboardingAddVoter = async (formData: FormData) => {
  const { address } = voterFormSchema.parse({
    address: formData.get("address"),
  });

  const { user } = await validateRequest();
  if (!user) return;

  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(),
  });

  // Resolve ENS addresses
  let voterAddress = address.includes(".eth")
    ? await publicClient.getEnsAddress({ name: normalize(address) })
    : address;
  if (!voterAddress) return;

  // Optionally fetch ENS name for normal addresses
  const ensName = address.includes(".eth")
    ? await publicClient.getEnsName({ address: voterAddress as `0x${string}` })
    : null;

  // Check for existing voter or create new one
  let voter = await db
    .selectFrom("voter")
    .select(["id", "ens"])
    .where("address", "=", voterAddress)
    .executeTakeFirst();

  if (!voter) {
    // Insert new voter if not found
    const [{ id: voterId }] = await db
      .insertInto("voter")
      .values({ address: voterAddress, ens: ensName })
      .returning(["id"])
      .execute();

    voter = { id: voterId, ens: ensName };
  } else if (ensName && voter.ens !== ensName) {
    // Update ENS name if different
    await db
      .updateTable("voter")
      .set({ ens: ensName })
      .where("id", "=", voter.id)
      .execute();
  }

  // Check if there's already a link between the user and the voter
  const existingLink = await db
    .selectFrom("userToVoter")
    .select("id")
    .where("userId", "=", user.id)
    .where("voterId", "=", voter.id)
    .executeTakeFirst();

  if (!existingLink) {
    // Create a link if it doesn't exist
    await db
      .insertInto("userToVoter")
      .values({ userId: user.id, voterId: voter.id })
      .execute();
  }

  await db
    .updateTable("user")
    .where("user.id", "=", user.id)
    .set({ onboardingStep: 1 })
    .execute();

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
    .where("proposal.flagged", "=", false)
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
      ProposalStateEnum.QUEUED,
      ProposalStateEnum.DEFEATED,
      ProposalStateEnum.EXECUTED,
      ProposalStateEnum.EXPIRED,
      ProposalStateEnum.SUCCEEDED,
      ProposalStateEnum.HIDDEN,
      ProposalStateEnum.ACTIVE,
    ]);
    proposals_query = proposals_query.orderBy("proposal.timeEnd", "desc");
  }

  if (active == StateFilterEnum.OPEN) {
    proposals_query = proposals_query.where(
      "proposal.proposalState",
      "=",
      ProposalStateEnum.ACTIVE,
    );
    proposals_query = proposals_query.orderBy("timeEnd", "asc");
  }

  if (active == StateFilterEnum.CLOSED) {
    proposals_query = proposals_query.where("proposal.proposalState", "in", [
      ProposalStateEnum.QUEUED,
      ProposalStateEnum.DEFEATED,
      ProposalStateEnum.EXECUTED,
      ProposalStateEnum.EXPIRED,
      ProposalStateEnum.SUCCEEDED,
      ProposalStateEnum.HIDDEN,
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
    .where("dao.hot", "=", true)
    .innerJoin("daoSettings", "dao.id", "daoSettings.daoId")
    .orderBy("dao.name", "asc")
    .selectAll()
    .execute();

  return daosList;
};

export type hotDaosType = AsyncReturnType<typeof getHotDaos>;
