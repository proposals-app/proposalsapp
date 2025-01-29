import {
  Generated,
  Json,
  ProposalState,
  db,
  jsonArrayFrom,
} from "@proposalsapp/db";
import {
  DailyBulletinData,
  DailyBulletinEmail,
  render,
} from "@proposalsapp/emails";
import {
  EndedProposal,
  EndingSoonProposal,
  NewProposal,
} from "@proposalsapp/emails/emails/daily-bulletin";
import { ServerClient } from "postmark";

const client = new ServerClient(process.env.POSTMARK_API_KEY ?? "");

export async function sendBulletin(job: any) {
  const { userId } = job;

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

  const emailHtml = await render(DailyBulletinEmail(bulletinData));
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
    .where("endAt", "<", threeDaysLater)
    .where("endAt", ">", now)
    .where(
      "proposal.daoId",
      "in",
      subscriptions.map((sub) => sub.daoId),
    )
    .where("proposalState", "!=", ProposalState.CANCELED)
    .where("markedSpam", "=", false)
    .leftJoin("dao", "proposal.daoId", "dao.id")
    .select(["dao.name as daoName", "dao.picture as daoPicture"])
    .leftJoin("daoIndexer", "proposal.daoIndexerId", "daoIndexer.id")
    .select("indexerVariant")
    .select((eb) => [
      jsonArrayFrom(
        eb
          .selectFrom("vote")
          .select("vote.voterAddress")
          .whereRef("vote.proposalId", "=", "proposal.id")
          .where("vote.voterAddress", "in", [
            "",
            ...voters.map((voter) => voter.address),
          ]),
      ).as("vote"),
    ])
    .orderBy("endAt", "asc")
    .execute();

  return proposals.map((p) => {
    const chainLogoUrl = getChainLogoUrl(p.indexerVariant!);
    const voted = p.vote.length > 0;

    return {
      daoLogoUrl: p.daoPicture!,
      chainLogoUrl,
      url: p.url,
      proposalName: p.name,
      timeEnd: p.endAt.getTime() / 1000,
      hasVoters: voters.length > 0,
      voteIconUrl: voted
        ? "assets/email/voted.png"
        : "assets/email/not-voted-yet.png",
      voteStatus: voted ? "Voted" : "Not voted yet",
    };
  });
}

async function getNew(userId: string): Promise<NewProposal[]> {
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
    .where("createdAt", ">", oneDayAgo)
    .where(
      "proposal.daoId",
      "in",
      subscriptions.map((sub) => sub.daoId),
    )
    .where("proposalState", "=", ProposalState.ACTIVE)
    .where("markedSpam", "=", false)
    .leftJoin("dao", "proposal.daoId", "dao.id")
    .select(["dao.name as daoName", "dao.picture as daoPicture"])
    .leftJoin("daoIndexer", "proposal.daoIndexerId", "daoIndexer.id")
    .select("indexerVariant")
    .select((eb) => [
      jsonArrayFrom(
        eb
          .selectFrom("vote")
          .select("vote.voterAddress")
          .whereRef("vote.proposalId", "=", "proposal.id")
          .where("vote.voterAddress", "in", [
            "",
            ...voters.map((voter) => voter.address),
          ]),
      ).as("vote"),
    ])
    .orderBy("endAt", "asc")
    .execute();

  return proposals.map((p) => {
    const chainLogoUrl = getChainLogoUrl(p.indexerVariant!);
    const voted = p.vote.length > 0;

    return {
      daoLogoUrl: p.daoPicture!,
      chainLogoUrl,
      url: p.url,
      proposalName: p.name,
      timeEnd: p.endAt.getTime() / 1000,
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
    .where("endAt", "<", now)
    .where("endAt", ">", oneDayAgo)
    .where(
      "proposal.daoId",
      "in",
      subscriptions.map((sub) => sub.daoId),
    )
    .where("proposalState", "!=", ProposalState.CANCELED)
    .where("markedSpam", "=", false)
    .leftJoin("dao", "proposal.daoId", "dao.id")
    .select(["dao.name as daoName", "dao.picture as daoPicture"])
    .leftJoin("daoIndexer", "proposal.daoIndexerId", "daoIndexer.id")
    .select("indexerVariant")
    .select((eb) => [
      jsonArrayFrom(
        eb
          .selectFrom("vote")
          .select("vote.voterAddress")
          .whereRef("vote.proposalId", "=", "proposal.id")
          .where("vote.voterAddress", "in", [
            "",
            ...voters.map((voter) => voter.address),
          ]),
      ).as("vote"),
    ])
    .orderBy("endAt", "desc")
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
    const chainLogoUrl = getChainLogoUrl(p.indexerVariant!);
    const voted = p.vote.length > 0;

    const choices = parseJsonField<string[]>(p.choices as Generated<Json>);
    const scores = parseJsonField<number[]>(p.scores as Generated<Json>);

    let result;
    let makerResult;
    if (p.scoresTotal > p.quorum && p.proposalState !== ProposalState.HIDDEN) {
      if (p.daoName !== "MakerDAO" && choices && scores) {
        const choiceIndex = getMaxScoreIndex(scores);
        result = {
          choiceName: choices[choiceIndex] || "",
          choicePercentage: Math.round(
            (scores[choiceIndex] / p.scoresTotal) * 100,
          ),
        };
      } else if (p.daoName === "MakerDAO") {
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
      timeEnd: p.endAt.getTime() / 1000,
      hasVoters: voters.length > 0,
      voteIconUrl: voted
        ? "assets/email/voted.png"
        : "assets/email/did-not-vote.png",
      voteStatus: voted ? "Voted" : "Did not vote",
      quorumReached: p.scoresQuorum >= p.quorum,
      hiddenResult: p.proposalState === ProposalState.HIDDEN,
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
