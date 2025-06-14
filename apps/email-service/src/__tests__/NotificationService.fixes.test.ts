import { describe, it, expect, vi } from 'vitest';
import {
  NotificationService,
  type NotificationConfig,
} from '../services/NotificationService';
import type {
  IProposalRepository,
  IUserNotificationRepository,
  IUserRepository,
  IDaoRepository,
  IDiscourseRepository,
  IProposalGroupRepository,
} from '../types/repositories';
import type { IEmailService } from '../types/services';
import { CircuitBreaker } from '../services/CircuitBreaker';

// Create mock repositories
const createMockRepositories = () => ({
  proposalRepository: {
    getNewProposals: vi.fn(),
    getEndingProposals: vi.fn(),
  } as IProposalRepository,
  userNotificationRepository: {
    getRecentNotifications: vi.fn(),
    createNotification: vi.fn(),
  } as IUserNotificationRepository,
  userRepository: {
    getUsersForNewProposalNotifications: vi.fn(),
    getUsersForNewDiscussionNotifications: vi.fn(),
    getUsersForEndingProposalNotifications: vi.fn(),
  } as IUserRepository,
  daoRepository: {
    getEnabledDaos: vi.fn(),
    getDaoBySlug: vi.fn(),
  } as IDaoRepository,
  discourseRepository: {
    getNewTopics: vi.fn(),
  } as IDiscourseRepository,
  proposalGroupRepository: {
    getProposalGroupsByDiscourseUrl: vi.fn(),
  } as IProposalGroupRepository,
  emailService: {
    sendNewProposalEmail: vi.fn(),
    sendNewDiscussionEmail: vi.fn(),
    sendEndingProposalEmail: vi.fn(),
  } as IEmailService,
});

const config: NotificationConfig = {
  newProposalTimeframeMinutes: 5,
  endingProposalTimeframeMinutes: 60,
  newDiscussionTimeframeMinutes: 5,
  notificationCooldownHours: 24,
};

describe('NotificationService - Bug Fixes', () => {
  describe('Discourse URL Fix', () => {
    it('should use discourseBaseUrl from daoDiscourse instead of hardcoded URL', async () => {
      const repos = createMockRepositories();
      const notificationService = new NotificationService(
        repos.proposalRepository,
        repos.userNotificationRepository,
        repos.userRepository,
        repos.daoRepository,
        repos.discourseRepository,
        repos.proposalGroupRepository,
        repos.emailService,
        config
      );

      const mockDao = {
        id: 'dao-1',
        name: 'Test DAO',
        slug: 'test-dao',
        picture: 'https://example.com/dao.jpg',
      };

      const mockTopics = [
        {
          id: 'topic-1',
          externalId: 123,
          title: 'Test Discussion',
          slug: 'test-discussion',
          fancyTitle: 'Test Discussion',
          categoryId: 1,
          daoDiscourseId: 'dao-discourse-1',
          archived: false,
          closed: false,
          pinned: false,
          pinnedGlobally: false,
          visible: true,
          postsCount: 1,
          replyCount: 0,
          likeCount: 0,
          views: 10,
          createdAt: new Date(),
          bumpedAt: new Date(),
          lastPostedAt: new Date(),
          discourseUser: {
            id: 'user-1',
            externalId: 456,
            username: 'testuser',
            name: 'Test User',
            avatarTemplate: 'https://forum.example.org/avatar/120.jpg',
            daoDiscourseId: 'dao-discourse-1',
            title: null,
            likesGiven: '10',
            likesReceived: '20',
            daysVisited: '30',
            postsRead: '100',
            topicsEntered: '50',
            postCount: '25',
            topicCount: '15',
          },
        },
      ];

      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          name: 'User 1',
          emailSettingsNewProposals: true,
          emailSettingsNewDiscussions: true,
          emailSettingsEndingProposals: true,
          emailVerified: true,
          isOnboarded: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          image: null,
        },
      ];

      (repos.discourseRepository.getNewTopics as any).mockResolvedValue(
        mockTopics
      );
      (
        repos.userRepository.getUsersForNewDiscussionNotifications as any
      ).mockResolvedValue(mockUsers);
      (
        repos.userNotificationRepository.getRecentNotifications as any
      ).mockResolvedValue([]);
      (
        repos.proposalGroupRepository.getProposalGroupsByDiscourseUrl as any
      ).mockResolvedValue([]);

      // Test with custom discourse base URL
      const customDiscourseUrl = 'https://forum.uniswap.org';
      await notificationService.processNewDiscussionNotifications(
        mockDao,
        'dao-discourse-1',
        customDiscourseUrl
      );

      // Verify the correct URL was used
      expect(
        repos.proposalGroupRepository.getProposalGroupsByDiscourseUrl
      ).toHaveBeenCalledWith(
        `${customDiscourseUrl}/t/${mockTopics[0].slug}/${mockTopics[0].externalId}`
      );

      // Verify email was sent with correct URLs
      expect(repos.emailService.sendNewDiscussionEmail).toHaveBeenCalledWith(
        mockUsers[0].email,
        expect.objectContaining({
          discussionUrl: `${customDiscourseUrl}/t/${mockTopics[0].slug}/${mockTopics[0].externalId}`,
          authorProfilePicture: 'https://forum.example.org/avatar/120.jpg',
        }),
        expect.any(String)
      );
    });

    it('should use avatar URLs directly from database (no processing needed)', async () => {
      const repos = createMockRepositories();
      const notificationService = new NotificationService(
        repos.proposalRepository,
        repos.userNotificationRepository,
        repos.userRepository,
        repos.daoRepository,
        repos.discourseRepository,
        repos.proposalGroupRepository,
        repos.emailService,
        config
      );

      const mockDao = {
        id: 'dao-1',
        name: 'Test DAO',
        slug: 'test-dao',
        picture: 'https://example.com/dao.jpg',
      };

      const mockTopics = [
        {
          id: 'topic-1',
          externalId: 123,
          title: 'Test Discussion',
          slug: 'test-discussion',
          fancyTitle: 'Test Discussion',
          categoryId: 1,
          daoDiscourseId: 'dao-discourse-1',
          archived: false,
          closed: false,
          pinned: false,
          pinnedGlobally: false,
          visible: true,
          postsCount: 1,
          replyCount: 0,
          likeCount: 0,
          views: 10,
          createdAt: new Date(),
          bumpedAt: new Date(),
          lastPostedAt: new Date(),
          discourseUser: {
            id: 'user-1',
            externalId: 456,
            username: 'testuser',
            name: 'Test User',
            avatarTemplate: 'https://cdn.example.com/avatar/120.jpg',
            daoDiscourseId: 'dao-discourse-1',
            title: null,
            likesGiven: '10',
            likesReceived: '20',
            daysVisited: '30',
            postsRead: '100',
            topicsEntered: '50',
            postCount: '25',
            topicCount: '15',
          },
        },
      ];

      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          name: 'User 1',
          emailSettingsNewProposals: true,
          emailSettingsNewDiscussions: true,
          emailSettingsEndingProposals: true,
          emailVerified: true,
          isOnboarded: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          image: null,
        },
      ];

      (repos.discourseRepository.getNewTopics as any).mockResolvedValue(
        mockTopics
      );
      (
        repos.userRepository.getUsersForNewDiscussionNotifications as any
      ).mockResolvedValue(mockUsers);
      (
        repos.userNotificationRepository.getRecentNotifications as any
      ).mockResolvedValue([]);
      (
        repos.proposalGroupRepository.getProposalGroupsByDiscourseUrl as any
      ).mockResolvedValue([]);

      const customDiscourseUrl = 'https://forum.example.org';
      await notificationService.processNewDiscussionNotifications(
        mockDao,
        'dao-discourse-1',
        customDiscourseUrl
      );

      // Verify email uses the avatar URL directly from database (already processed by indexer)
      expect(repos.emailService.sendNewDiscussionEmail).toHaveBeenCalledWith(
        mockUsers[0].email,
        expect.objectContaining({
          authorProfilePicture: 'https://cdn.example.com/avatar/120.jpg',
        }),
        expect.any(String)
      );
    });
  });

  describe('Idempotency Key Fix', () => {
    it('should generate consistent idempotency keys across hour boundaries', async () => {
      const repos = createMockRepositories();
      const notificationService = new NotificationService(
        repos.proposalRepository,
        repos.userNotificationRepository,
        repos.userRepository,
        repos.daoRepository,
        repos.discourseRepository,
        repos.proposalGroupRepository,
        repos.emailService,
        config
      );

      // Access private method through reflection for testing
      const generateKey = (
        notificationService as any
      ).generateIdempotencyKey.bind(notificationService);

      // Test at 11:59 PM
      const date1 = new Date('2024-01-01T23:59:00Z');
      vi.setSystemTime(date1);
      const key1 = generateKey('user-1', 'proposal-1', 'new_proposal');

      // Test at 12:01 AM (next day)
      const date2 = new Date('2024-01-02T00:01:00Z');
      vi.setSystemTime(date2);
      const key2 = generateKey('user-1', 'proposal-1', 'new_proposal');

      // Keys should be different (daily buckets)
      expect(key1).not.toBe(key2);
      expect(key1).toBe('user-1-proposal-1-new_proposal-2024-01-01');
      expect(key2).toBe('user-1-proposal-1-new_proposal-2024-01-02');

      // Reset system time
      vi.useRealTimers();
    });

    it('should generate same idempotency key within the same day', async () => {
      const repos = createMockRepositories();
      const notificationService = new NotificationService(
        repos.proposalRepository,
        repos.userNotificationRepository,
        repos.userRepository,
        repos.daoRepository,
        repos.discourseRepository,
        repos.proposalGroupRepository,
        repos.emailService,
        config
      );

      const generateKey = (
        notificationService as any
      ).generateIdempotencyKey.bind(notificationService);

      // Test at different times on the same day
      const date1 = new Date('2024-01-01T10:00:00Z');
      vi.setSystemTime(date1);
      const key1 = generateKey('user-1', 'proposal-1', 'new_proposal');

      const date2 = new Date('2024-01-01T22:00:00Z');
      vi.setSystemTime(date2);
      const key2 = generateKey('user-1', 'proposal-1', 'new_proposal');

      // Keys should be the same (same day)
      expect(key1).toBe(key2);
      expect(key1).toBe('user-1-proposal-1-new_proposal-2024-01-01');

      // Reset system time
      vi.useRealTimers();
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should use circuit breaker for email operations when provided', async () => {
      const repos = createMockRepositories();
      const emailCircuitBreaker = new CircuitBreaker(3, 5000);
      const executeSpied = vi.spyOn(emailCircuitBreaker, 'execute');

      const notificationService = new NotificationService(
        repos.proposalRepository,
        repos.userNotificationRepository,
        repos.userRepository,
        repos.daoRepository,
        repos.discourseRepository,
        repos.proposalGroupRepository,
        repos.emailService,
        config,
        emailCircuitBreaker
      );

      const mockDao = {
        id: 'dao-1',
        name: 'Test DAO',
        slug: 'test-dao',
        picture: 'https://example.com/dao.jpg',
      };

      const mockProposals = [
        {
          id: 'proposal-1',
          externalId: '0x123',
          name: 'Test Proposal',
          body: 'Test body',
          url: 'https://example.com/proposal',
          discussionUrl: null,
          choices: ['Yes', 'No'],
          scores: null,
          scoresTotalFloat: null,
          quorum: null,
          proposalState: 'ACTIVE' as any,
          markedSpam: false,
          votingSystem: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          startAt: new Date(),
          endAt: new Date(Date.now() + 3600000),
          author: '0x1234567890123456789012345678901234567890',
          daoGovernorId: 'governor-1',
          daoHandlerId: 'handler-1',
          daoId: 'dao-1',
          proposalResults: null,
        },
      ];

      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          name: 'User 1',
          emailSettingsNewProposals: true,
          emailSettingsNewDiscussions: true,
          emailSettingsEndingProposals: true,
          emailVerified: true,
          isOnboarded: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          image: null,
        },
      ];

      (repos.proposalRepository.getNewProposals as any).mockResolvedValue(
        mockProposals
      );
      (
        repos.userRepository.getUsersForNewProposalNotifications as any
      ).mockResolvedValue(mockUsers);
      (
        repos.userNotificationRepository.getRecentNotifications as any
      ).mockResolvedValue([]);

      await notificationService.processNewProposalNotifications(mockDao);

      // Verify circuit breaker was used
      expect(executeSpied).toHaveBeenCalled();
      expect(repos.emailService.sendNewProposalEmail).toHaveBeenCalled();
    });

    it('should not break when circuit breaker is not provided', async () => {
      const repos = createMockRepositories();

      const notificationService = new NotificationService(
        repos.proposalRepository,
        repos.userNotificationRepository,
        repos.userRepository,
        repos.daoRepository,
        repos.discourseRepository,
        repos.proposalGroupRepository,
        repos.emailService,
        config
      );

      const mockDao = {
        id: 'dao-1',
        name: 'Test DAO',
        slug: 'test-dao',
        picture: 'https://example.com/dao.jpg',
      };

      const mockProposals = [
        {
          id: 'proposal-1',
          externalId: '0x123',
          name: 'Test Proposal',
          body: 'Test body',
          url: 'https://example.com/proposal',
          discussionUrl: null,
          choices: ['Yes', 'No'],
          scores: null,
          scoresTotalFloat: null,
          quorum: null,
          proposalState: 'ACTIVE' as any,
          markedSpam: false,
          votingSystem: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          startAt: new Date(),
          endAt: new Date(Date.now() + 3600000),
          author: '0x1234567890123456789012345678901234567890',
          daoGovernorId: 'governor-1',
          daoHandlerId: 'handler-1',
          daoId: 'dao-1',
          proposalResults: null,
        },
      ];

      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          name: 'User 1',
          emailSettingsNewProposals: true,
          emailSettingsNewDiscussions: true,
          emailSettingsEndingProposals: true,
          emailVerified: true,
          isOnboarded: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          image: null,
        },
      ];

      (repos.proposalRepository.getNewProposals as any).mockResolvedValue(
        mockProposals
      );
      (
        repos.userRepository.getUsersForNewProposalNotifications as any
      ).mockResolvedValue(mockUsers);
      (
        repos.userNotificationRepository.getRecentNotifications as any
      ).mockResolvedValue([]);

      // Should execute without errors
      await notificationService.processNewProposalNotifications(mockDao);

      expect(repos.emailService.sendNewProposalEmail).toHaveBeenCalled();
    });
  });

  describe('Transaction-like Email and Notification Recording', () => {
    it('should not record notification if email send fails', async () => {
      const repos = createMockRepositories();
      const notificationService = new NotificationService(
        repos.proposalRepository,
        repos.userNotificationRepository,
        repos.userRepository,
        repos.daoRepository,
        repos.discourseRepository,
        repos.proposalGroupRepository,
        repos.emailService,
        config
      );

      const mockDao = {
        id: 'dao-1',
        name: 'Test DAO',
        slug: 'test-dao',
        picture: 'https://example.com/dao.jpg',
      };

      const mockProposals = [
        {
          id: 'proposal-1',
          externalId: '0x123',
          name: 'Test Proposal',
          body: 'Test body',
          url: 'https://example.com/proposal',
          discussionUrl: null,
          choices: ['Yes', 'No'],
          scores: null,
          scoresTotalFloat: null,
          quorum: null,
          proposalState: 'ACTIVE' as any,
          markedSpam: false,
          votingSystem: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          startAt: new Date(),
          endAt: new Date(Date.now() + 3600000),
          author: '0x1234567890123456789012345678901234567890',
          daoGovernorId: 'governor-1',
          daoHandlerId: 'handler-1',
          daoId: 'dao-1',
          proposalResults: null,
        },
      ];

      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          name: 'User 1',
          emailSettingsNewProposals: true,
          emailSettingsNewDiscussions: true,
          emailSettingsEndingProposals: true,
          emailVerified: true,
          isOnboarded: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          image: null,
        },
      ];

      (repos.proposalRepository.getNewProposals as any).mockResolvedValue(
        mockProposals
      );
      (
        repos.userRepository.getUsersForNewProposalNotifications as any
      ).mockResolvedValue(mockUsers);
      (
        repos.userNotificationRepository.getRecentNotifications as any
      ).mockResolvedValue([]);

      // Make email service throw an error
      (repos.emailService.sendNewProposalEmail as any).mockRejectedValue(
        new Error('Email service error')
      );

      await notificationService.processNewProposalNotifications(mockDao);

      // Verify notification was NOT recorded due to email failure
      expect(
        repos.userNotificationRepository.createNotification
      ).not.toHaveBeenCalled();
    });

    it('should record notification only after successful email send', async () => {
      const repos = createMockRepositories();
      const notificationService = new NotificationService(
        repos.proposalRepository,
        repos.userNotificationRepository,
        repos.userRepository,
        repos.daoRepository,
        repos.discourseRepository,
        repos.proposalGroupRepository,
        repos.emailService,
        config
      );

      const mockDao = {
        id: 'dao-1',
        name: 'Test DAO',
        slug: 'test-dao',
        picture: 'https://example.com/dao.jpg',
      };

      const mockProposals = [
        {
          id: 'proposal-1',
          externalId: '0x123',
          name: 'Test Proposal',
          body: 'Test body',
          url: 'https://example.com/proposal',
          discussionUrl: null,
          choices: ['Yes', 'No'],
          scores: null,
          scoresTotalFloat: null,
          quorum: null,
          proposalState: 'ACTIVE' as any,
          markedSpam: false,
          votingSystem: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          startAt: new Date(),
          endAt: new Date(Date.now() + 3600000),
          author: '0x1234567890123456789012345678901234567890',
          daoGovernorId: 'governor-1',
          daoHandlerId: 'handler-1',
          daoId: 'dao-1',
          proposalResults: null,
        },
      ];

      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          name: 'User 1',
          emailSettingsNewProposals: true,
          emailSettingsNewDiscussions: true,
          emailSettingsEndingProposals: true,
          emailVerified: true,
          isOnboarded: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          image: null,
        },
      ];

      (repos.proposalRepository.getNewProposals as any).mockResolvedValue(
        mockProposals
      );
      (
        repos.userRepository.getUsersForNewProposalNotifications as any
      ).mockResolvedValue(mockUsers);
      (
        repos.userNotificationRepository.getRecentNotifications as any
      ).mockResolvedValue([]);

      let emailSent = false;
      (repos.emailService.sendNewProposalEmail as any).mockImplementation(
        async () => {
          emailSent = true;
        }
      );

      (
        repos.userNotificationRepository.createNotification as any
      ).mockImplementation(async () => {
        // Verify email was sent before notification recording
        expect(emailSent).toBe(true);
      });

      await notificationService.processNewProposalNotifications(mockDao);

      // Verify both email and notification were processed
      expect(repos.emailService.sendNewProposalEmail).toHaveBeenCalled();
      expect(
        repos.userNotificationRepository.createNotification
      ).toHaveBeenCalledWith('user-1', 'proposal-1', 'new_proposal');
    });
  });
});
