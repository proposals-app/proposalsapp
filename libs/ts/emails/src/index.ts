import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY);

export { render } from '@react-email/render';

export { default as OTPEmail } from '../emails/otp-code.tsx';
export { default as ChangeEmailTemplate } from '../emails/change-email.tsx';
export { default as DeleteAccountTemplate } from '../emails/delete-account.tsx';
export { default as NewProposalEmailTemplate } from '../emails/new-proposal.tsx';
export { default as NewDiscussionEmailTemplate } from '../emails/new-discussion.tsx';
export { default as EndingProposalEmailTemplate } from '../emails/ending-proposal.tsx';

// Export email template prop types
export type { NewProposalEmailProps } from '../emails/new-proposal.tsx';
export type { NewDiscussionEmailProps } from '../emails/new-discussion.tsx';
export type { EndingProposalEmailProps } from '../emails/ending-proposal.tsx';
