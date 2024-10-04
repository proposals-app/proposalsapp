import { db } from "@proposalsapp/db";
import { NextResponse } from "next/server";
import { ServerClient } from "postmark";
import { AuthCodeEmail, render } from "@proposalsapp/emails";
import { generateEmailVerificationCode } from "@/lib/auth";

const client = new ServerClient(process.env.POSTMARK_API_KEY ?? "");

export async function POST(request: Request) {
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  let user = await db
    .selectFrom("user")
    .select(["id", "email", "emailVerified"])
    .where("user.email", "=", email)
    .executeTakeFirst();

  if (!user) {
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

  const emailHtml = await render(
    AuthCodeEmail({ email, code: verificationCode }),
  );

  const options = {
    From: "new@proposals.app",
    To: email,
    Subject: `Your proposals.app verification code is ${verificationCode}`,
    HtmlBody: emailHtml,
  };

  await client.sendEmail(options);

  return NextResponse.json(
    { message: "Verification code sent" },
    { status: 200 },
  );
}
