import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

export { render } from "@react-email/render";

export { default as OTPEmail } from "../emails/otp-code";
export { default as ChangeEmailTemplate } from "../emails/change-email";
export { default as DeleteAccountTemplate } from "../emails/delete-account";
export { default as NewProposalEmailTemplate } from "../emails/new-proposal";
export { default as NewDiscussionEmailTemplate } from "../emails/new-discussion";
export { default as EndingProposalEmailTemplate } from "../emails/ending-proposal";
