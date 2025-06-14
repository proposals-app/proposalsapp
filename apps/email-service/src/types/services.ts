import type {
  NewProposalEmailProps,
  NewDiscussionEmailProps,
  EndingProposalEmailProps,
} from '@proposalsapp/emails';

export interface IEmailService {
  sendNewProposalEmail(to: string, props: NewProposalEmailProps, idempotencyKey?: string): Promise<void>;

  sendNewDiscussionEmail(
    to: string,
    props: NewDiscussionEmailProps,
    idempotencyKey?: string
  ): Promise<void>;

  sendEndingProposalEmail(
    to: string,
    props: EndingProposalEmailProps,
    idempotencyKey?: string
  ): Promise<void>;
}

export interface IEmailClient {
  send(params: {
    from: string;
    to: string;
    subject: string;
    html: string;
    idempotencyKey?: string;
  }): Promise<void>;
}
