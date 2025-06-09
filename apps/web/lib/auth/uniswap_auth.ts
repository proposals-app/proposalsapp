import { db, dbPool } from '@proposalsapp/db';
import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { emailOTP } from 'better-auth/plugins';
import {
  ChangeEmailTemplate,
  DeleteAccountTemplate,
  OTPEmail,
  resend,
} from '@proposalsapp/emails';

export const auth = betterAuth({
  appName: 'proposals.app',
  database: dbPool.uniswap,
  trustedOrigins: [`https://uniswap.proposals.app`],

  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      async sendVerificationOTP({ email, otp }) {
        const { error } = await resend.emails.send({
          from: 'proposals.app <noreply@proposals.app>',
          to: [email],
          subject: 'Welcome to proposals.app!',
          react: OTPEmail({ verificationCode: otp, email }),
        });

        if (error) {
          console.log('Error sending verification OTP:', error);
        }
      },
    }),
    nextCookies(),
  ],
  account: {
    fields: {
      accountId: 'account_id',
      providerId: 'provider_id',
      userId: 'user_id',
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      idToken: 'id_token',
      accessTokenExpiresAt: 'access_token_expires_at',
      refreshTokenExpiresAt: 'refresh_token_expires_at',
      scope: 'scope',
      password: 'password',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  session: {
    fields: {
      id: 'id',
      expiresAt: 'expires_at',
      token: 'token',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      ipAddress: 'ip_address',
      userAgent: 'user_agent',
      userId: 'user_id',
    },
  },
  verification: {
    fields: {
      id: 'id',
      identifier: 'identifier',
      value: 'value',
      token: 'token',
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  user: {
    fields: {
      id: 'id',
      name: 'name',
      email: 'email',
      emailVerified: 'email_verified',
      image: 'image',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    additionalFields: {
      email_settings_new_proposals: {
        type: 'boolean',
        required: true,
        defaultValue: true,
      },
      email_settings_new_discussions: {
        type: 'boolean',
        required: true,
        defaultValue: true,
      },
      email_settings_ending_proposals: {
        type: 'boolean',
        required: true,
        defaultValue: true,
      },
      is_onboarded: {
        type: 'boolean',
        required: true,
        defaultValue: false,
      },
    },
    changeEmail: {
      enabled: true,
      expiresIn: 3600,
      sendChangeEmailVerification: async ({ user, newEmail, url }) => {
        const { error } = await resend.emails.send({
          from: 'proposals.app <accounts@proposals.app>',
          to: [user.email],
          subject: 'Confirm Your Email Address Change',
          react: ChangeEmailTemplate({
            currentEmail: user.email,
            newEmail,
            verificationUrl: url,
          }),
        });

        if (error) {
          console.log('Error sending email change verification:', error);
        }
      },
    },
    deleteUser: {
      enabled: true,
      expiresIn: 3600,
      sendDeleteAccountVerification: async ({ user, url }) => {
        console.log(
          `Preparing to send account deletion verification email to ${user.email}`
        );
        const { error } = await resend.emails.send({
          from: 'proposals.app <accounts@proposals.app>',
          to: [user.email],
          subject: 'Confirm Your Account Deletion',
          react: DeleteAccountTemplate({
            email: user.email,
            verificationUrl: url,
          }),
        });

        if (error) {
          console.log('Error sending account deletion verification:', error);
        }
      },
      beforeDelete: async (user) => {
        console.log(`Preparing to delete user account: ${user.email}`);
      },
      afterDelete: async (user) => {
        console.log(`Successfully deleted user account: ${user.email}`);
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const allGroups = await db.public
            .selectFrom('proposalGroup')
            .selectAll()
            .execute();

          if (allGroups)
            await db.uniswap
              .insertInto('userProposalGroupLastRead')
              .values(
                allGroups.map((group) => ({
                  userId: user.id,
                  proposalGroupId: group.id,
                  lastReadAt: new Date(),
                }))
              )
              .execute();
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
