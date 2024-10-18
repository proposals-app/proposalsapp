"use server";

import { validateRequest } from "@/lib/auth";
import { otel } from "@/lib/otel";
import { db } from "@proposalsapp/db";
import { revalidateTag } from "next/cache";
import { normalize } from "path";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { z } from "zod";

export const getOnboardingStep = async () => {
  return otel("get-onboarding-step", async () => {
    let { user } = await validateRequest();
    if (!user) return;

    let onboardingStep = await db
      .selectFrom("user")
      .where("user.id", "=", user.id)
      .select("onboardingStep")
      .executeTakeFirstOrThrow();

    return onboardingStep;
  });
};

export async function onboardingSubscribeDaos(daoSlugs: string[]) {
  return otel("onboarding-subscribe-daos", async () => {
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

      const existingSubscription = await db
        .selectFrom("subscription")
        .where("userId", "=", u.id)
        .where("daoId", "=", d.id)
        .executeTakeFirst();

      if (!existingSubscription)
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
      .set({ onboardingStep: 1 })
      .execute();

    revalidateTag("subscriptions");
  });
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
  return otel("onboarding-add-voter", async () => {
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
      ? await publicClient.getEnsName({
          address: voterAddress as `0x${string}`,
        })
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
      .set({ onboardingStep: 2 })
      .execute();

    await sendBulletin(user.id);

    revalidateTag("voters");
  });
};

export const skipOnboardingAddVoter = async () => {
  return otel("skip-onboarding-add-voter", async () => {
    const { user } = await validateRequest();
    if (!user) return;

    await db
      .updateTable("user")
      .where("user.id", "=", user.id)
      .set({ onboardingStep: 2 })
      .execute();

    await sendBulletin(user.id);

    revalidateTag("voters");
  });
};

const sendBulletin = async (userId: string) => {
  return otel("send-bulletin", async () => {
    type Message = {
      userId: string;
    };

    const JOB_TYPE = "email-bulletin";

    const message: Message = { userId: userId };

    await db
      .insertInto("jobQueue")
      .values({
        job: message,
        jobType: JOB_TYPE,
      })
      .execute();
  });
};
