import { dbPool } from '@proposalsapp/db';
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
  database: dbPool,
  trustedOrigins: (() => {
    const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'proposals.app';
    const base = [
      `https://${root}`,
      `https://arbitrum.${root}`,
      `https://uniswap.${root}`,
    ];
    const dev = [
      'http://localhost:3000',
      'http://arbitrum.localhost:3000',
      'http://uniswap.localhost:3000',
    ];
    const extra = process.env.WEB_URL ? [process.env.WEB_URL] : [];
    return [...base, ...dev, ...extra];
  })(),
  secret: process.env.BETTER_AUTH_SECRET,

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
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    requireEmailVerification: false,
    sendChangeEmailVerification: async ({
      email,
      url,
    }: {
      email: string;
      url: string;
    }) => {
      const { error } = await resend.emails.send({
        from: 'proposals.app <noreply@proposals.app>',
        to: [email],
        subject: 'Verify your email change',
        react: ChangeEmailTemplate({
          currentEmail: email,
          newEmail: email, // This would need to be passed differently in production
          verificationUrl: url,
        }),
      });

      if (error) {
        console.log('Error sending change email verification:', error);
      }
    },
    sendDeleteAccountVerification: async ({
      email,
      url,
    }: {
      email: string;
      url: string;
    }) => {
      const { error } = await resend.emails.send({
        from: 'proposals.app <noreply@proposals.app>',
        to: [email],
        subject: 'Delete your account',
        react: DeleteAccountTemplate({
          email,
          verificationUrl: url,
        }),
      });

      if (error) {
        console.log('Error sending delete account verification:', error);
      }
    },
  },
});
