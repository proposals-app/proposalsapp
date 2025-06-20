import { describe, it, expect, vi, beforeEach } from 'vitest';
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

// Mock repositories
const mockProposalRepository: IProposalRepository = {
  getNewProposals: vi.fn(),
  getEndingProposals: vi.fn(),
};

const mockUserNotificationRepository: IUserNotificationRepository = {
  getRecentNotifications: vi.fn(),
  createNotification: vi.fn(),
};

const mockUserRepository: IUserRepository = {
  getUsersForNewProposalNotifications: vi.fn(),
  getUsersForNewDiscussionNotifications: vi.fn(),
  getUsersForEndingProposalNotifications: vi.fn(),
};

const mockDaoRepository: IDaoRepository = {
  getEnabledDaos: vi.fn(),
  getDaoBySlug: vi.fn(),
};

const mockDiscourseRepository: IDiscourseRepository = {
  getNewTopics: vi.fn(),
};

const mockProposalGroupRepository: IProposalGroupRepository = {
  getProposalGroupsByDiscourseUrl: vi.fn(),
};

const mockEmailService: IEmailService = {
  sendNewProposalEmail: vi.fn(),
  sendNewDiscussionEmail: vi.fn(),
  sendEndingProposalEmail: vi.fn(),
};

const mockConfig: NotificationConfig = {
  newProposalTimeframeMinutes: 5,
  endingProposalTimeframeMinutes: 60,
  newDiscussionTimeframeMinutes: 5,
  notificationCooldownHours: 24,
};

describe('NotificationService', () => {
  let notificationService: NotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    notificationService = new NotificationService(
      mockProposalRepository,
      mockUserNotificationRepository,
      mockUserRepository,
      mockDaoRepository,
      mockDiscourseRepository,
      mockProposalGroupRepository,
      mockEmailService,
      mockConfig
    );
  });

  describe('processNewProposalNotifications', () => {
    const mockDao = {
      id: 'dao-1',
      name: 'Test DAO',
      slug: 'test-dao',
      picture: 'https://example.com/dao.jpg',
    };

    it('should process new proposal notifications successfully', async () => {
      const mockProposals = [
        {
          id: 'proposal-1',
          name: 'Test Proposal',
          url: 'https://example.com/proposal/1',
          author: '0x1234567890123456789012345678901234567890',
          externalId: 'ext-1',
          governorId: 'gov-1',
          daoId: 'dao-1',
          body: 'Test body',
          proposalState: 'ACTIVE' as const,
          quorum: 100,
          startAt: new Date(),
          endAt: new Date(),
          createdAt: new Date(),
          markedSpam: false,
          choices: {},
          metadata: null,
          discussionUrl: null,
          txid: null,
          blockCreatedAt: null,
          blockStartAt: null,
          blockEndAt: null,
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

      (mockProposalRepository.getNewProposals as any).mockResolvedValue(
        mockProposals
      );
      (
        mockUserRepository.getUsersForNewProposalNotifications as any
      ).mockResolvedValue(mockUsers);
      (
        mockUserNotificationRepository.getRecentNotifications as any
      ).mockResolvedValue([]);

      await notificationService.processNewProposalNotifications(mockDao);

      expect(mockProposalRepository.getNewProposals).toHaveBeenCalledWith(
        5,
        'dao-1'
      );
      expect(
        mockUserRepository.getUsersForNewProposalNotifications
      ).toHaveBeenCalledWith('test-dao');
      expect(mockEmailService.sendNewProposalEmail).toHaveBeenCalledWith(
        'user1@example.com',
        {
          proposalName: 'Test Proposal',
          proposalUrl: 'https://example.com/proposal/1',
          daoName: 'Test DAO',
          authorAddress: '0x1234567890123456789012345678901234567890',
          authorEns: undefined,
        },
        expect.any(String)
      );
      expect(
        mockUserNotificationRepository.createNotification
      ).toHaveBeenCalledWith('user-1', 'proposal-1', 'new_proposal');
    });

    it('should skip notifications if no new proposals', async () => {
      (mockProposalRepository.getNewProposals as any).mockResolvedValue([]);

      await notificationService.processNewProposalNotifications(mockDao);

      expect(
        mockUserRepository.getUsersForNewProposalNotifications
      ).not.toHaveBeenCalled();
      expect(mockEmailService.sendNewProposalEmail).not.toHaveBeenCalled();
    });

    it('should skip notification if already sent recently', async () => {
      const mockProposals = [
        {
          id: 'proposal-1',
          name: 'Test Proposal',
          url: 'https://example.com/proposal/1',
          author: '0x1234567890123456789012345678901234567890',
          externalId: 'ext-1',
          governorId: 'gov-1',
          daoId: 'dao-1',
          body: 'Test body',
          proposalState: 'ACTIVE' as const,
          quorum: 100,
          startAt: new Date(),
          endAt: new Date(),
          createdAt: new Date(),
          markedSpam: false,
          choices: {},
          metadata: null,
          discussionUrl: null,
          txid: null,
          blockCreatedAt: null,
          blockStartAt: null,
          blockEndAt: null,
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

      const mockRecentNotifications = [
        {
          id: 'notif-1',
          userId: 'user-1',
          targetId: 'proposal-1',
          type: 'new_proposal',
          sentAt: new Date(),
        },
      ];

      (mockProposalRepository.getNewProposals as any).mockResolvedValue(
        mockProposals
      );
      (
        mockUserRepository.getUsersForNewProposalNotifications as any
      ).mockResolvedValue(mockUsers);
      (
        mockUserNotificationRepository.getRecentNotifications as any
      ).mockResolvedValue(mockRecentNotifications);

      await notificationService.processNewProposalNotifications(mockDao);

      expect(mockEmailService.sendNewProposalEmail).not.toHaveBeenCalled();
      expect(
        mockUserNotificationRepository.createNotification
      ).not.toHaveBeenCalled();
    });
  });

  describe('processNewDiscussionNotifications', () => {
    const mockDao = {
      id: 'dao-1',
      name: 'Test DAO',
      slug: 'test-dao',
      picture: 'https://example.com/dao.jpg',
    };

    it('should process new discussion notifications successfully', async () => {
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
            avatarTemplate: 'https://forum.arbitrum.foundation/avatar/120.jpg',
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

      (mockDiscourseRepository.getNewTopics as any).mockResolvedValue(
        mockTopics
      );
      (
        mockUserRepository.getUsersForNewDiscussionNotifications as any
      ).mockResolvedValue(mockUsers);
      (
        mockProposalGroupRepository.getProposalGroupsByDiscourseUrl as any
      ).mockResolvedValue([]);
      (
        mockUserNotificationRepository.getRecentNotifications as any
      ).mockResolvedValue([]);

      await notificationService.processNewDiscussionNotifications(
        mockDao,
        'dao-discourse-1',
        'https://forum.arbitrum.foundation'
      );

      expect(mockDiscourseRepository.getNewTopics).toHaveBeenCalledWith(
        5,
        'dao-discourse-1',
        undefined
      );
      expect(
        mockUserRepository.getUsersForNewDiscussionNotifications
      ).toHaveBeenCalledWith('test-dao');
      expect(mockEmailService.sendNewDiscussionEmail).toHaveBeenCalledWith(
        'user1@example.com',
        {
          discussionTitle: 'Test Discussion',
          discussionUrl:
            'https://forum.arbitrum.foundation/t/test-discussion/123',
          daoName: 'Test DAO',
          authorUsername: 'testuser',
          authorProfilePicture:
            'https://forum.arbitrum.foundation/avatar/120.jpg',
        },
        expect.any(String)
      );
      expect(
        mockUserNotificationRepository.createNotification
      ).toHaveBeenCalledWith('user-1', 'topic-1', 'new_discussion');
    });

    it('should skip discussions linked to proposals', async () => {
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
            avatarTemplate: 'https://forum.arbitrum.foundation/avatar/120.jpg',
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

      const mockProposalGroups = [
        {
          id: 'group-1',
          name: 'Test Group',
          daoId: 'dao-1',
          items: {},
          createdAt: new Date(),
        },
      ];

      (mockDiscourseRepository.getNewTopics as any).mockResolvedValue(
        mockTopics
      );
      (
        mockUserRepository.getUsersForNewDiscussionNotifications as any
      ).mockResolvedValue([
        {
          id: 'user-1',
          email: 'user1@example.com',
          name: 'Test User',
          emailVerified: true,
          emailSettingsNewDiscussions: true,
        },
      ]);
      (
        mockProposalGroupRepository.getProposalGroupsByDiscourseUrl as any
      ).mockResolvedValue(mockProposalGroups);

      await notificationService.processNewDiscussionNotifications(
        mockDao,
        'dao-discourse-1',
        'https://forum.arbitrum.foundation'
      );

      expect(mockEmailService.sendNewDiscussionEmail).not.toHaveBeenCalled();
    });

    it('should filter discussions by category for Arbitrum DAO', async () => {
      const arbitrumDao = {
        id: 'dao-arbitrum',
        name: 'Arbitrum',
        slug: 'arbitrum',
        picture: 'https://example.com/arbitrum.jpg',
      };

      const mockTopics = [
        {
          id: 'topic-1',
          externalId: 123,
          title: 'Test Discussion in Category 7',
          slug: 'test-discussion-7',
          fancyTitle: 'Test Discussion',
          categoryId: 7,
          daoDiscourseId: 'dao-discourse-arbitrum',
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
            avatarTemplate: 'avatar.png',
            daoDiscourseId: 'dao-discourse-arbitrum',
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

      (mockDiscourseRepository.getNewTopics as any).mockResolvedValue(
        mockTopics
      );
      (
        mockUserRepository.getUsersForNewDiscussionNotifications as any
      ).mockResolvedValue([]);

      await notificationService.processNewDiscussionNotifications(
        arbitrumDao,
        'dao-discourse-arbitrum',
        'https://forum.arbitrum.foundation'
      );

      // Verify that getNewTopics was called with the allowed category IDs for Arbitrum
      expect(mockDiscourseRepository.getNewTopics).toHaveBeenCalledWith(
        5,
        'dao-discourse-arbitrum',
        [7, 8]
      );
    });

    it('should not filter discussions by category for non-Arbitrum DAOs', async () => {
      const uniswapDao = {
        id: 'dao-uniswap',
        name: 'Uniswap',
        slug: 'uniswap',
        picture: 'https://example.com/uniswap.jpg',
      };

      (mockDiscourseRepository.getNewTopics as any).mockResolvedValue([]);
      (
        mockUserRepository.getUsersForNewDiscussionNotifications as any
      ).mockResolvedValue([]);

      await notificationService.processNewDiscussionNotifications(
        uniswapDao,
        'dao-discourse-uniswap',
        'https://forum.uniswap.org'
      );

      // Verify that getNewTopics was called without category filtering
      expect(mockDiscourseRepository.getNewTopics).toHaveBeenCalledWith(
        5,
        'dao-discourse-uniswap',
        undefined
      );
    });

    it('should not send email for Arbitrum discussions in category 10', async () => {
      const arbitrumDao = {
        id: 'dao-arbitrum',
        name: 'Arbitrum',
        slug: 'arbitrum',
        picture: 'https://example.com/arbitrum.jpg',
      };

      // Mock that no topics are returned because category 10 is filtered out
      (mockDiscourseRepository.getNewTopics as any).mockResolvedValue([]);
      
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

      (
        mockUserRepository.getUsersForNewDiscussionNotifications as any
      ).mockResolvedValue(mockUsers);

      await notificationService.processNewDiscussionNotifications(
        arbitrumDao,
        'dao-discourse-arbitrum',
        'https://forum.arbitrum.foundation'
      );

      // Verify that getNewTopics was called with only categories 7 and 8
      expect(mockDiscourseRepository.getNewTopics).toHaveBeenCalledWith(
        5,
        'dao-discourse-arbitrum',
        [7, 8]
      );

      // Verify that no email was sent since no topics were returned
      expect(mockEmailService.sendNewDiscussionEmail).not.toHaveBeenCalled();
    });
  });

  describe('idempotency key generation', () => {
    it('should generate consistent idempotency keys for same parameters within same day', () => {
      // Access the private method via any cast for testing
      const service = notificationService as any;

      const userId = 'user-123';
      const targetId = 'proposal-456';
      const type = 'new_proposal';

      const key1 = service.generateIdempotencyKey(userId, targetId, type);
      const key2 = service.generateIdempotencyKey(userId, targetId, type);

      expect(key1).toBe(key2);
      expect(key1).toMatch(
        /^user-123-proposal-456-new_proposal-\d{4}-\d{2}-\d{2}$/
      );
    });

    it('should generate different keys for different users', () => {
      const service = notificationService as any;

      const targetId = 'proposal-456';
      const type = 'new_proposal';

      const key1 = service.generateIdempotencyKey('user-123', targetId, type);
      const key2 = service.generateIdempotencyKey('user-789', targetId, type);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different target IDs', () => {
      const service = notificationService as any;

      const userId = 'user-123';
      const type = 'new_proposal';

      const key1 = service.generateIdempotencyKey(userId, 'proposal-456', type);
      const key2 = service.generateIdempotencyKey(userId, 'proposal-789', type);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different notification types', () => {
      const service = notificationService as any;

      const userId = 'user-123';
      const targetId = 'target-456';

      const key1 = service.generateIdempotencyKey(
        userId,
        targetId,
        'new_proposal'
      );
      const key2 = service.generateIdempotencyKey(
        userId,
        targetId,
        'ending_proposal'
      );
      const key3 = service.generateIdempotencyKey(
        userId,
        targetId,
        'new_discussion'
      );

      expect(key1).not.toBe(key2);
      expect(key2).not.toBe(key3);
      expect(key1).not.toBe(key3);
    });

    it('should include date in key for daily idempotency', () => {
      const service = notificationService as any;

      const key = service.generateIdempotencyKey(
        'user-123',
        'target-456',
        'new_proposal'
      );
      const date = new Date();
      const dayBucket = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

      expect(key).toBe(`user-123-target-456-new_proposal-${dayBucket}`);
    });
  });
});
