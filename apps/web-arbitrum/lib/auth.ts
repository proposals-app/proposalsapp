import { NodePostgresAdapter } from '@lucia-auth/adapter-postgresql';
import { db, db_pool } from '@proposalsapp/db';
import { Lucia, type Session, type User } from 'lucia';
import { cookies } from 'next/headers';
import { TimeSpan, createDate, isWithinExpirationDate } from 'oslo';
import { alphabet, generateRandomString } from 'oslo/crypto';
import { cache } from 'react';
import { otel } from './otel';

const adapter = new NodePostgresAdapter(db_pool, {
  user: 'user',
  session: 'user_session',
});

export const lucia = new Lucia(adapter, {
  sessionExpiresIn: new TimeSpan(2, 'w'),
  sessionCookie: {
    attributes: {
      secure: process.env.NODE_ENV! === 'production',
    },
  },
  getUserAttributes: (attributes) => {
    return {
      email: attributes.email,
      emailVerified: attributes.email_verified,
    };
  },
});

export const validateRequest = cache(
  async (): Promise<
    { user: User; session: Session } | { user: null; session: null }
  > => {
    return otel('auth-validate-request', async () => {
      const sessionId =
        (await cookies()).get(lucia.sessionCookieName)?.value ?? null;
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
          (await cookies()).set(
            sessionCookie.name,
            sessionCookie.value,
            sessionCookie.attributes
          );
        }
        if (!result.session) {
          const sessionCookie = lucia.createBlankSessionCookie();
          (await cookies()).set(
            sessionCookie.name,
            sessionCookie.value,
            sessionCookie.attributes
          );
        }
      } catch (error) {
        // Log the error using the otel function
        await otel('auth-validate-request-error', async () => {
          console.error('Error setting session cookie:', error);
        });
      }
      return result;
    });
  }
);

export async function generateEmailVerificationCode(
  userId: string,
  email: string
): Promise<string> {
  return otel('auth-generate-email-code', async () => {
    await db
      .deleteFrom('emailVerification')
      .where('emailVerification.userId', '=', userId)
      .execute();

    const code = generateRandomString(6, alphabet('0-9'));

    await db
      .insertInto('emailVerification')
      .values({
        userId: userId,
        email: email,
        code: code,
        expiresAt: createDate(new TimeSpan(15, 'm')), // Increase expiration time to 15 minutes
      })
      .execute();

    return code;
  });
}

export async function verifyVerificationCode(
  user: User,
  code: string
): Promise<boolean> {
  return otel('auth-verify-code', async () => {
    const databaseCode = await db
      .selectFrom('emailVerification')
      .selectAll()
      .where('userId', '=', user.id)
      .executeTakeFirst();

    if (!databaseCode || databaseCode.code !== code) return false;

    await db
      .deleteFrom('emailVerification')
      .where('id', '=', databaseCode.id)
      .execute();

    if (!isWithinExpirationDate(databaseCode.expiresAt)) return false;
    if (databaseCode.email !== user.email) return false;

    return true;
  });
}

declare module 'lucia' {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: {
      email: string;
      email_verified: boolean;
    };
  }
}
