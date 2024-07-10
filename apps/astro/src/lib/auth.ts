import { type User } from "lucia";
import { TimeSpan, createDate, isWithinExpirationDate } from "oslo";
import { generateRandomString, alphabet } from "oslo/crypto";
import { Lucia } from "lucia";
import { db, db_pool } from "@proposalsapp/db";
import { NodePostgresAdapter } from "@lucia-auth/adapter-postgresql";
const adapter = new NodePostgresAdapter(db_pool, {
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
      email_verified: attributes.email_verified,
    };
  },
});

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
      email_verified: boolean;
    };
  }
}
