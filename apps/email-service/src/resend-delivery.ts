export interface ResendSendResult {
  data: { id: string } | null;
  error: { message?: string; name?: string } | null;
}

export function requireResendDelivery(result: ResendSendResult): string {
  if (result.error) {
    throw new Error(result.error.message || 'Resend rejected the email.', {
      cause: result.error,
    });
  }
  if (!result.data?.id) {
    throw new Error('Resend returned neither a delivery ID nor an error.');
  }

  return result.data.id;
}
