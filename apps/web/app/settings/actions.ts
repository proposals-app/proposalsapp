"use server";

import { generateEmailVerificationCode, validateRequest } from "@/lib/auth";
import { AsyncReturnType } from "@/lib/utils";
import { db } from "@proposalsapp/db";
import { z } from "zod";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "path";
import { AuthCodeEmail, render } from "@proposalsapp/emails";
import { ServerClient } from "postmark";
import webPush from "web-push";

export const getCurrentSettings = async () => {
  let { user } = await validateRequest();
  if (!user) return { email: "", daoSlugs: [], voterAddress: "" };

  const email = await db
    .selectFrom("user")
    .select("email")
    .where("id", "=", user.id)
    .executeTakeFirstOrThrow();

  const subscriptions = await db
    .selectFrom("subscription")
    .innerJoin("dao", "dao.id", "subscription.daoId")
    .select("dao.slug")
    .where("subscription.userId", "=", user.id)
    .execute();

  const voter = await db
    .selectFrom("userToVoter")
    .innerJoin("voter", "voter.id", "userToVoter.voterId")
    .select("voter.address")
    .where("userToVoter.userId", "=", user.id)
    .executeTakeFirst();

  return {
    email: email.email,
    daoSlugs: subscriptions.map((sub) => sub.slug),
    voterAddress: voter?.address,
  };
};

export type currentSettingsType = AsyncReturnType<typeof getCurrentSettings>;

const ethereumAddressRegex = /^(0x)?[0-9a-fA-F]{40}$/;
const ensDomainRegex = /^(?=.{3,255}$)([a-zA-Z0-9-]+\.)+eth$/;

const settingsSchema = z.object({
  email: z.string().email(),
  daoSlugs: z.array(z.string()),
  voterAddress: z
    .string()
    .refine(
      (value) => ethereumAddressRegex.test(value) || ensDomainRegex.test(value),
      {
        message: "Must be a valid Ethereum address or ENS domain name",
      },
    )
    .optional(),
});

const client = new ServerClient(process.env.POSTMARK_API_KEY ?? "");

export const saveSettings = async (newSettings: currentSettingsType) => {
  const parsedSettings = settingsSchema.parse(newSettings);
  const { user } = await validateRequest();
  if (!user) throw new Error("Unauthorized");

  const currentSettings = await getCurrentSettings();

  // Update email if it's different
  if (parsedSettings.email !== currentSettings.email) {
    await db
      .updateTable("user")
      .where("id", "=", user.id)
      .set({ email: parsedSettings.email, emailVerified: false })
      .execute();

    const verificationCode = await generateEmailVerificationCode(
      user.id,
      parsedSettings.email,
    );

    const emailHtml = render(
      AuthCodeEmail({ email: parsedSettings.email, code: verificationCode }),
    );

    const options = {
      From: "new@proposals.app",
      To: parsedSettings.email,
      Subject: `Your proposals.app verification code is ${verificationCode}`,
      HtmlBody: emailHtml,
    };

    await client.sendEmail(options);
  }

  // Update subscriptions
  await db.deleteFrom("subscription").where("userId", "=", user.id).execute();

  for (const slug of parsedSettings.daoSlugs) {
    const dao = await db
      .selectFrom("dao")
      .selectAll()
      .where("slug", "=", slug)
      .executeTakeFirstOrThrow();

    await db
      .insertInto("subscription")
      .values({
        userId: user.id,
        daoId: dao.id,
      })
      .execute();
  }

  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(),
  });

  if (parsedSettings.voterAddress) {
    // Update userToVoter
    let voterAddress = parsedSettings.voterAddress.includes(".eth")
      ? await publicClient.getEnsAddress({
          name: normalize(parsedSettings.voterAddress),
        })
      : parsedSettings.voterAddress;

    if (!voterAddress)
      throw new Error("Invalid Ethereum address or ENS domain");

    const ensName = parsedSettings.voterAddress.includes(".eth")
      ? await publicClient.getEnsName({
          address: voterAddress as `0x${string}`,
        })
      : null;

    let voter = await db
      .selectFrom("voter")
      .select(["id", "ens"])
      .where("address", "=", voterAddress)
      .executeTakeFirst();

    if (!voter) {
      const [{ id: voterId }] = await db
        .insertInto("voter")
        .values({ address: voterAddress, ens: ensName })
        .returning(["id"])
        .execute();

      voter = { id: voterId, ens: ensName };
    } else if (ensName && voter.ens !== ensName) {
      await db
        .updateTable("voter")
        .set({ ens: ensName })
        .where("id", "=", voter.id)
        .execute();
    }

    const existingLink = await db
      .selectFrom("userToVoter")
      .select("id")
      .where("userId", "=", user.id)
      .where("voterId", "=", voter.id)
      .executeTakeFirst();

    if (!existingLink) {
      await db
        .insertInto("userToVoter")
        .values({ userId: user.id, voterId: voter.id })
        .execute();
    }
  }
};

export const setPushNotifications = async (subscriptionData: string) => {
  const { subscription } = JSON.parse(subscriptionData) as {
    subscription: webPush.PushSubscription;
  };

  console.log(subscription);

  const { user } = await validateRequest();
  if (!user) throw new Error("Unauthorized");

  await db
    .updateTable("userSettings")
    .set({ pushNotifications: true })
    .execute();

  await db
    .insertInto("userPushNotificationSubscription")
    .values({
      userId: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    })
    .execute();

  webPush.setVapidDetails(
    `mailto:${process.env.WEB_PUSH_EMAIL}`,
    process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY!,
    process.env.WEB_PUSH_PRIVATE_KEY!,
  );

  await webPush.sendNotification(
    subscription,
    JSON.stringify({
      title: "Hello",
      message:
        "Your push notifications are now active! Never miss a vote again 🕺",
    }),
  );
};

export const removePushNotifications = async (subscriptionEndpoint: string) => {
  const { user } = await validateRequest();
  if (!user) throw new Error("Unauthorized");

  await db
    .updateTable("userSettings")
    .set({ pushNotifications: false })
    .execute();

  await db
    .deleteFrom("userPushNotificationSubscription")
    .where("userId", "=", user.id)
    //.where("endpoint", "=", subscriptionEndpoint)
    .execute();
};
