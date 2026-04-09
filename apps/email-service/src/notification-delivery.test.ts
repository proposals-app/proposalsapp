import { describe, expect, it, vi } from 'vitest';
import { deliverNotification } from './notification-delivery';

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
});
