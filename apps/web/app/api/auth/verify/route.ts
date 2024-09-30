import { lucia, verifyVerificationCode } from "@/lib/auth";
import { db } from "@proposalsapp/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { email, otp } = await request.json();

  if (!email || !otp) {
    return NextResponse.json(
      { error: "Email and OTP are required" },
      { status: 400 },
    );
  }

  const user = await db
    .selectFrom("user")
    .select(["id", "email", "emailVerified"])
    .where("user.email", "=", email)
    .executeTakeFirst();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const validCode = await verifyVerificationCode(user, otp);

  if (!validCode) {
    return NextResponse.json(
      { error: "Invalid or expired verification code" },
      { status: 400 },
    );
  }

  await db
    .updateTable("user")
    .where("user.id", "=", user.id)
    .set({ emailVerified: true })
    .execute();

  const session = await lucia.createSession(user.id, {
    email: user.email,
  });
  const sessionCookie = lucia.createSessionCookie(session.id);

  const response = NextResponse.json(
    { message: "Verification successful" },
    { status: 200 },
  );

  response.cookies.set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes,
  );

  return response;
}
