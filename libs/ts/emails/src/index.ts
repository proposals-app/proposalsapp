import { Resend } from 'resend';

// Lazy, safe Resend client that avoids requiring secrets at import-time.
// It returns an error object when RESEND_API_KEY is not set.
type SendResult = { data: unknown; error: unknown };

export const resend: {
  emails: { send: (args: any) => Promise<SendResult> };
} = {
  emails: {
    async send(args: any): Promise<SendResult> {
      const key = process.env.RESEND_API_KEY;
      if (!key) {
        return { data: null, error: new Error('RESEND_API_KEY is not set') };
      }
      const client = new Resend(key);
      // Delegate to the real client
      return (await client.emails.send(args)) as SendResult;
    },
  },
};

export { render } from '@react-email/render';

export { default as OTPEmail } from '../emails/otp-code';
export { default as ChangeEmailTemplate } from '../emails/change-email';
export { default as DeleteAccountTemplate } from '../emails/delete-account';
export { default as NewProposalEmailTemplate } from '../emails/new-proposal';
export { default as NewDiscussionEmailTemplate } from '../emails/new-discussion';
export { default as EndingProposalEmailTemplate } from '../emails/ending-proposal';

// Export email template prop types
export type { NewProposalEmailProps } from '../emails/new-proposal';
export type { NewDiscussionEmailProps } from '../emails/new-discussion';
export type { EndingProposalEmailProps } from '../emails/ending-proposal';
