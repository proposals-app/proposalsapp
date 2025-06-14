import { Resend } from 'resend';
import type { IEmailClient } from '../types/services';

export class ResendEmailClient implements IEmailClient {
  private resend: Resend;

  constructor(apiKey: string) {
    this.resend = new Resend(apiKey);
  }

  async send(params: {
    from: string;
    to: string;
    subject: string;
    html: string;
    idempotencyKey?: string;
  }): Promise<void> {
    const options = params.idempotencyKey
      ? { idempotencyKey: params.idempotencyKey }
      : undefined;

    await this.resend.emails.send(
      {
        from: params.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
      },
      options
    );
  }
}
