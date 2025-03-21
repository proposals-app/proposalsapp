import { db_pool, dbWeb } from '@proposalsapp/db-web';
import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { emailOTP } from 'better-auth/plugins';
import {
  OTPEmail,
  ChangeEmailTemplate,
  DeleteAccountTemplate,
  resend,
} from '@proposalsapp/emails';
import { dbIndexer } from '@proposalsapp/db-indexer';

export const auth = betterAuth({
  appName: 'proposals.app',
  database: db_pool,
  trustedOrigins: ['https://arbitrum.proposals.app'],

  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      async sendVerificationOTP({ email, otp }) {
        const { error } = await resend.emails.send({
          from: 'proposals.app <noreply@proposals.app>',
          to: [email],
          subject: 'Welcome to proposals.app!',
          react: OTPEmail({ verificationCode: otp }),
        });

        if (error) {
          console.log('Error sending verification OTP:', error);
        }
      },
    }),
    nextCookies(),
  ],
  user: {
    additionalFields: {
      emailSettingsNewProposals: {
        type: 'boolean',
        required: true,
        defaultValue: true,
      },
      emailSettingsNewDiscussions: {
        type: 'boolean',
        required: true,
        defaultValue: true,
      },
      emailSettingsDailyRoundup: {
        type: 'boolean',
        required: true,
        defaultValue: true,
      },
      isOnboarded: {
        type: 'boolean',
        required: true,
        defaultValue: false,
      },
    },
    changeEmail: {
      enabled: true,
      sendChangeEmailVerification: async ({ user, newEmail, url }) => {
        const { error } = await resend.emails.send({
          from: 'proposals.app <accounts@proposals.app>',
          to: [user.email],
          subject: 'Confirm Your Email Address Change',
          react: ChangeEmailTemplate({
            currentEmail: user.email,
            newEmail: newEmail,
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
          const allGroups = await dbIndexer
            .selectFrom('proposalGroup')
            .selectAll()
            .execute();

          if (allGroups)
            await dbWeb
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
