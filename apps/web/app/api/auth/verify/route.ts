import { db } from "@proposalsapp/db";
import { lucia, verifyVerificationCode } from "@/lib/auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { NextURL } from "next/dist/server/web/next-url";

export async function POST(request: Request) {
  const { otp } = await request.json();

  if (!otp)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );

  const cookieStore = cookies();
  const cookie = cookieStore.get("auth_session");

  if (!cookie)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );

  const { user } = await lucia.validateSession(cookie.value);

  if (!user) return NextResponse.error();

  const validCode = await verifyVerificationCode(user, otp);

  if (!validCode)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );

  await lucia.invalidateUserSessions(user.id);

  await db
    .updateTable("user")
    .where("user.id", "=", user.id)
    .set({ emailVerified: true })
    .execute();

  const session = await lucia.createSession(user.id, {
    email: user.email,
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
