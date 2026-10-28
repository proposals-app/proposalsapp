export interface NotificationDeliveryDependencies {
  sendEmail: (
    to: string,
    subject: string,
    html: string,
    idempotencyKey?: string
  ) => Promise<void>;
  recordNotification: (
    userId: string,
    targetId: string,
    type: NotificationType,
    daoId: string
  ) => Promise<void>;
}

export interface NotificationDeliveryInput {
  userId: string;
  targetId: string;
  type: NotificationType;
  daoId: string;
  to: string;
  subject: string;
  html: string;
  idempotencyKey?: string;
}

export type NotificationType =
  'new_proposal' | 'ending_proposal' | 'new_discussion';

export interface NotificationRecipient {
  id: string;
  email: string;
}

export interface RecipientNotification {
  recipients: NotificationRecipient[];
  targetId: string;
  type: NotificationType;
  daoId: string;
  subject: string;
  html: string;
}

export interface RecipientDeliveryDependencies extends NotificationDeliveryDependencies {
  alreadySent: (
    userId: string,
    targetId: string,
    type: NotificationType,
    daoId: string
  ) => Promise<boolean>;
}

export async function deliverNotification(
  dependencies: NotificationDeliveryDependencies,
  input: NotificationDeliveryInput
): Promise<void> {
  await dependencies.sendEmail(
    input.to,
    input.subject,
    input.html,
    input.idempotencyKey
  );
  await dependencies.recordNotification(
    input.userId,
    input.targetId,
    input.type,
    input.daoId
  );
}

export async function deliverNotificationToRecipients(
  dependencies: RecipientDeliveryDependencies,
  notification: RecipientNotification
): Promise<void> {
  const results = await Promise.allSettled(
    notification.recipients.map(async (recipient) => {
      if (
        await dependencies.alreadySent(
          recipient.id,
          notification.targetId,
          notification.type,
          notification.daoId
        )
      ) {
        return;
      }

      await deliverNotification(dependencies, {
        userId: recipient.id,
        targetId: notification.targetId,
        type: notification.type,
        daoId: notification.daoId,
        to: recipient.email,
        subject: notification.subject,
        html: notification.html,
        idempotencyKey: `${notification.type}/${notification.targetId}/${recipient.id}`,
      });
    })
  );
  const failures = results.flatMap((result) =>
    result.status === 'rejected' ? [result.reason] : []
  );

  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      'One or more notification deliveries failed'
    );
  }
}
