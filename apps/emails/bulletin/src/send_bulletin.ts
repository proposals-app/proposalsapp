import {
  Generated,
  Json,
  ProposalStateEnum,
  db,
  jsonArrayFrom,
} from "@proposalsapp/db";
import { DailyBulletinData, render } from "@proposalsapp/emails";
import DailyBulletinEmail, {
  EndedProposal,
  EndingSoonProposal,
} from "@proposalsapp/emails/emails/daily-bulletin";
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

  if (subscriptions.length == 0) return [];

  const voters = await db
    .selectFrom("voter")
    .innerJoin("userToVoter", "voter.id", "userToVoter.voterId")
    .where("userId", "=", userId)
    .select("voter.address")
    .execute();

  const now = new Date();
  const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const proposals = await db
    .selectFrom("proposal")
    .selectAll("proposal")
    .where("timeEnd", "<", threeDaysLater)
    .where("timeEnd", ">", now)
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
            voters.length > 0 ? voters.map((p) => p.address) : [""],
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
      timeEnd: p.timeEnd.getTime() / 1000,
      hasVoters: voters.length > 0,
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

  if (subscriptions.length == 0) return [];

  const voters = (await db
    .selectFrom("voter")
    .innerJoin("userToVoter", "voter.id", "userToVoter.voterId")
    .where("userId", "=", userId)
    .select("voter.address")
    .execute()) ?? [{ address: "" }];

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const proposals = await db
    .selectFrom("proposal")
    .selectAll("proposal")
    .where("timeCreated", ">", oneDayAgo)
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
            voters.length > 0 ? voters.map((p) => p.address) : [""],
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
      timeEnd: p.timeEnd.getTime() / 1000,
      hasVoters: voters.length > 0,
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

  if (subscriptions.length == 0) return [];

  const voters = (await db
    .selectFrom("voter")
    .innerJoin("userToVoter", "voter.id", "userToVoter.voterId")
    .where("userId", "=", userId)
    .select("voter.address")
    .execute()) ?? [{ address: "" }];

  const now = new Date();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const proposals = await db
    .selectFrom("proposal")
    .selectAll("proposal")
    .where("timeEnd", "<", now)
    .where("timeEnd", ">", oneDayAgo)
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
            voters.length > 0 ? voters.map((p) => p.address) : [""],
          ),
      ).as("vote"),
    ])
    .orderBy("proposal.timeEnd", "desc")
    .execute();

  function getMaxScoreIndex(scores: number[]): number {
    let maxIndex = 0;
    for (let i = 1; i < scores.length; i++) {
      if (scores[i] > scores[maxIndex]) {
        maxIndex = i;
      }
    }
    return maxIndex;
  }

  function parseJsonField<T>(json: Generated<Json> | null): T | null {
    if (json === null || json === undefined) {
      console.error("JSON is null or undefined");
      return null;
    }
    try {
      const parsed = JSON.parse(JSON.stringify(json)) as T;
      return parsed;
    } catch (error) {
      console.error("Failed to parse JSON:", error, json);
      return null;
    }
  }

  return proposals.map((p) => {
    const chainLogoUrl = getChainLogoUrl(p.daoHandlerType!);
    const voted = p.vote.length > 0;

    const choices = parseJsonField<string[]>(p.choices as Generated<Json>);
    const scores = parseJsonField<number[]>(p.scores as Generated<Json>);

    let result;
    let makerResult;
    if (
      p.scoresTotal > p.quorum &&
      p.proposalState !== ProposalStateEnum.HIDDEN
    ) {
      if (p.daoId !== "MakerDAO" && choices && scores) {
        const choiceIndex = getMaxScoreIndex(scores);
        result = {
          choiceName: choices[choiceIndex] || "",
          choicePercentage: Math.round(
            (scores[choiceIndex] / p.scoresTotal) * 100,
          ),
        };
      } else if (p.daoId === "MakerDAO") {
        makerResult = {
          choiceName: "Yes",
          mkrSupporting: Number((p.scoresTotal as number).toFixed(2)),
        };
      }
    }

    return {
      daoLogoUrl: p.daoPicture!,
      chainLogoUrl,
      url: p.url,
      proposalName: p.name,
      timeEnd: p.timeEnd.getTime() / 1000,
      hasVoters: voters.length > 0,
      voteIconUrl: voted
        ? "assets/email/voted.png"
        : "assets/email/did-not-vote.png",
      voteStatus: voted ? "Voted" : "Did not vote",
      quorumReached: p.scoresTotal > p.quorum,
      hiddenResult: p.proposalState === ProposalStateEnum.HIDDEN,
      result,
      makerResult,
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
