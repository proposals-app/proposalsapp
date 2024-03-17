import { db } from "@proposalsapp/db";
import { Lucia, type User, type Session } from "lucia";
import { Mysql2Adapter } from "@lucia-auth/adapter-mysql";
import { cache } from "react";
import { TimeSpan, createDate, isWithinExpirationDate } from "oslo";
import { generateRandomString, alphabet } from "oslo/crypto";
import { createPool } from "mysql2/promise";

const pool = createPool(process.env.DATABASE_URL!);

const cookies = require("next/headers").cookies;

const adapter = new Mysql2Adapter(pool, {
  user: "user",
  session: "user_session",
});

export const lucia = new Lucia(adapter, {
  sessionExpiresIn: new TimeSpan(2, "w"),
  sessionCookie: {
    attributes: {
      secure: process.env.NODE_ENV! === "production",
    },
  },
  getUserAttributes: (attributes) => {
    return {
      email: attributes.email,
    };
  },
});

export const validateRequest = cache(
  async (): Promise<
    { user: User; session: Session } | { user: null; session: null }
  > => {
    const sessionId = cookies().get(lucia.sessionCookieName)?.value ?? null;
    if (!sessionId) {
      return {
        user: null,
        session: null,
      };
    }

    const result = await lucia.validateSession(sessionId);
    // next.js throws when you attempt to set cookie when rendering page
    try {
      if (result.session && result.session.fresh) {
        const sessionCookie = lucia.createSessionCookie(result.session.id);
        cookies().set(
          sessionCookie.name,
          sessionCookie.value,
          sessionCookie.attributes,
        );
      }
      if (!result.session) {
        const sessionCookie = lucia.createBlankSessionCookie();
        cookies().set(
          sessionCookie.name,
          sessionCookie.value,
          sessionCookie.attributes,
        );
      }
    } catch {}
    return result;
  },
);

export async function generateEmailVerificationCode(
  userId: string,
  email: string,
): Promise<string> {
  await db
    .deleteFrom("emailVerification")
    .where("emailVerification.userId", "=", userId)
    .execute();

  const code = generateRandomString(6, alphabet("0-9"));

  await db
    .insertInto("emailVerification")
    .values({
      userId: userId,
      email: email,
      code: code,
      expiresAt: createDate(new TimeSpan(5, "m")),
    })
    .execute();

  return code;
}

export async function verifyVerificationCode(
  user: User,
  code: string,
): Promise<boolean> {
  return await db.transaction().execute(async (tx) => {
    const databaseCode = await db
      .selectFrom("emailVerification")
      .selectAll()
      .where("userId", "=", user.id)
      .executeTakeFirst();

    if (!databaseCode || databaseCode.code != code) return false;

    await db
      .deleteFrom("emailVerification")
      .where("id", "=", databaseCode.id)
      .execute();

    if (!isWithinExpirationDate(databaseCode.expiresAt)) return false;
    if (databaseCode.email != user.email) return false;

    return true;
  });
}

declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: {
      email: string;
    };
  }
}
