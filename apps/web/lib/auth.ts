import { db_pool } from '@proposalsapp/db-web';
import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { emailOTP } from 'better-auth/plugins';
import { OTPEmail, resend } from '@proposalsapp/emails';

export const auth = betterAuth({
  appName: 'proposals.app',
  database: db_pool,
  trustedOrigins: ['https://arbitrum.proposals.app'],
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      async sendVerificationOTP({ email, otp, type }) {
        const { data, error } = await resend.emails.send({
          from: 'proposals.app <onboarding@proposals.app>',
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
      sendChangeEmailVerification: async ({ user, newEmail, url, token }) => {
        console.log('sendChangeEmailVerification', {
          user,
          newEmail,
          url,
          token,
        });
        // Send change email verification
      },
    },
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url, token }) => {
        console.log('sendDeleteAccountVerification', { user, url, token });
        // Send delete account verification
      },
      beforeDelete: async (user) => {
        // Perform actions before user deletion
      },
      afterDelete: async (user) => {
        // Perform cleanup after user deletion
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
