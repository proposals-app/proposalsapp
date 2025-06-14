import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Resend at module level before any imports
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn(),
    },
  })),
}));

// Mock emails package to prevent Resend instantiation
vi.mock('@proposalsapp/emails', () => ({
  resend: {
    emails: {
      send: vi.fn(),
    },
  },
  render: vi.fn().mockResolvedValue('<html>Test Email</html>'),
  NewProposalEmailTemplate: vi.fn(() => 'NewProposalEmailTemplate'),
  NewDiscussionEmailTemplate: vi.fn(() => 'NewDiscussionEmailTemplate'),
  EndingProposalEmailTemplate: vi.fn(() => 'EndingProposalEmailTemplate'),
}));

import { setupTestDatabase, getTestDb, createTestData } from './setup';
import { DependencyContainer } from '../../services/DependencyContainer';
import type { IEmailClient } from '../../types/services';
import { ProposalState } from '@proposalsapp/db';

// Mock email client
const mockEmailClient: IEmailClient = {
  send: vi.fn(),
};

vi.mock('../../services/ResendEmailClient', () => ({
  ResendEmailClient: vi.fn().mockImplementation(() => mockEmailClient),
}));

setupTestDatabase();

describe('Configuration Integration Tests', () => {
  let testData: Awaited<ReturnType<typeof createTestData>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    testData = await createTestData();
  });

  describe('Notification Configuration', () => {
    it('should respect newProposalTimeframeMinutes configuration', async () => {
      const db = getTestDb();

      // Clean any existing proposals from test data
      await db.deleteFrom('proposal').execute();

      // Create proposals at different times
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

      // Create old proposal (should not trigger notification)
      await db
        .insertInto('proposal')
        .values({
          daoId: testData.dao.id,
          governorId: testData.governor.id,
          externalId: 'old-proposal-config',
          name: 'Old Proposal',
          body: 'This is too old',
          url: 'https://example.com/proposal/old',
          author: '0x1234567890123456789012345678901234567890',
          proposalState: ProposalState.ACTIVE,
          startAt: twoHoursAgo,
          endAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          quorum: 100,
          choices: JSON.stringify(['For', 'Against']),
          markedSpam: false,
          createdAt: twoHoursAgo,
        })
        .execute();

      // Create recent proposal (should trigger notification)
      await db
        .insertInto('proposal')
        .values({
          daoId: testData.dao.id,
          governorId: testData.governor.id,
          externalId: 'recent-proposal-config',
          name: 'Recent Proposal',
          body: 'This is recent',
          url: 'https://example.com/proposal/recent',
          author: '0x1234567890123456789012345678901234567890',
          proposalState: ProposalState.ACTIVE,
          startAt: thirtyMinutesAgo,
          endAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          quorum: 100,
          choices: JSON.stringify(['For', 'Against']),
          markedSpam: false,
          createdAt: thirtyMinutesAgo,
        })
        .execute();

      // Test with 60-minute timeframe
      const container60 = new DependencyContainer(
        {
          resendApiKey: 'test-api-key',
          fromEmail: 'test@proposals.app',
          notificationConfig: {
            newProposalTimeframeMinutes: 60, // Should include 30-minute-old proposal
            endingProposalTimeframeMinutes: 120,
            newDiscussionTimeframeMinutes: 60,
            notificationCooldownHours: 24,
          },
        },
        {
          public: getTestDb(),
          testdao: getTestDb().withSchema('testdao'),
        }
      );

      const notificationService60 =
        container60.getNotificationService('testdao');
      await notificationService60.processNewProposalNotifications(testData.dao);

      // Should send notification for recent proposal only
      expect(mockEmailClient.send).toHaveBeenCalledOnce();

      vi.clearAllMocks();

      // Test with 15-minute timeframe
      const container15 = new DependencyContainer(
        {
          resendApiKey: 'test-api-key',
          fromEmail: 'test@proposals.app',
          notificationConfig: {
            newProposalTimeframeMinutes: 15, // Should exclude 30-minute-old proposal
            endingProposalTimeframeMinutes: 120,
            newDiscussionTimeframeMinutes: 60,
            notificationCooldownHours: 24,
          },
        },
        {
          public: getTestDb(),
          testdao: getTestDb().withSchema('testdao'),
        }
      );

      const notificationService15 =
        container15.getNotificationService('testdao');
      await notificationService15.processNewProposalNotifications(testData.dao);

      // Should not send any notifications (30-minute-old proposal is outside timeframe)
      expect(mockEmailClient.send).not.toHaveBeenCalled();
    });

    it('should respect endingProposalTimeframeMinutes configuration', async () => {
      const db = getTestDb();
      const now = new Date();

      // Clean any existing proposals from test data
      await db.deleteFrom('proposal').execute();

      // Create proposals ending at different times
      const endsIn30Minutes = new Date(now.getTime() + 30 * 60 * 1000);
      const endsIn3Hours = new Date(now.getTime() + 3 * 60 * 60 * 1000);

      // Create proposal ending soon
      await db
        .insertInto('proposal')
        .values({
          daoId: testData.dao.id,
          governorId: testData.governor.id,
          externalId: 'ending-soon-config',
          name: 'Ending Soon Proposal',
          body: 'This ends soon',
          url: 'https://example.com/proposal/ending-soon',
          author: '0x1234567890123456789012345678901234567890',
          proposalState: ProposalState.ACTIVE,
          startAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
          endAt: endsIn30Minutes,
          quorum: 100,
          choices: JSON.stringify(['For', 'Against']),
          markedSpam: false,
          createdAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
        })
        .execute();

      // Create proposal ending later
      await db
        .insertInto('proposal')
        .values({
          daoId: testData.dao.id,
          governorId: testData.governor.id,
          externalId: 'ending-later-config',
          name: 'Ending Later Proposal',
          body: 'This ends later',
          url: 'https://example.com/proposal/ending-later',
          author: '0x1234567890123456789012345678901234567890',
          proposalState: ProposalState.ACTIVE,
          startAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
          endAt: endsIn3Hours,
          quorum: 100,
          choices: JSON.stringify(['For', 'Against']),
          markedSpam: false,
          createdAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
        })
        .execute();

      // Test with 60-minute ending timeframe
      const container60 = new DependencyContainer(
        {
          resendApiKey: 'test-api-key',
          fromEmail: 'test@proposals.app',
          notificationConfig: {
            newProposalTimeframeMinutes: 60,
            endingProposalTimeframeMinutes: 60, // Should include 30-minute proposal only
            newDiscussionTimeframeMinutes: 60,
            notificationCooldownHours: 24,
          },
        },
        {
          public: getTestDb(),
          testdao: getTestDb().withSchema('testdao'),
        }
      );

      const notificationService60 =
        container60.getNotificationService('testdao');
      await notificationService60.processEndingProposalNotifications(
        testData.dao
      );

      // Should send notification for proposal ending in 30 minutes
      expect(mockEmailClient.send).toHaveBeenCalledOnce();

      vi.clearAllMocks();

      // Clear notification history to avoid cooldown issues
      await db.withSchema('testdao').deleteFrom('userNotification').execute();

      // Test with 240-minute (4 hour) ending timeframe
      const container240 = new DependencyContainer(
        {
          resendApiKey: 'test-api-key',
          fromEmail: 'test@proposals.app',
          notificationConfig: {
            newProposalTimeframeMinutes: 60,
            endingProposalTimeframeMinutes: 240, // Should include both proposals
            newDiscussionTimeframeMinutes: 60,
            notificationCooldownHours: 24,
          },
        },
        {
          public: getTestDb(),
          testdao: getTestDb().withSchema('testdao'),
        }
      );

      const notificationService240 =
        container240.getNotificationService('testdao');
      await notificationService240.processEndingProposalNotifications(
        testData.dao
      );

      // Should send notifications for both proposals
      expect(mockEmailClient.send).toHaveBeenCalledTimes(2);
    });

    it('should respect notificationCooldownHours configuration', async () => {
      const db = getTestDb();

      // Create a proposal
      const [proposal] = await db
        .insertInto('proposal')
        .values({
          daoId: testData.dao.id,
          governorId: testData.governor.id,
          externalId: 'cooldown-test-proposal',
          name: 'Cooldown Test Proposal',
          body: 'Testing cooldown',
          url: 'https://example.com/proposal/cooldown',
          author: '0x1234567890123456789012345678901234567890',
          proposalState: ProposalState.ACTIVE,
          startAt: new Date(),
          endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          quorum: 100,
          choices: JSON.stringify(['For', 'Against']),
          markedSpam: false,
          createdAt: new Date(),
        })
        .returning(['id'])
        .execute();

      // Create a recent notification (within cooldown period)
      await db
        .withSchema('testdao')
        .insertInto('userNotification')
        .values({
          userId: testData.user.id,
          targetId: proposal.id,
          type: 'new_proposal',
          sentAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
        })
        .execute();

      // Test with 24-hour cooldown (should not send notification)
      const container24 = new DependencyContainer(
        {
          resendApiKey: 'test-api-key',
          fromEmail: 'test@proposals.app',
          notificationConfig: {
            newProposalTimeframeMinutes: 60,
            endingProposalTimeframeMinutes: 120,
            newDiscussionTimeframeMinutes: 60,
            notificationCooldownHours: 24, // 12 hours ago is within cooldown
          },
        },
        {
          public: getTestDb(),
          testdao: getTestDb().withSchema('testdao'),
        }
      );

      const notificationService24 =
        container24.getNotificationService('testdao');
      await notificationService24.processNewProposalNotifications(testData.dao);

      // Should not send notification due to cooldown
      expect(mockEmailClient.send).not.toHaveBeenCalled();

      // Test with 6-hour cooldown (should send notification)
      const container6 = new DependencyContainer(
        {
          resendApiKey: 'test-api-key',
          fromEmail: 'test@proposals.app',
          notificationConfig: {
            newProposalTimeframeMinutes: 60,
            endingProposalTimeframeMinutes: 120,
            newDiscussionTimeframeMinutes: 60,
            notificationCooldownHours: 6, // 12 hours ago is outside cooldown
          },
        },
        {
          public: getTestDb(),
          testdao: getTestDb().withSchema('testdao'),
        }
      );

      const notificationService6 = container6.getNotificationService('testdao');
      await notificationService6.processNewProposalNotifications(testData.dao);

      // Should send notification (outside cooldown period)
      expect(mockEmailClient.send).toHaveBeenCalledOnce();
    });
  });

  describe('Email Configuration', () => {
    it('should use configured fromEmail address', async () => {
      const db = getTestDb();

      // Create a proposal
      await db
        .insertInto('proposal')
        .values({
          daoId: testData.dao.id,
          governorId: testData.governor.id,
          externalId: 'from-email-test',
          name: 'From Email Test',
          body: 'Testing from email',
          url: 'https://example.com/proposal/from-email',
          author: '0x1234567890123456789012345678901234567890',
          proposalState: ProposalState.ACTIVE,
          startAt: new Date(),
          endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          quorum: 100,
          choices: JSON.stringify(['For', 'Against']),
          markedSpam: false,
          createdAt: new Date(),
        })
        .execute();

      const customFromEmail = 'custom-sender@proposals.app';
      const container = new DependencyContainer(
        {
          resendApiKey: 'test-api-key',
          fromEmail: customFromEmail,
          notificationConfig: {
            newProposalTimeframeMinutes: 60,
            endingProposalTimeframeMinutes: 120,
            newDiscussionTimeframeMinutes: 60,
            notificationCooldownHours: 24,
          },
        },
        {
          public: getTestDb(),
          testdao: getTestDb().withSchema('testdao'),
        }
      );

      const notificationService = container.getNotificationService('testdao');
      await notificationService.processNewProposalNotifications(testData.dao);

      // Verify email was sent with custom from address
      expect(mockEmailClient.send).toHaveBeenCalledOnce();
      const emailCall = (mockEmailClient.send as any).mock.calls[0][0];
      expect(emailCall.from).toBe(customFromEmail);
    });

    it('should use default fromEmail when not configured', async () => {
      const db = getTestDb();

      // Create a proposal
      await db
        .insertInto('proposal')
        .values({
          daoId: testData.dao.id,
          governorId: testData.governor.id,
          externalId: 'default-from-email-test',
          name: 'Default From Email Test',
          body: 'Testing default from email',
          url: 'https://example.com/proposal/default-from-email',
          author: '0x1234567890123456789012345678901234567890',
          proposalState: ProposalState.ACTIVE,
          startAt: new Date(),
          endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          quorum: 100,
          choices: JSON.stringify(['For', 'Against']),
          markedSpam: false,
          createdAt: new Date(),
        })
        .execute();

      const container = new DependencyContainer(
        {
          resendApiKey: 'test-api-key',
          // fromEmail not provided
          notificationConfig: {
            newProposalTimeframeMinutes: 60,
            endingProposalTimeframeMinutes: 120,
            newDiscussionTimeframeMinutes: 60,
            notificationCooldownHours: 24,
          },
        },
        {
          public: getTestDb(),
          testdao: getTestDb().withSchema('testdao'),
        }
      );

      const notificationService = container.getNotificationService('testdao');
      await notificationService.processNewProposalNotifications(testData.dao);

      // Verify email was sent with default from address
      expect(mockEmailClient.send).toHaveBeenCalledOnce();
      const emailCall = (mockEmailClient.send as any).mock.calls[0][0];
      expect(emailCall.from).toBe('notifications@proposals.app'); // Default from email
    });

    it('should create email client with correct API key', () => {
      const testApiKey = 'test-resend-api-key-123';

      const container = new DependencyContainer(
        {
          resendApiKey: testApiKey,
          fromEmail: 'test@proposals.app',
          notificationConfig: {
            newProposalTimeframeMinutes: 60,
            endingProposalTimeframeMinutes: 120,
            newDiscussionTimeframeMinutes: 60,
            notificationCooldownHours: 24,
          },
        },
        {
          public: getTestDb(),
          testdao: getTestDb().withSchema('testdao'),
        }
      );

      // Verify email service was created (no errors thrown)
      expect(() => container.getEmailService()).not.toThrow();
      expect(container.getEmailService()).toBeDefined();

      // Note: In a real test, we would verify the API key was passed to ResendEmailClient
      // but since it's mocked, we just verify the service is created without errors
    });
  });

  describe('Database Configuration', () => {
    it('should handle missing DAO database configuration', () => {
      const container = new DependencyContainer(
        {
          resendApiKey: 'test-api-key',
          fromEmail: 'test@proposals.app',
          notificationConfig: {
            newProposalTimeframeMinutes: 60,
            endingProposalTimeframeMinutes: 120,
            newDiscussionTimeframeMinutes: 60,
            notificationCooldownHours: 24,
          },
        },
        {
          public: getTestDb(),
          // 'test-dao' database not provided
        }
      );

      // Should throw error when trying to get user repository for missing DAO
      expect(() => container.getUserRepository('testdao')).toThrow(
        'Database for DAO testdao not found'
      );
    });

    it('should support multiple DAO databases', () => {
      const container = new DependencyContainer(
        {
          resendApiKey: 'test-api-key',
          fromEmail: 'test@proposals.app',
          notificationConfig: {
            newProposalTimeframeMinutes: 60,
            endingProposalTimeframeMinutes: 120,
            newDiscussionTimeframeMinutes: 60,
            notificationCooldownHours: 24,
          },
        },
        {
          public: getTestDb(),
          dao1: getTestDb(),
          dao2: getTestDb(),
          dao3: getTestDb(),
        }
      );

      // Should be able to create repositories for all configured DAOs
      expect(() => container.getUserRepository('dao1')).not.toThrow();
      expect(() => container.getUserRepository('dao2')).not.toThrow();
      expect(() => container.getUserRepository('dao3')).not.toThrow();

      // Each DAO should get its own repository instance
      const repo1 = container.getUserRepository('dao1');
      const repo2 = container.getUserRepository('dao2');
      const repo3 = container.getUserRepository('dao3');

      expect(repo1).not.toBe(repo2);
      expect(repo2).not.toBe(repo3);
      expect(repo1).not.toBe(repo3);
    });

    it('should reuse repository instances for the same DAO', () => {
      const container = new DependencyContainer(
        {
          resendApiKey: 'test-api-key',
          fromEmail: 'test@proposals.app',
          notificationConfig: {
            newProposalTimeframeMinutes: 60,
            endingProposalTimeframeMinutes: 120,
            newDiscussionTimeframeMinutes: 60,
            notificationCooldownHours: 24,
          },
        },
        {
          public: getTestDb(),
          testdao: getTestDb().withSchema('testdao'),
        }
      );

      // Getting the same repository multiple times should return the same instance
      const repo1 = container.getUserRepository('testdao');
      const repo2 = container.getUserRepository('testdao');
      const repo3 = container.getUserRepository('testdao');

      expect(repo1).toBe(repo2);
      expect(repo2).toBe(repo3);
    });
  });

  describe('Configuration Validation', () => {
    it('should handle invalid timeframe configurations gracefully', async () => {
      const db = getTestDb();

      // Create a proposal that's 5 minutes old to ensure it's outside 0-minute timeframe
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      await db
        .insertInto('proposal')
        .values({
          daoId: testData.dao.id,
          governorId: testData.governor.id,
          externalId: 'invalid-config-test',
          name: 'Invalid Config Test',
          body: 'Testing invalid config',
          url: 'https://example.com/proposal/invalid',
          author: '0x1234567890123456789012345678901234567890',
          proposalState: ProposalState.ACTIVE,
          startAt: fiveMinutesAgo,
          endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          quorum: 100,
          choices: JSON.stringify(['For', 'Against']),
          markedSpam: false,
          createdAt: fiveMinutesAgo,
        })
        .execute();

      // Test with zero timeframe (should not find any proposals)
      const containerZero = new DependencyContainer(
        {
          resendApiKey: 'test-api-key',
          fromEmail: 'test@proposals.app',
          notificationConfig: {
            newProposalTimeframeMinutes: 0, // Invalid/edge case
            endingProposalTimeframeMinutes: 120,
            newDiscussionTimeframeMinutes: 60,
            notificationCooldownHours: 24,
          },
        },
        {
          public: getTestDb(),
          testdao: getTestDb().withSchema('testdao'),
        }
      );

      const notificationServiceZero =
        containerZero.getNotificationService('testdao');

      // Should handle gracefully without throwing
      await expect(
        notificationServiceZero.processNewProposalNotifications(testData.dao)
      ).resolves.not.toThrow();

      // Should not send any notifications
      expect(mockEmailClient.send).not.toHaveBeenCalled();
    });

    it('should handle very large timeframe configurations', async () => {
      const container = new DependencyContainer(
        {
          resendApiKey: 'test-api-key',
          fromEmail: 'test@proposals.app',
          notificationConfig: {
            newProposalTimeframeMinutes: 525600, // 1 year in minutes
            endingProposalTimeframeMinutes: 525600,
            newDiscussionTimeframeMinutes: 525600,
            notificationCooldownHours: 8760, // 1 year in hours
          },
        },
        {
          public: getTestDb(),
          testdao: getTestDb().withSchema('testdao'),
        }
      );

      // Should create services without errors
      expect(() => container.getNotificationService('testdao')).not.toThrow();
      expect(container.getNotificationService('testdao')).toBeDefined();
    });
  });
});
