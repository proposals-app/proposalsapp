import { render } from '@react-email/render';
import {
  NewProposalEmailTemplate,
  NewDiscussionEmailTemplate,
  EndingProposalEmailTemplate,
  type NewProposalEmailProps,
  type NewDiscussionEmailProps,
  type EndingProposalEmailProps,
} from '@proposalsapp/emails';
import type { IEmailService, IEmailClient } from '../types/services';

export class EmailService implements IEmailService {
  private readonly fromEmail: string;

  constructor(
    private emailClient: IEmailClient,
    fromEmail: string = 'notifications@proposals.app'
  ) {
    this.fromEmail = fromEmail;
  }

  async sendNewProposalEmail(
    to: string,
    props: NewProposalEmailProps,
    idempotencyKey?: string
  ): Promise<void> {
    const html = await render(NewProposalEmailTemplate(props));
    const subject = `New proposal in ${props.daoName}`;

    await this.emailClient.send({
      from: this.fromEmail,
      to,
      subject,
      html,
      idempotencyKey,
    });
  }

  async sendNewDiscussionEmail(
    to: string,
    props: NewDiscussionEmailProps,
    idempotencyKey?: string
  ): Promise<void> {
    const html = await render(NewDiscussionEmailTemplate(props));
    const subject = `New discussion in ${props.daoName}`;

    await this.emailClient.send({
      from: this.fromEmail,
      to,
      subject,
      html,
      idempotencyKey,
    });
  }

  async sendEndingProposalEmail(
    to: string,
    props: EndingProposalEmailProps,
    idempotencyKey?: string
  ): Promise<void> {
    const html = await render(EndingProposalEmailTemplate(props));
    const subject = `Proposal ending soon in ${props.daoName}`;

    await this.emailClient.send({
      from: this.fromEmail,
      to,
      subject,
      html,
      idempotencyKey,
    });
  }
}
