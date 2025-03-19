import { db_pool } from '@proposalsapp/db-web';
import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { emailOTP } from 'better-auth/plugins';

export const auth = betterAuth({
  appName: 'proposals.app',
  database: db_pool,
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 600,
      async sendVerificationOTP({ email, otp, type }) {
        console.log('sendVerificationOTP', { email, otp, type });
        // Implement the sendVerificationOTP method to send the OTP to the user's email address
      },
    }),
    nextCookies(),
  ],
  user: {
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
