import { describe, expect, it, vi } from 'vitest';
import {
  deliverNotification,
  deliverNotificationToRecipients,
} from './notification-delivery';

describe('deliverNotification', () => {
  it('records the notification after a successful send', async () => {
    const sendEmail = vi.fn(async () => undefined);
    const recordNotification = vi.fn(async () => undefined);

    await deliverNotification(
      {
        sendEmail,
        recordNotification,
      },
      {
        userId: 'user-1',
        targetId: 'proposal-1',
        type: 'new_proposal',
        daoId: 'dao-1',
        to: 'user@example.com',
        subject: 'New proposal',
        html: '<p>Hello</p>',
        idempotencyKey: 'user-1-proposal-1-new_proposal',
      }
    );

    expect(sendEmail).toHaveBeenCalledWith(
      'user@example.com',
      'New proposal',
      '<p>Hello</p>',
      'user-1-proposal-1-new_proposal'
    );
    expect(recordNotification).toHaveBeenCalledWith(
      'user-1',
      'proposal-1',
      'new_proposal',
      'dao-1'
    );
  });

  it('does not record the notification when sending fails', async () => {
    const sendEmail = vi.fn(async () => {
      throw new Error('smtp timeout');
    });
    const recordNotification = vi.fn(async () => undefined);

    await expect(
      deliverNotification(
        {
          sendEmail,
          recordNotification,
        },
        {
          userId: 'user-1',
          targetId: 'proposal-1',
          type: 'new_proposal',
          daoId: 'dao-1',
          to: 'user@example.com',
          subject: 'New proposal',
          html: '<p>Hello</p>',
          idempotencyKey: 'user-1-proposal-1-new_proposal',
        }
      )
    ).rejects.toThrow('smtp timeout');

    expect(recordNotification).not.toHaveBeenCalled();
  });

  it('reports persistence failures after a successful send', async () => {
    const sendEmail = vi.fn(async () => undefined);
    const recordNotification = vi.fn(async () => {
      throw new Error('database unavailable');
    });

    await expect(
      deliverNotification(
        { sendEmail, recordNotification },
        {
          userId: 'user-1',
          targetId: 'proposal-1',
          type: 'new_proposal',
          daoId: 'dao-1',
          to: 'user@example.com',
          subject: 'New proposal',
          html: '<p>Hello</p>',
          idempotencyKey: 'user-1-proposal-1-new_proposal',
        }
      )
    ).rejects.toThrow('database unavailable');

    expect(sendEmail).toHaveBeenCalledOnce();
  });
});

describe('deliverNotificationToRecipients', () => {
  const notification = {
    recipients: [
      { id: 'user-1', email: 'one@example.com' },
      { id: 'user-2', email: 'two@example.com' },
    ],
    targetId: 'proposal-1',
    type: 'new_proposal' as const,
    daoId: 'dao-1',
    subject: 'New proposal',
    html: '<p>Hello</p>',
  };

  it('skips recipients already inside the cooldown window', async () => {
    const sendEmail = vi.fn(async () => undefined);
    const recordNotification = vi.fn(async () => undefined);

    await deliverNotificationToRecipients(
      {
        sendEmail,
        recordNotification,
        alreadySent: async (userId) => userId === 'user-1',
      },
      notification
    );

    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(
      'two@example.com',
      'New proposal',
      '<p>Hello</p>',
      'new_proposal/proposal-1/user-2'
    );
  });

  it('attempts every recipient before reporting aggregate failure', async () => {
    const sendEmail = vi.fn(async (to: string) => {
      if (to === 'one@example.com') throw new Error('provider failure');
    });
    const recordNotification = vi.fn(async () => undefined);

    await expect(
      deliverNotificationToRecipients(
        {
          sendEmail,
          recordNotification,
          alreadySent: async () => false,
        },
        notification
      )
    ).rejects.toThrow('One or more notification deliveries failed');

    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(recordNotification).toHaveBeenCalledOnce();
  });
});
