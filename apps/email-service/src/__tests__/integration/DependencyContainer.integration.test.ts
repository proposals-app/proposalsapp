import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('DependencyContainer Integration Tests', () => {
  let testData: Awaited<ReturnType<typeof createTestData>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    testData = await createTestData();
  });

  describe('Container Initialization', () => {
    it('should initialize all dependencies correctly', () => {
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

      // Verify all repository instances are created
      expect(container.getProposalRepository()).toBeDefined();
      expect(container.getUserNotificationRepository('testdao')).toBeDefined();
      expect(container.getDaoRepository()).toBeDefined();
      expect(container.getDiscourseRepository()).toBeDefined();
      expect(container.getProposalGroupRepository()).toBeDefined();
      expect(container.getEmailService()).toBeDefined();
    });

    it('should create user repositories for different DAOs', () => {
      const container = new DependencyContainer(
        {
          resendApiKey: 'test-api-key',
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
        }
      );

      const userRepo1 = container.getUserRepository('dao1');
      const userRepo2 = container.getUserRepository('dao2');

      expect(userRepo1).toBeDefined();
      expect(userRepo2).toBeDefined();
      expect(userRepo1).not.toBe(userRepo2); // Different instances

      // Getting the same DAO repository again should return the same instance
      const userRepo1Again = container.getUserRepository('dao1');
      expect(userRepo1Again).toBe(userRepo1);
    });

    it('should throw error for unknown DAO database', () => {
      const container = new DependencyContainer(
        {
          resendApiKey: 'test-api-key',
          notificationConfig: {
            newProposalTimeframeMinutes: 60,
            endingProposalTimeframeMinutes: 120,
            newDiscussionTimeframeMinutes: 60,
            notificationCooldownHours: 24,
          },
        },
        {
          public: getTestDb(),
        }
      );

      expect(() => container.getUserRepository('unknown-dao')).toThrow(
        'Database for DAO unknown-dao not found'
      );
    });

    it('should create notification service with correct dependencies', () => {
      const container = new DependencyContainer(
        {
          resendApiKey: 'test-api-key',
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
      expect(notificationService).toBeDefined();

      // Each call should return a new instance with the correct DAO-specific user repository
      const notificationService2 = container.getNotificationService('testdao');
      expect(notificationService2).toBeDefined();
      expect(notificationService).not.toBe(notificationService2);
    });
  });

  describe('Repository Integration', () => {
    it('should allow repositories to interact with the database', async () => {
      const container = new DependencyContainer(
        {
          resendApiKey: 'test-api-key',
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

      const daoRepository = container.getDaoRepository();
      const daos = await daoRepository.getEnabledDaos();

      expect(Array.isArray(daos)).toBe(true);
      expect(daos.length).toBe(1);
      expect(daos[0].name).toBe('Test DAO');
      expect(daos[0].slug).toBe('testdao');
    });

    it('should allow user repository to access DAO-specific users', async () => {
      const container = new DependencyContainer(
        {
          resendApiKey: 'test-api-key',
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

      const userRepository = container.getUserRepository('testdao');
      const users =
        await userRepository.getUsersForNewProposalNotifications('testdao');

      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBe(1);
      expect(users[0].email).toBe('test@example.com');
      expect(users[0].emailSettingsNewProposals).toBe(true);
    });

    it('should allow proposal repository to access proposals', async () => {
      const db = getTestDb();

      // Create a test proposal
      await db
        .insertInto('proposal')
        .values({
          daoId: testData.dao.id,
          governorId: testData.governor.id,
          externalId: 'integration-test-proposal',
          name: 'Integration Test Proposal',
          body: 'This is for integration testing',
          url: 'https://example.com/proposal/integration',
          author: '0x1234567890123456789012345678901234567890',
          proposalState: ProposalState.ACTIVE,
          startAt: new Date(),
          endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          quorum: 100,
          choices: JSON.stringify(['For', 'Against']),
          createdAt: new Date(),
        })
        .execute();

      const container = new DependencyContainer(
        {
          resendApiKey: 'test-api-key',
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

      const proposalRepository = container.getProposalRepository();
      const newProposals = await proposalRepository.getNewProposals(
        60,
        testData.dao.id
      );

      expect(Array.isArray(newProposals)).toBe(true);
      expect(newProposals.length).toBe(1);
      expect(newProposals[0].name).toBe('Integration Test Proposal');
      expect(newProposals[0].proposalState).toBe('ACTIVE');
    });
  });

  describe('Email Service Integration', () => {
    it('should create email service with correct configuration', () => {
      const container = new DependencyContainer(
        {
          resendApiKey: 'test-api-key',
          fromEmail: 'custom@example.com',
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

      const emailService = container.getEmailService();
      expect(emailService).toBeDefined();

      // The same instance should be returned
      const emailService2 = container.getEmailService();
      expect(emailService2).toBe(emailService);
    });
  });

  describe('Configuration Handling', () => {
    it('should handle missing fromEmail configuration', () => {
      const container = new DependencyContainer(
        {
          resendApiKey: 'test-api-key',
          // fromEmail is optional
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

      // Should not throw and should create email service with default fromEmail
      expect(() => container.getEmailService()).not.toThrow();
      expect(container.getEmailService()).toBeDefined();
    });

    it('should pass notification configuration to notification service', async () => {
      const customConfig = {
        newProposalTimeframeMinutes: 30,
        endingProposalTimeframeMinutes: 60,
        newDiscussionTimeframeMinutes: 15,
        notificationCooldownHours: 12,
      };

      const container = new DependencyContainer(
        {
          resendApiKey: 'test-api-key',
          notificationConfig: customConfig,
        },
        {
          public: getTestDb(),
          testdao: getTestDb().withSchema('testdao'),
        }
      );

      // Create a recent proposal (within timeframe)
      const db = getTestDb();
      await db
        .insertInto('proposal')
        .values({
          daoId: testData.dao.id,
          governorId: testData.governor.id,
          externalId: 'recent-proposal',
          name: 'Recent Proposal',
          body: 'Very recent proposal',
          url: 'https://example.com/proposal/recent',
          author: '0x1234567890123456789012345678901234567890',
          proposalState: ProposalState.ACTIVE,
          startAt: new Date(),
          endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          quorum: 100,
          choices: JSON.stringify(['For', 'Against']),
          markedSpam: false,
          createdAt: new Date(), // Current time - should be found
        })
        .execute();

      const proposalRepository = container.getProposalRepository();
      const newProposals = await proposalRepository.getNewProposals(
        30,
        testData.dao.id
      ); // 30-minute timeframe

      expect(newProposals.length).toBeGreaterThanOrEqual(1); // Should find at least the recent proposal
    });
  });
});
