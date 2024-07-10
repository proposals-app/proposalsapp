import { db } from "@proposalsapp/db";
import { lucia, verifyVerificationCode } from "@/lib/auth";
import type { APIContext } from "astro";

export async function POST(context: APIContext): Promise<Response> {
  const { otp } = await context.request.json();

  if (!otp) {
    return new Response(JSON.stringify({ error: "Wrong OTP" }), {
      status: 500,
    });
  }

  if (!context.locals.session) {
    return new Response(JSON.stringify({ error: "Session not found" }), {
      status: 500,
    });
  }

  const { user } = await lucia.validateSession(context.locals.session.id);

  if (!user) return new Response("User not found", { status: 500 });

  const validCode = await verifyVerificationCode(user, otp);

  if (!validCode) {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
    });
  }

  await db
    .updateTable("user")
    .where("user.id", "=", user.id)
    .set({ emailVerified: true })
    .execute();

  const session = await lucia.createSession(user.id, { email: user.email });
  const sessionCookie = lucia.createSessionCookie(session.id);
  context.cookies.set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes,
  );

  return new Response();
}
