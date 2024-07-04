import { ProposalStateEnum, db, jsonArrayFrom } from "@proposalsapp/db";
import { DailyBulletinData, render } from "@proposalsapp/emails";
import DailyBulletinEmail, {
  EndedProposal,
  EndingSoonProposal,
} from "@proposalsapp/emails/emails/daily-bulletin";
import moment from "moment";
import { ServerClient } from "postmark";

const client = new ServerClient(process.env.POSTMARK_API_KEY ?? "");

export async function sendBulletin(userId: string) {
  const user = await db
    .selectFrom("user")
    .where("user.id", "=", userId)
    .selectAll()
    .executeTakeFirstOrThrow();

  const bulletinData: DailyBulletinData = await getBulletinData(user.id);

  if (
    bulletinData.endedProposals.length === 0 &&
    bulletinData.endingSoonProposals.length === 0 &&
    bulletinData.newProposals.length === 0
  ) {
    console.log(`Skipped empty bulletin for ${userId}`);
    return;
  }

  const emailHtml = render(DailyBulletinEmail(bulletinData));
  const options = {
    From: "new@proposals.app",
    To: user.email,
    Subject: "Proposals Daily Bulletin",
    HtmlBody: emailHtml,
  };

  await client.sendEmail(options);
  console.log(`Sent bulletin to ${userId}`);
}

async function getBulletinData(userId: string): Promise<DailyBulletinData> {
  console.log("getBulletinData");
  const endingSoonProposals = await getEndingSoon(userId);
  const newProposals = await getNew(userId);
  const endedProposals = await getEnded(userId);

  return {
    endingSoonProposals,
    newProposals,
    endedProposals,
  };
}

async function getEndingSoon(userId: string): Promise<EndingSoonProposal[]> {
  if (!userId || userId.trim() === "") {
    console.log("Invalid userId in getEndingSoon:", userId);
    return [];
  }

  const subscriptions = await db
    .selectFrom("subscription")
    .where("userId", "=", userId)
    .select("subscription.daoId")
    .execute();

  const voters = (await db
    .selectFrom("voter")
    .innerJoin("userToVoter", "voter.id", "userToVoter.voterId")
    .where("userId", "=", userId)
    .select("voter.address")
    .execute()) ?? [{ address: "" }];

  const proposals = await db
    .selectFrom("proposal")
    .selectAll("proposal")
    .where("timeEnd", "<", new Date(Date.now() + 3 * 24 * 60 * 60 * 1000))
    .where("timeEnd", ">", new Date())
    .where(
      "proposal.daoId",
      "in",
      subscriptions.map((sub) => sub.daoId),
    )
    .where("proposalState", "!=", ProposalStateEnum.CANCELED)
    .where("flagged", "=", false)
    .leftJoin("dao", "proposal.daoId", "dao.id")
    .select("dao.name as daoName")
    .leftJoin("daoSettings", "proposal.daoId", "daoSettings.daoId")
    .select("daoSettings.picture as daoPicture")
    .leftJoin("daoHandler", "proposal.daoHandlerId", "daoHandler.id")
    .select("daoHandler.handlerType as daoHandlerType")
    .select((eb) => [
      jsonArrayFrom(
        eb
          .selectFrom("vote")
          .select("vote.voterAddress")
          .whereRef("vote.proposalId", "=", "proposal.id")
          .where(
            "vote.voterAddress",
            "in",
            voters.map((p) => p.address),
          ),
      ).as("vote"),
    ])
    .orderBy("proposal.timeEnd", "asc")
    .execute();

  return proposals.map((p) => {
    const chainLogoUrl = getChainLogoUrl(p.daoHandlerType!);
    const voted = p.vote.length > 0;

    return {
      daoLogoUrl: p.daoPicture!,
      chainLogoUrl,
      url: p.url,
      proposalName: p.name,
      countdownUrl: "", // Add appropriate value
      countdownUrlSmall: "", // Add appropriate value
      countdownString: moment
        .utc(p.timeEnd)
        .format("on MMMM Do [at] h:mm:ss a"),
      voteIconUrl: voted
        ? "assets/email/voted.png"
        : "assets/email/not-voted-yet.png",
      voteStatus: voted ? "Voted" : "Not voted yet",
    };
  });
}

async function getNew(userId: string): Promise<EndingSoonProposal[]> {
  if (!userId || userId.trim() === "") {
    console.log("Invalid userId in getNew:", userId);
    return [];
  }

  const subscriptions = await db
    .selectFrom("subscription")
    .where("userId", "=", userId)
    .select("subscription.daoId")
    .execute();

  const voters = (await db
    .selectFrom("voter")
    .innerJoin("userToVoter", "voter.id", "userToVoter.voterId")
    .where("userId", "=", userId)
    .select("voter.address")
    .execute()) ?? [{ address: "" }];

  const proposals = await db
    .selectFrom("proposal")
    .selectAll("proposal")
    .where("timeCreated", ">", new Date(Date.now() - 24 * 60 * 60 * 1000))
    .where(
      "proposal.daoId",
      "in",
      subscriptions.map((sub) => sub.daoId),
    )
    .where("proposalState", "=", ProposalStateEnum.ACTIVE)
    .where("flagged", "=", false)
    .leftJoin("dao", "proposal.daoId", "dao.id")
    .select("dao.name as daoName")
    .leftJoin("daoSettings", "proposal.daoId", "daoSettings.daoId")
    .select("daoSettings.picture as daoPicture")
    .leftJoin("daoHandler", "proposal.daoHandlerId", "daoHandler.id")
    .select("daoHandler.handlerType as daoHandlerType")
    .select((eb) => [
      jsonArrayFrom(
        eb
          .selectFrom("vote")
          .select("vote.voterAddress")
          .whereRef("vote.proposalId", "=", "proposal.id")
          .where(
            "vote.voterAddress",
            "in",
            voters.map((p) => p.address),
          ),
      ).as("vote"),
    ])
    .orderBy("proposal.timeEnd", "asc")
    .execute();

  return proposals.map((p) => {
    const chainLogoUrl = getChainLogoUrl(p.daoHandlerType!);
    const voted = p.vote.length > 0;

    return {
      daoLogoUrl: p.daoPicture!,
      chainLogoUrl,
      url: p.url,
      proposalName: p.name,
      countdownUrl: "", // Add appropriate value
      countdownUrlSmall: "", // Add appropriate value
      countdownString: moment
        .utc(p.timeEnd)
        .format("on MMMM Do [at] h:mm:ss a"),
      voteIconUrl: voted
        ? "assets/email/voted.png"
        : "assets/email/not-voted-yet.png",
      voteStatus: voted ? "Voted" : "Not voted yet",
    };
  });
}

async function getEnded(userId: string): Promise<EndedProposal[]> {
  if (!userId || userId.trim() === "") {
    console.log("Invalid userId in getEnded:", userId);
    return [];
  }

  const subscriptions = await db
    .selectFrom("subscription")
    .where("userId", "=", userId)
    .select("subscription.daoId")
    .execute();

  const voters = (await db
    .selectFrom("voter")
    .innerJoin("userToVoter", "voter.id", "userToVoter.voterId")
    .where("userId", "=", userId)
    .select("voter.address")
    .execute()) ?? [{ address: "" }];

  const proposals = await db
    .selectFrom("proposal")
    .selectAll("proposal")
    .where("timeEnd", "<", new Date())
    .where("timeEnd", ">", new Date(Date.now() - 24 * 60 * 60 * 1000))
    .where(
      "proposal.daoId",
      "in",
      subscriptions.map((sub) => sub.daoId),
    )
    .where("proposalState", "!=", ProposalStateEnum.CANCELED)
    .where("flagged", "=", false)
    .leftJoin("dao", "proposal.daoId", "dao.id")
    .select("dao.name as daoName")
    .leftJoin("daoSettings", "proposal.daoId", "daoSettings.daoId")
    .select("daoSettings.picture as daoPicture")
    .leftJoin("daoHandler", "proposal.daoHandlerId", "daoHandler.id")
    .select("daoHandler.handlerType as daoHandlerType")
    .select((eb) => [
      jsonArrayFrom(
        eb
          .selectFrom("vote")
          .select("vote.voterAddress")
          .whereRef("vote.proposalId", "=", "proposal.id")
          .where(
            "vote.voterAddress",
            "in",
            voters.map((p) => p.address),
          ),
      ).as("vote"),
    ])
    .orderBy("proposal.timeEnd", "desc")
    .execute();

  return proposals.map((p) => {
    const chainLogoUrl = getChainLogoUrl(p.daoHandlerType!);
    const voted = p.vote.length > 0;

    return {
      daoLogoUrl: p.daoPicture!,
      chainLogoUrl,
      url: p.url,
      proposalName: p.name,
      countdownUrl: "", // Add appropriate value
      countdownUrlSmall: "", // Add appropriate value
      countdownString: moment
        .utc(p.timeEnd)
        .format("on MMMM Do [at] h:mm:ss a"),
      voteIconUrl: voted
        ? "assets/email/voted.png"
        : "assets/email/did-not-vote.png",
      voteStatus: voted ? "Voted" : "Did not vote",
      quorumReached: p.scoresTotal > p.quorum,
      hiddenResult: p.proposalState === ProposalStateEnum.HIDDEN,
    };
  });
}

function getChainLogoUrl(handlerType: string): string {
  if (handlerType.includes("SNAPSHOT"))
    return "assets/email/chains/snapshot.png";
  if (handlerType.includes("MAINNET"))
    return "assets/email/chains/ethereum.png";
  if (handlerType.includes("ARBITRUM"))
    return "assets/email/chains/arbitrum.png";
  if (handlerType.includes("OPTIMISM"))
    return "assets/email/chains/optimism.png";
  if (handlerType.includes("AVALANCHE"))
    return "assets/email/chains/avalanche.png";
  if (handlerType.includes("POLYGON")) return "assets/email/chains/polygon.png";
  return "";
}
