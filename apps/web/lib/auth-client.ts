import { createAuthClient } from 'better-auth/react';
import { emailOTPClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  appName: 'proposals.app',
  plugins: [emailOTPClient()],
});

export const { signIn, signOut, useSession, emailOtp } = authClient;
