export interface EmailSendResult {
  error: unknown;
}

export function buildChangeEmailTemplateProps(newEmail: string): {
  newEmail: string;
} {
  return { newEmail };
}

export function ensureAuthEmailWasSent(
  result: EmailSendResult,
  emailPurpose: string
): void {
  if (!result.error) {
    return;
  }

  throw new Error(`Failed to send ${emailPurpose}.`);
}
