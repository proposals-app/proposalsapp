import {
  db,
  NotificationDispatchedStateEnum,
  NotificationTypeEnumV2,
} from "@proposalsapp/db";
import { NotVotedData, NotVotedEmail, render } from "@proposalsapp/emails";
import { ServerClient } from "postmark";
import { JobData } from ".";

const client = new ServerClient(process.env.POSTMARK_API_KEY ?? "");

export async function sendTimeend(job: JobData) {
  const { userId, proposalId } = job;
  if (!proposalId) throw new Error("proposalId is required for sendTimeend");

  const existingNotification = await db
    .selectFrom("notification")
    .where("userId", "=", userId)
    .where("proposalId", "=", proposalId)
    .where("notification.type", "=", NotificationTypeEnumV2.EMAILTIMEEND)
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

  const daoHandler = await db
    .selectFrom("daoHandler")
    .where("daoHandler.id", "=", proposal.daoHandlerId)
    .selectAll()
    .executeTakeFirstOrThrow();

  let chainLogoUrl = "";

  if (daoHandler.handlerType.includes("SNAPSHOT"))
    chainLogoUrl = "assets/email/chains/snapshot.png";
  else if (daoHandler.handlerType.includes("MAINNET"))
    chainLogoUrl = "assets/email/chains/ethereum.png";
  else if (daoHandler.handlerType.includes("ARBITRUM"))
    chainLogoUrl = "assets/email/chains/arbitrum.png";
  else if (daoHandler.handlerType.includes("OPTIMISM"))
    chainLogoUrl = "assets/email/chains/optimism.png";
  else if (daoHandler.handlerType.includes("AVALANCHE"))
    chainLogoUrl = "assets/email/chains/avalanche.png";
  else if (daoHandler.handlerType.includes("POLYGON"))
    chainLogoUrl = "assets/email/chains/polygon.png";

  let { countdownSmall, countdownLarge } = {
    countdownSmall: "",
    countdownLarge: "",
  }; // await getCountdown(proposal.timeEnd);

  const emailData: NotVotedData = {
    daoName: dao.name,
    daoLogoUrl: `${dao.picture}`,
    chainLogoUrl: `${chainLogoUrl}`,
    url: proposal.url,
    proposalName: proposal.name,
    countdownUrl: countdownLarge,
    countdownUrlSmall: countdownSmall,
    scoresTotal: proposal.scoresTotal,
    quorum: proposal.quorum,
  };

  const emailHtml = await render(NotVotedEmail(emailData));

  const options = {
    From: "new@proposals.app",
    To: user.email,
    Subject: `Proposal is ending soon!`,
    HtmlBody: emailHtml,
  };

  let res = await client.sendEmail(options);

  await db
    .insertInto("notification")
    .values({
      userId: userId,
      proposalId: proposalId,
      type: NotificationTypeEnumV2.EMAILTIMEEND,
      dispatchstatus: NotificationDispatchedStateEnum.DISPATCHED,
      submittedAt: new Date(res.SubmittedAt),
    })
    .execute();

  console.log(`send timeend for ${proposalId} to ${userId}`);
}
