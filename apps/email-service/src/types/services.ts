import type {
  NewProposalEmailProps,
  NewDiscussionEmailProps,
  EndingProposalEmailProps,
} from '@proposalsapp/emails';

export interface IEmailService {
  sendNewProposalEmail(to: string, props: NewProposalEmailProps): Promise<void>;

  sendNewDiscussionEmail(
    to: string,
    props: NewDiscussionEmailProps
  ): Promise<void>;

  sendEndingProposalEmail(
    to: string,
    props: EndingProposalEmailProps
  ): Promise<void>;
}

export interface IEmailClient {
  send(params: {
    from: string;
    to: string;
    subject: string;
    html: string;
  }): Promise<void>;
}
