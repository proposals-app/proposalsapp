import {
  db,
  NotificationDispatchedStateEnum,
  NotificationTypeEnumV2,
} from "@proposalsapp/db";
import webPush from "web-push";

export async function sendTimeend(userId: string, proposalId: string) {
  const existingNotification = await db
    .selectFrom("notification")
    .where("userId", "=", userId)
    .where("proposalId", "=", proposalId)
    .where("notification.type", "=", NotificationTypeEnumV2.PUSHTIMEEND)
    .where(
      "notification.dispatchstatus",
      "=",
      NotificationDispatchedStateEnum.DISPATCHED,
    )
    .selectAll()
    .executeTakeFirst();

  if (existingNotification) return;

  const user = await db
    .selectFrom("user")
    .where("user.id", "=", userId)
    .selectAll()
    .executeTakeFirstOrThrow();

  const userPushSubscription = await db
    .selectFrom("userPushNotificationSubscription")
    .select(["endpoint", "p256dh", "auth"])
    .where("userId", "=", user.id)
    .execute();

  const proposal = await db
    .selectFrom("proposal")
    .where("proposal.id", "=", proposalId)
    .selectAll()
    .executeTakeFirstOrThrow();

  const dao = await db
    .selectFrom("dao")
    .where("dao.id", "=", proposal.daoId)
    .innerJoin("daoSettings", "daoSettings.daoId", "dao.id")
    .selectAll()
    .executeTakeFirstOrThrow();

  webPush.setVapidDetails(
    `mailto:${process.env.WEB_PUSH_EMAIL}`,
    process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY!,
    process.env.WEB_PUSH_PRIVATE_KEY!,
  );

  for (const pushSubscription of userPushSubscription) {
    const subscriptionData = {
      subscription: {
        endpoint: pushSubscription.endpoint,
        keys: { p256dh: pushSubscription.p256dh, auth: pushSubscription.auth },
      },
    };
    const { subscription } = subscriptionData as {
      subscription: webPush.PushSubscription;
    };

    await webPush.sendNotification(
      subscription,
      JSON.stringify({
        title: "Your Vote is Needed!",
        message: `${dao.name} proposal is nearing its deadline and you didn't vote yet. Don't forget to cast your vote!`,
      }),
    );
  }

  await db
    .insertInto("notification")
    .values({
      userId: userId,
      proposalId: proposalId,
      type: NotificationTypeEnumV2.PUSHTIMEEND,
      dispatchstatus: NotificationDispatchedStateEnum.DISPATCHED,
      submittedAt: new Date(),
    })
    .execute();

  console.log(`send push timeend for ${proposalId} to ${userId}`);
}
