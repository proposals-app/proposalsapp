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
    type: string,
    daoId: string
  ) => Promise<void>;
}

export interface NotificationDeliveryInput {
  userId: string;
  targetId: string;
  type: string;
  daoId: string;
  to: string;
  subject: string;
  html: string;
  idempotencyKey?: string;
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
