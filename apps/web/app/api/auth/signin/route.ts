import db from "@proposalsapp/db";
import { generateEmailVerificationCode, lucia } from "../../../../server/auth";
import { NextResponse } from "next/server";
import { NextURL } from "next/dist/server/web/next-url";
import { ServerClient } from "postmark";
import { AuthCodeEmail, render } from "@proposalsapp/emails";

const client = new ServerClient(process.env.POSTMARK_API_KEY ?? "");

export async function POST(request: Request) {
  const { email } = await request.json();
  if (!email)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );

  let user = await db
    .selectFrom("user")
    .select(["id", "email", "emailVerified"])
    .where("user.email", "=", email)
    .executeTakeFirst();

  if (!user) {
    //use this opportunity to do some cleanup
    await lucia.deleteExpiredSessions();

    await db
      .insertInto("user")
      .values({
        email,
        emailVerified: 0,
      })
      .execute();

    user = await db
      .selectFrom("user")
      .select(["id", "email", "emailVerified"])
      .where("user.email", "=", email)
      .executeTakeFirstOrThrow();
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

  const session = await lucia.createSession(user.id, {
    email: email,
  });
  const sessionCookie = lucia.createSessionCookie(session.id);

  let response = NextResponse.redirect(new NextURL("/", request.url));

  response.cookies.set(sessionCookie.name, sessionCookie.value);
  response.cookies.set("SameSite", "Lax");

  return response;
}
