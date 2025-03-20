import { db_pool } from '@proposalsapp/db-web';
import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { emailOTP } from 'better-auth/plugins';
import {
  OTPEmail,
  ChangeEmailTemplate,
  DeleteAccountTemplate,
  resend,
} from '@proposalsapp/emails';

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
        nullable: false,
        defaultValue: true,
      },
      emailSettingsNewDiscussions: {
        type: 'boolean',
        nullable: false,
        defaultValue: true,
      },
      emailSettingsDailyRoundup: {
        type: 'boolean',
        nullable: false,
        defaultValue: true,
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
        // Perform actions before user deletion
        console.log(`Preparing to delete user account: ${user.email}`);
        // Here you would add cleanup tasks like:
        // - Removing user data from other services
        // - Canceling subscriptions
        // - Archiving user content
      },
      afterDelete: async (user) => {
        // Perform cleanup after user deletion
        console.log(`Successfully deleted user account: ${user.email}`);
        // Final cleanup operations that should happen after the account is deleted:
        // - Notify admins
        // - Update analytics
        // - Send final confirmation email to the user's email (optional)
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
