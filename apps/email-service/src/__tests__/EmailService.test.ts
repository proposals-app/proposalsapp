import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailService } from '../services/EmailService';
import type { IEmailClient } from '../types/services';

// Mock the email templates and render function
vi.mock('@react-email/render', () => ({
  render: vi.fn().mockResolvedValue('<html>Mocked email content</html>'),
}));

vi.mock('@proposalsapp/emails', () => ({
  NewProposalEmailTemplate: vi.fn((props) => ({ props })),
  NewDiscussionEmailTemplate: vi.fn((props) => ({ props })),
  EndingProposalEmailTemplate: vi.fn((props) => ({ props })),
}));

// Mock email client
const mockEmailClient: IEmailClient = {
  send: vi.fn(),
};

describe('EmailService', () => {
  let emailService: EmailService;

  beforeEach(() => {
    vi.clearAllMocks();
    emailService = new EmailService(mockEmailClient);
  });

  describe('sendNewProposalEmail', () => {
    it('should send a new proposal email with correct parameters', async () => {
      const props = {
        proposalName: 'Test Proposal',
        proposalUrl: 'https://example.com/proposal/123',
        daoName: 'Test DAO',
        authorAddress: '0x1234567890123456789012345678901234567890',
        authorEns: 'test.eth',
      };

      await emailService.sendNewProposalEmail('user@example.com', props);

      expect(mockEmailClient.send).toHaveBeenCalledOnce();
      const callArgs = (mockEmailClient.send as any).mock.calls[0][0];

      expect(callArgs.to).toBe('user@example.com');
      expect(callArgs.subject).toBe('New proposal in Test DAO');
      expect(callArgs.from).toBe('notifications@proposals.app');
      expect(callArgs.html).toBeDefined();
    });

    it('should use custom from email when provided', async () => {
      const customEmailService = new EmailService(
        mockEmailClient,
        'custom@example.com'
      );

      await customEmailService.sendNewProposalEmail('user@example.com', {
        proposalName: 'Test Proposal',
        proposalUrl: 'https://example.com/proposal/123',
        daoName: 'Test DAO',
        authorAddress: '0x1234567890123456789012345678901234567890',
      });

      const callArgs = (mockEmailClient.send as any).mock.calls[0][0];
      expect(callArgs.from).toBe('custom@example.com');
    });

    it('should pass idempotency key when provided', async () => {
      const idempotencyKey = 'test-idempotency-key';

      await emailService.sendNewProposalEmail(
        'user@example.com',
        {
          proposalName: 'Test Proposal',
          proposalUrl: 'https://example.com/proposal/123',
          daoName: 'Test DAO',
          authorAddress: '0x1234567890123456789012345678901234567890',
        },
        idempotencyKey
      );

      const callArgs = (mockEmailClient.send as any).mock.calls[0][0];
      expect(callArgs.idempotencyKey).toBe(idempotencyKey);
    });

    it('should not include idempotency key when not provided', async () => {
      await emailService.sendNewProposalEmail('user@example.com', {
        proposalName: 'Test Proposal',
        proposalUrl: 'https://example.com/proposal/123',
        daoName: 'Test DAO',
        authorAddress: '0x1234567890123456789012345678901234567890',
      });

      const callArgs = (mockEmailClient.send as any).mock.calls[0][0];
      expect(callArgs.idempotencyKey).toBeUndefined();
    });
  });

  describe('sendNewDiscussionEmail', () => {
    it('should send a new discussion email with correct parameters', async () => {
      const props = {
        discussionTitle: 'Test Discussion',
        discussionUrl: 'https://example.com/discussion/123',
        daoName: 'Test DAO',
        authorUsername: 'testuser',
        authorProfilePicture: 'https://example.com/avatar.jpg',
      };

      await emailService.sendNewDiscussionEmail('user@example.com', props);

      expect(mockEmailClient.send).toHaveBeenCalledOnce();
      const callArgs = (mockEmailClient.send as any).mock.calls[0][0];

      expect(callArgs.to).toBe('user@example.com');
      expect(callArgs.subject).toBe('New discussion in Test DAO');
      expect(callArgs.html).toBeDefined();
    });

    it('should pass idempotency key when provided', async () => {
      const idempotencyKey = 'test-discussion-idempotency-key';

      await emailService.sendNewDiscussionEmail(
        'user@example.com',
        {
          discussionTitle: 'Test Discussion',
          discussionUrl: 'https://example.com/discussion/123',
          daoName: 'Test DAO',
          authorUsername: 'testuser',
          authorProfilePicture: 'https://example.com/avatar.jpg',
        },
        idempotencyKey
      );

      const callArgs = (mockEmailClient.send as any).mock.calls[0][0];
      expect(callArgs.idempotencyKey).toBe(idempotencyKey);
    });
  });

  describe('sendEndingProposalEmail', () => {
    it('should send an ending proposal email with correct parameters', async () => {
      const props = {
        proposalName: 'Test Proposal',
        proposalUrl: 'https://example.com/proposal/123',
        daoName: 'Test DAO',
        endTime: '2 hours',
      };

      await emailService.sendEndingProposalEmail('user@example.com', props);

      expect(mockEmailClient.send).toHaveBeenCalledOnce();
      const callArgs = (mockEmailClient.send as any).mock.calls[0][0];

      expect(callArgs.to).toBe('user@example.com');
      expect(callArgs.subject).toBe('Proposal ending soon in Test DAO');
      expect(callArgs.html).toBeDefined();
    });

    it('should pass idempotency key when provided', async () => {
      const idempotencyKey = 'test-ending-idempotency-key';

      await emailService.sendEndingProposalEmail(
        'user@example.com',
        {
          proposalName: 'Test Proposal',
          proposalUrl: 'https://example.com/proposal/123',
          daoName: 'Test DAO',
          endTime: '2 hours',
        },
        idempotencyKey
      );

      const callArgs = (mockEmailClient.send as any).mock.calls[0][0];
      expect(callArgs.idempotencyKey).toBe(idempotencyKey);
    });
  });

  describe('error handling', () => {
    it('should propagate errors from email client', async () => {
      const error = new Error('Email sending failed');
      (mockEmailClient.send as any).mockRejectedValue(error);

      await expect(
        emailService.sendNewProposalEmail('user@example.com', {
          proposalName: 'Test Proposal',
          proposalUrl: 'https://example.com/proposal/123',
          daoName: 'Test DAO',
          authorAddress: '0x1234567890123456789012345678901234567890',
        })
      ).rejects.toThrow('Email sending failed');
    });
  });
});
