import { db } from "@proposalsapp/db";
import { ServerClient } from "postmark";
import { AuthCodeEmail, render } from "@proposalsapp/emails";
import { generateEmailVerificationCode, lucia } from "@/lib/auth";
import type { APIContext } from "astro";

const client = new ServerClient(import.meta.env.POSTMARK_API_KEY ?? "");

export async function POST(context: APIContext): Promise<Response> {
  const { email } = await context.request.json();

  console.log(email);

  if (!email) {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
    });
  }

  let user = await db
    .selectFrom("user")
    .select(["id", "email", "emailVerified"])
    .where("user.email", "=", email)
    .executeTakeFirst();

  if (!user) {
    // Use this opportunity to do some cleanup
    await lucia.deleteExpiredSessions();

    await db
      .insertInto("user")
      .values({
        email,
        emailVerified: false,
      })
      .execute();

    user = await db
      .selectFrom("user")
      .select(["id", "email", "emailVerified"])
      .where("user.email", "=", email)
      .executeTakeFirstOrThrow();

    await db.insertInto("userSettings").values({ userId: user.id }).execute();
  }

  const verificationCode = await generateEmailVerificationCode(user.id, email);

  const emailHtml = render(AuthCodeEmail({ email, code: verificationCode }));

  const options = {
    From: "new@proposals.app",
    To: email,
    Subject: `Your proposals.app verification code is ${verificationCode}`,
    HtmlBody: emailHtml,
  };

  await client.sendEmail(options);

  const session = await lucia.createSession(user.id, { email: user.email });
  const sessionCookie = lucia.createSessionCookie(session.id);
  context.cookies.set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes,
  );

  return new Response();
}
