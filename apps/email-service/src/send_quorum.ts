import { db, traverseJSON } from "@proposalsapp/db";
import { QuorumData, QuorumEmail, render } from "@proposalsapp/emails";
import { ServerClient } from "postmark";

const client = new ServerClient(process.env.POSTMARK_API_KEY ?? "");

export async function sendQuorum(job: any) {
  const { userId, proposalId } = job;
  if (!proposalId) throw new Error("proposalId is required for sendQuorum");

  const existingNotification = await db
    .selectFrom("jobQueue")
    .where((eb) =>
      eb.and([
        eb(traverseJSON(eb, "data", "userId"), "=", userId),
        eb(traverseJSON(eb, "data", "proposalId"), "=", proposalId),
      ]),
    )
    .where("type", "=", "EMAIL_QUORUM_NOT_REACHED")
    .where("status", "!=", "COMPLETED")
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
    .selectAll()
    .executeTakeFirstOrThrow();

  const daoHandler = await db
    .selectFrom("daoIndexer")
    .where("daoIndexer.id", "=", proposal.daoIndexerId)
    .selectAll()
    .executeTakeFirstOrThrow();

  let chainLogoUrl = "";

  if (daoHandler.indexerVariant.includes("SNAPSHOT"))
    chainLogoUrl = "assets/email/chains/snapshot.png";
  else if (daoHandler.indexerVariant.includes("MAINNET"))
    chainLogoUrl = "assets/email/chains/ethereum.png";
  else if (daoHandler.indexerVariant.includes("ARBITRUM"))
    chainLogoUrl = "assets/email/chains/arbitrum.png";
  else if (daoHandler.indexerVariant.includes("OPTIMISM"))
    chainLogoUrl = "assets/email/chains/optimism.png";
  else if (daoHandler.indexerVariant.includes("AVALANCHE"))
    chainLogoUrl = "assets/email/chains/avalanche.png";
  else if (daoHandler.indexerVariant.includes("POLYGON"))
    chainLogoUrl = "assets/email/chains/polygon.png";

  let { countdownSmall, countdownLarge } = {
    countdownSmall: "",
    countdownLarge: "",
  };

  const emailData: QuorumData = {
    daoName: dao.name,
    daoLogoUrl: `${dao.picture}`,
    chainLogoUrl: `${chainLogoUrl}`,
    url: proposal.url,
    proposalName: proposal.name,
    countdownUrl: countdownLarge,
    countdownUrlSmall: countdownSmall,
    scoresTotal: proposal.scoresTotal,
    scoresQuorum: proposal.scoresQuorum,
    quorum: proposal.quorum,
  };

  const emailHtml = await render(QuorumEmail(emailData));

  const options = {
    From: "new@proposals.app",
    To: user.email,
    Subject: `Proposal is not reaching quorum!`,
    HtmlBody: emailHtml,
  };

  try {
    await client.sendEmail(options);
    console.log(`send quorum for ${proposalId} to ${userId}`);

    // Insert jobQueue entry with status COMPLETED
    await db
      .insertInto("jobQueue")
      .values({
        type: "EMAIL_QUORUM_NOT_REACHED",
        data: { userId, proposalId },
        status: "COMPLETED",
      })
      .execute();
  } catch (error) {
    console.error(
      `Failed to send quorum email for ${proposalId} to ${userId}:`,
      error,
    );

    // Insert jobQueue entry with status FAILED
    await db
      .insertInto("jobQueue")
      .values({
        type: "EMAIL_QUORUM_NOT_REACHED",
        data: { userId, proposalId },
        status: "FAILED",
      })
      .execute();
  }
}
