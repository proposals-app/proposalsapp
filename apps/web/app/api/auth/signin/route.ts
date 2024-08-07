import { db } from "@proposalsapp/db";
import { NextResponse } from "next/server";
import { NextURL } from "next/dist/server/web/next-url";
import { ServerClient } from "postmark";
import { AuthCodeEmail, render } from "@proposalsapp/emails";
import { generateEmailVerificationCode, lucia } from "@/lib/auth";

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

  const session = await lucia.createSession(user.id, {
    email: email,
  });
  const sessionCookie = lucia.createSessionCookie(session.id);

  let response = NextResponse.redirect(new NextURL("/", request.url));

  response.cookies.set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes,
  );

  return response;
}
