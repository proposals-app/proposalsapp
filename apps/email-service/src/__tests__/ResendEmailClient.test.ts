import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResendEmailClient } from '../services/ResendEmailClient';

// Mock the Resend library
const mockEmailSend = vi.fn();

vi.mock('resend', () => {
  const mockResend = vi.fn().mockImplementation(() => ({
    emails: {
      send: mockEmailSend,
    },
  }));

  return {
    Resend: mockResend,
  };
});

describe('ResendEmailClient', () => {
  let resendEmailClient: ResendEmailClient;

  beforeEach(() => {
    vi.clearAllMocks();
    resendEmailClient = new ResendEmailClient('test-api-key');
  });

  describe('send', () => {
    it('should send email with correct parameters', async () => {
      mockEmailSend.mockResolvedValue({ id: 'email-id' });

      const emailParams = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<h1>Test HTML</h1>',
      };

      await resendEmailClient.send(emailParams);

      expect(mockEmailSend).toHaveBeenCalledOnce();
      expect(mockEmailSend).toHaveBeenCalledWith({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<h1>Test HTML</h1>',
      }, undefined);
    });

    it('should send email with idempotency key when provided', async () => {
      mockEmailSend.mockResolvedValue({ id: 'email-id' });

      const emailParams = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<h1>Test HTML</h1>',
        idempotencyKey: 'test-idempotency-key',
      };

      await resendEmailClient.send(emailParams);

      expect(mockEmailSend).toHaveBeenCalledOnce();
      expect(mockEmailSend).toHaveBeenCalledWith({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<h1>Test HTML</h1>',
      }, {
        idempotencyKey: 'test-idempotency-key',
      });
    });

    it('should propagate errors from Resend API', async () => {
      const error = new Error('Resend API error');
      mockEmailSend.mockRejectedValue(error);

      const emailParams = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<h1>Test HTML</h1>',
      };

      await expect(resendEmailClient.send(emailParams)).rejects.toThrow(
        'Resend API error'
      );
    });

    it('should handle API key correctly during initialization', () => {
      // Test that ResendEmailClient can be instantiated with an API key
      // The constructor calls new Resend(apiKey) internally
      expect(() => new ResendEmailClient('my-api-key')).not.toThrow();
    });
  });
});
