"use server";

import { validateRequest } from "@/lib/auth";
import { db } from "@proposalsapp/db";
import { revalidateTag } from "next/cache";
import { normalize } from "path";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { z } from "zod";

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
