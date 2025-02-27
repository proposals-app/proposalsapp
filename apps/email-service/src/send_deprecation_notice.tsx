import { db } from "@proposalsapp/db";
import { DeprecationNoticeEmail, render } from "@proposalsapp/emails";
import { ServerClient } from "postmark";

const client = new ServerClient(process.env.POSTMARK_API_KEY ?? "");

export async function sendDeprecationNotice(job: any) {
  const { userId } = job;

  const user = await db
    .selectFrom("user")
    .where("user.id", "=", userId)
    .selectAll()
    .executeTakeFirstOrThrow();

  const emailHtml = await render(DeprecationNoticeEmail());
  const options = {
    From: "new@proposals.app",
    To: user.email,
    Subject: "We are making some changes…",
    HtmlBody: emailHtml,
  };

  await client.sendEmail(options);
  console.log(`Sent deprecation notice to ${userId}`);
}
