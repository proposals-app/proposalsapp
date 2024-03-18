import {
  ProposalStateEnum,
  db,
  getCountdown,
  jsonArrayFrom,
} from "@proposalsapp/db";
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

  let bulletin_data: DailyBulletinData = await getBulletinData(user.id);

  const emailHtml = render(DailyBulletinEmail(bulletin_data));

  const options = {
    From: "new@proposals.app",
    To: user.email,
    Subject: `Proposals Daily Bulletin`,
    HtmlBody: emailHtml,
  };

  await client.sendEmail(options);

  console.log(`send bulletin to ${userId}`);
}

async function getBulletinData(userId: string): Promise<DailyBulletinData> {
  console.log("getBulletinData");
  let endingSoonProposals: EndingSoonProposal[] = await getEndingSoon(userId);
  console.log("getEndingSoon");
  let newProposals: EndingSoonProposal[] = await getNew(userId);
  console.log("getNew");
  let endedProposals: EndedProposal[] = await getEnded(userId);
  console.log("getEnded");

  let data: DailyBulletinData = {
    endingSoonProposals: endingSoonProposals,
    newProposals: newProposals,
    endedProposals: endedProposals,
  };

  return data;
}

async function getEndingSoon(userId: string): Promise<EndingSoonProposal[]> {
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

  let proposals = await db
    .selectFrom("proposal")
    .selectAll("proposal")
    .where(
      "timeEnd",
      "<",
      new Date(new Date().getTime() + 3 * 24 * 60 * 60 * 1000),
    )
    .where("timeEnd", ">", new Date())
    .where("proposal.daoId", "in", [
      ...subscriptions.map((sub) => sub.daoId),
      "",
    ])
    .where("proposalState", "!=", ProposalStateEnum.CANCELED)
    .where("flagged", "=", 0)
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
    .orderBy("proposal.timeEnd asc")
    .execute();

  const processedProposals = [];

  for (const p of proposals) {
    let chainLogoUrl = "";

    if (p.daoHandlerType!.includes("SNAPSHOT"))
      chainLogoUrl = "assets/email/chains/snapshot.png";
    else if (p.daoHandlerType!.includes("MAINNET"))
      chainLogoUrl = "assets/email/chains/ethereum.png";
    else if (p.daoHandlerType!.includes("ARBITRUM"))
      chainLogoUrl = "assets/email/chains/arbitrum.png";
    else if (p.daoHandlerType!.includes("OPTIMISM"))
      chainLogoUrl = "assets/email/chains/optimism.png";
    else if (p.daoHandlerType!.includes("AVALANCHE"))
      chainLogoUrl = "assets/email/chains/avalanche.png";
    else if (p.daoHandlerType!.includes("POLYGON"))
      chainLogoUrl = "assets/email/chains/polygon.png";

    let voted = p.vote.length > 0 ? true : false;

    let { countdownSmall, countdownLarge } = await getCountdown(p.timeEnd);

    processedProposals.push({
      daoLogoUrl: p.daoPicture!,
      chainLogoUrl: chainLogoUrl,
      url: p.url,
      proposalName: p.name,
      countdownUrl: countdownLarge,
      countdownUrlSmall: countdownSmall,
      countdownString: moment
        .utc(new Date(p.timeEnd))
        .format("on MMMM Do [at] h:mm:ss a"),
      voteIconUrl: voted
        ? "assets/email/voted.png"
        : "assets/email/not-voted-yet.png",
      voteStatus: voted ? "Voted" : "Not voted yet",
    });
  }

  return processedProposals;
}

async function getNew(userId: string): Promise<EndingSoonProposal[]> {
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

  let proposals = await db
    .selectFrom("proposal")
    .selectAll("proposal")
    .where(
      "timeCreated",
      ">",
      new Date(new Date().getTime() + 1 * 24 * 60 * 60 * 1000),
    )
    .where("proposal.daoId", "in", [
      ...subscriptions.map((sub) => sub.daoId),
      "",
    ])
    .where("proposalState", "=", ProposalStateEnum.ACTIVE)
    .where("flagged", "=", 0)
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
    .orderBy("proposal.timeEnd asc")
    .execute();

  const processedProposals = [];

  for (const p of proposals) {
    let chainLogoUrl = "";

    if (p.daoHandlerType!.includes("SNAPSHOT"))
      chainLogoUrl = "assets/email/chains/snapshot.png";
    else if (p.daoHandlerType!.includes("MAINNET"))
      chainLogoUrl = "assets/email/chains/ethereum.png";
    else if (p.daoHandlerType!.includes("ARBITRUM"))
      chainLogoUrl = "assets/email/chains/arbitrum.png";
    else if (p.daoHandlerType!.includes("OPTIMISM"))
      chainLogoUrl = "assets/email/chains/optimism.png";
    else if (p.daoHandlerType!.includes("AVALANCHE"))
      chainLogoUrl = "assets/email/chains/avalanche.png";
    else if (p.daoHandlerType!.includes("POLYGON"))
      chainLogoUrl = "assets/email/chains/polygon.png";

    let voted = p.vote.length > 0 ? true : false;

    let { countdownSmall, countdownLarge } = await getCountdown(p.timeEnd);

    processedProposals.push({
      daoLogoUrl: p.daoPicture!,
      chainLogoUrl: chainLogoUrl,
      url: p.url,
      proposalName: p.name,
      countdownUrl: countdownLarge,
      countdownUrlSmall: countdownSmall,
      countdownString: moment
        .utc(new Date(p.timeEnd))
        .format("on MMMM Do [at] h:mm:ss a"),
      voteIconUrl: voted
        ? "assets/email/voted.png"
        : "assets/email/not-voted-yet.png",
      voteStatus: voted ? "Voted" : "Not voted yet",
    });
  }

  return processedProposals;
}

async function getEnded(userId: string): Promise<EndedProposal[]> {
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

  let proposals = await db
    .selectFrom("proposal")
    .selectAll("proposal")
    .where(
      "timeEnd",
      ">",
      new Date(new Date().getTime() - 1 * 24 * 60 * 60 * 1000),
    )
    .where("timeEnd", "<", new Date())
    .where("proposal.daoId", "in", [
      ...subscriptions.map((sub) => sub.daoId),
      "",
    ])
    .where("proposalState", "=", ProposalStateEnum.ACTIVE)
    .where("flagged", "=", 0)
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
    .orderBy("proposal.timeEnd desc")
    .execute();

  const processedProposals = [];

  for (const p of proposals) {
    let chainLogoUrl = "";

    if (p.daoHandlerType!.includes("SNAPSHOT"))
      chainLogoUrl = "assets/email/chains/snapshot.png";
    else if (p.daoHandlerType!.includes("MAINNET"))
      chainLogoUrl = "assets/email/chains/ethereum.png";
    else if (p.daoHandlerType!.includes("ARBITRUM"))
      chainLogoUrl = "assets/email/chains/arbitrum.png";
    else if (p.daoHandlerType!.includes("OPTIMISM"))
      chainLogoUrl = "assets/email/chains/optimism.png";
    else if (p.daoHandlerType!.includes("AVALANCHE"))
      chainLogoUrl = "assets/email/chains/avalanche.png";
    else if (p.daoHandlerType!.includes("POLYGON"))
      chainLogoUrl = "assets/email/chains/polygon.png";

    let voted = p.vote.length > 0 ? true : false;

    let { countdownSmall, countdownLarge } = await getCountdown(p.timeEnd);

    processedProposals.push({
      daoLogoUrl: p.daoPicture!,
      chainLogoUrl: chainLogoUrl,
      url: p.url,
      proposalName: p.name,
      countdownUrl: countdownLarge,
      countdownUrlSmall: countdownSmall,
      countdownString: moment
        .utc(new Date(p.timeEnd))
        .format("on MMMM Do [at] h:mm:ss a"),
      voteIconUrl: voted
        ? "assets/email/voted.png"
        : "assets/email/did-not-vote.png",
      voteStatus: voted ? "Voted" : "Did not vote",
      quorumReached: p.scoresTotal > p.quorum,
      hiddenResult: p.proposalState == ProposalStateEnum.HIDDEN,
    });
  }

  return processedProposals;
}
