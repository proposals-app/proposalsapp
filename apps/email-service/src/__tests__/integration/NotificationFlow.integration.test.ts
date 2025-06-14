import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupTestDatabase, getTestDb, createTestData } from './setup';
import { DependencyContainer } from '../../services/DependencyContainer';
import type { IEmailClient } from '../../types/services';
import { ProposalState } from '@proposalsapp/db';

// Mock email client to capture sent emails
const mockEmailClient: IEmailClient = {
  send: vi.fn(),
};

// Mock email service factory
vi.mock('../../services/ResendEmailClient', () => ({
  ResendEmailClient: vi.fn().mockImplementation(() => mockEmailClient),
}));

// Mock email templates
vi.mock('@react-email/render', () => ({
  render: vi.fn().mockResolvedValue('<html>Test Email</html>'),
}));

vi.mock('@proposalsapp/emails', () => ({
  NewProposalEmailTemplate: vi.fn((props) => ({ props })),
  NewDiscussionEmailTemplate: vi.fn((props) => ({ props })),
  EndingProposalEmailTemplate: vi.fn((props) => ({ props })),
}));

setupTestDatabase();

describe('Notification Flow Integration Tests', () => {
  let container: DependencyContainer;
  let testData: Awaited<ReturnType<typeof createTestData>>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create test data
    testData = await createTestData();

    // Create dependency container with test configuration
    container = new DependencyContainer(
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
  });

  describe('New Proposal Notifications', () => {
    it('should send notifications for new proposals', async () => {
      const db = getTestDb();

      // Create a new proposal
      const [proposal] = await db
        .insertInto('proposal')
        .values({
          daoId: testData.dao.id,
          governorId: testData.governor.id,
          externalId: 'test-proposal-1',
          name: 'Test Proposal',
          body: 'This is a test proposal',
          url: 'https://example.com/proposal/1',
          author: '0x1234567890123456789012345678901234567890',
          proposalState: ProposalState.ACTIVE,
          startAt: new Date(),
          endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          quorum: 100,
          choices: JSON.stringify(['For', 'Against']),
          markedSpam: false,
          createdAt: new Date(), // Recent proposal
        })
        .returning(['id', 'name', 'url'])
        .execute();

      // Process notifications
      const notificationService = container.getNotificationService('testdao');
      await notificationService.processNewProposalNotifications(testData.dao);

      // Verify email was sent
      expect(mockEmailClient.send).toHaveBeenCalledOnce();
      const emailCall = (mockEmailClient.send as any).mock.calls[0][0];

      expect(emailCall.to).toBe('test@example.com');
      expect(emailCall.subject).toBe('New proposal in Test DAO');
      expect(emailCall.from).toBe('test@proposals.app');
      expect(emailCall.html).toBe('<html>Test Email</html>');

      // Verify notification was recorded
      const notifications = await db
        .withSchema('testdao')
        .withSchema('testdao')
        .selectFrom('userNotification')
        .selectAll()
        .where('userId', '=', testData.user.id)
        .where('targetId', '=', proposal.id)
        .where('type', '=', 'new_proposal')
        .execute();

      expect(notifications).toHaveLength(1);
    });

    it('should generate and pass idempotency keys when sending emails', async () => {
      const db = getTestDb();

      // Create a new proposal
      const [proposal] = await db
        .insertInto('proposal')
        .values({
          daoId: testData.dao.id,
          governorId: testData.governor.id,
          externalId: 'test-proposal-idempotency',
          name: 'Test Proposal Idempotency',
          body: 'This proposal tests idempotency',
          url: 'https://example.com/proposal/idempotency',
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

      // Process notifications
      const notificationService = container.getNotificationService('testdao');
      await notificationService.processNewProposalNotifications(testData.dao);

      // Verify email was sent with idempotency key
      expect(mockEmailClient.send).toHaveBeenCalledOnce();
      const emailCall = (mockEmailClient.send as any).mock.calls[0][0];

      expect(emailCall.idempotencyKey).toBeDefined();
      expect(emailCall.idempotencyKey).toMatch(
        new RegExp(`^${testData.user.id}-${proposal.id}-new_proposal-\\d+$`)
      );
    });

    it('should not send duplicate notifications', async () => {
      const db = getTestDb();

      // Create a new proposal
      const [proposal] = await db
        .insertInto('proposal')
        .values({
          daoId: testData.dao.id,
          governorId: testData.governor.id,
          externalId: 'test-proposal-2',
          name: 'Test Proposal 2',
          body: 'This is another test proposal',
          url: 'https://example.com/proposal/2',
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

      // Create existing notification
      await db
        .withSchema('testdao')
        .insertInto('userNotification')
        .values({
          userId: testData.user.id,
          targetId: proposal.id,
          type: 'new_proposal',
          sentAt: new Date(),
        })
        .execute();

      // Process notifications
      const notificationService = container.getNotificationService('testdao');
      await notificationService.processNewProposalNotifications(testData.dao);

      // Verify no email was sent
      expect(mockEmailClient.send).not.toHaveBeenCalled();
    });

    it('should not send notifications for old proposals', async () => {
      const db = getTestDb();

      // Create an old proposal (created 2 hours ago)
      await db
        .insertInto('proposal')
        .values({
          daoId: testData.dao.id,
          governorId: testData.governor.id,
          externalId: 'old-proposal',
          name: 'Old Proposal',
          body: 'This is an old proposal',
          url: 'https://example.com/proposal/old',
          author: '0x1234567890123456789012345678901234567890',
          proposalState: ProposalState.ACTIVE,
          startAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          quorum: 100,
          choices: JSON.stringify(['For', 'Against']),
          markedSpam: false,
          createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
        })
        .execute();

      // Process notifications
      const notificationService = container.getNotificationService('testdao');
      await notificationService.processNewProposalNotifications(testData.dao);

      // Verify no email was sent (timeframe is 60 minutes)
      expect(mockEmailClient.send).not.toHaveBeenCalled();
    });
  });

  describe('Ending Proposal Notifications', () => {
    it('should send notifications for proposals ending soon', async () => {
      const db = getTestDb();

      // Use the existing test user for ending proposal notifications
      const endingUser = testData.user;

      // Create a proposal ending soon (in 30 minutes)
      const now = new Date();
      const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);
      const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);

      console.log('Test timing:');
      console.log('Now:', now.toISOString());
      console.log(
        'Thirty minutes from now:',
        thirtyMinutesFromNow.toISOString()
      );
      console.log('Six days ago:', sixDaysAgo.toISOString());

      const [proposal] = await db
        .insertInto('proposal')
        .values({
          daoId: testData.dao.id,
          governorId: testData.governor.id,
          externalId: 'ending-proposal',
          name: 'Ending Proposal',
          body: 'This proposal is ending soon',
          url: 'https://example.com/proposal/ending',
          author: '0x1234567890123456789012345678901234567890',
          proposalState: ProposalState.ACTIVE,
          startAt: sixDaysAgo,
          endAt: thirtyMinutesFromNow,
          quorum: 100,
          choices: JSON.stringify(['For', 'Against']),
          markedSpam: false,
          createdAt: sixDaysAgo,
        })
        .returning(['id'])
        .execute();

      // Debug: Check if proposal was created correctly
      const allProposals = await db
        .selectFrom('proposal')
        .selectAll()
        .where('daoId', '=', testData.dao.id)
        .execute();
      console.log('All proposals:', allProposals);

      // Debug: Check users for ending proposals
      const endingUsers = await container
        .getUserRepository('testdao')
        .getUsersForEndingProposalNotifications('testdao');
      console.log('Users for ending proposals:', endingUsers);

      // Debug: Test manual query to see what's happening
      const manualQuery = await db
        .selectFrom('proposal')
        .selectAll()
        .where('daoId', '=', testData.dao.id)
        .where('proposalState', '=', ProposalState.ACTIVE)
        .where('markedSpam', '=', false)
        .execute();
      console.log('Manual query (all ACTIVE proposals):', manualQuery);

      // Process notifications
      const notificationService = container.getNotificationService('testdao');
      await notificationService.processEndingProposalNotifications(
        testData.dao
      );

      // Verify email was sent
      expect(mockEmailClient.send).toHaveBeenCalledOnce();
      const emailCall = (mockEmailClient.send as any).mock.calls[0][0];

      expect(emailCall.to).toBe('test@example.com');
      expect(emailCall.subject).toBe('Proposal ending soon in Test DAO');

      // Verify notification was recorded
      const notifications = await db
        .withSchema('testdao')
        .selectFrom('userNotification')
        .selectAll()
        .where('userId', '=', endingUser.id)
        .where('targetId', '=', proposal.id)
        .where('type', '=', 'ending_proposal')
        .execute();

      expect(notifications).toHaveLength(1);
    });

    it('should not send notifications for proposals ending too far in the future', async () => {
      const db = getTestDb();

      // Create a proposal ending in 5 hours (beyond 120 minute timeframe)
      await db
        .insertInto('proposal')
        .values({
          daoId: testData.dao.id,
          governorId: testData.governor.id,
          externalId: 'future-ending-proposal',
          name: 'Future Ending Proposal',
          body: 'This proposal ends far in the future',
          url: 'https://example.com/proposal/future',
          author: '0x1234567890123456789012345678901234567890',
          proposalState: ProposalState.ACTIVE,
          startAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          endAt: new Date(Date.now() + 5 * 60 * 60 * 1000), // Ends in 5 hours
          quorum: 100,
          choices: JSON.stringify(['For', 'Against']),
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        })
        .execute();

      // Process notifications
      const notificationService = container.getNotificationService('testdao');
      await notificationService.processEndingProposalNotifications(
        testData.dao
      );

      // Verify no email was sent (timeframe is 120 minutes)
      expect(mockEmailClient.send).not.toHaveBeenCalled();
    });
  });

  describe('New Discussion Notifications', () => {
    it('should send notifications for new discussions', async () => {
      const db = getTestDb();

      // Create a new discourse topic
      const [topic] = await db
        .insertInto('discourseTopic')
        .values({
          daoDiscourseId: testData.discourse.id,
          externalId: 123,
          title: 'Test Discussion',
          slug: 'test-discussion',
          fancyTitle: 'Test Discussion',
          categoryId: 1,
          archived: false,
          closed: false,
          pinned: false,
          pinnedGlobally: false,
          visible: true,
          postsCount: 1,
          replyCount: 0,
          likeCount: 0,
          views: 10,
          createdAt: new Date(), // Recent topic
          bumpedAt: new Date(),
          lastPostedAt: new Date(),
        })
        .returning(['id', 'slug', 'externalId'])
        .execute();

      // Create a discourse post for the topic
      await db
        .insertInto('discoursePost')
        .values({
          daoDiscourseId: testData.discourse.id,
          externalId: 1,
          topicId: topic.externalId,
          topicSlug: topic.slug,
          postNumber: 1,
          postType: 1,
          userId: testData.discourseUser.externalId,
          username: testData.discourseUser.username,
          deleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          replyCount: 0,
          quoteCount: 0,
          incomingLinkCount: 0,
          reads: 0,
          readersCount: 0,
          score: 0,
          version: 1,
        })
        .execute();

      // Process notifications
      const notificationService = container.getNotificationService('testdao');
      await notificationService.processNewDiscussionNotifications(
        testData.dao,
        testData.discourse.id
      );

      // Verify email was sent
      expect(mockEmailClient.send).toHaveBeenCalledOnce();
      const emailCall = (mockEmailClient.send as any).mock.calls[0][0];

      expect(emailCall.to).toBe('test@example.com');
      expect(emailCall.subject).toBe('New discussion in Test DAO');

      // Verify notification was recorded
      const notifications = await db
        .withSchema('testdao')
        .selectFrom('userNotification')
        .selectAll()
        .where('userId', '=', testData.user.id)
        .where('targetId', '=', topic.id)
        .where('type', '=', 'new_discussion')
        .execute();

      expect(notifications).toHaveLength(1);
    });

    it('should skip discussions linked to proposals', async () => {
      const db = getTestDb();

      // Create a new discourse topic
      const [topic] = await db
        .insertInto('discourseTopic')
        .values({
          daoDiscourseId: testData.discourse.id,
          externalId: 456,
          title: 'Proposal Discussion',
          slug: 'proposal-discussion',
          fancyTitle: 'Proposal Discussion',
          categoryId: 1,
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
        })
        .returning(['slug', 'externalId'])
        .execute();

      // Create a discourse post
      await db
        .insertInto('discoursePost')
        .values({
          daoDiscourseId: testData.discourse.id,
          externalId: 2,
          topicId: topic.externalId,
          topicSlug: topic.slug,
          postNumber: 1,
          postType: 1,
          userId: testData.discourseUser.externalId,
          username: testData.discourseUser.username,
          deleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          replyCount: 0,
          quoteCount: 0,
          incomingLinkCount: 0,
          reads: 0,
          readersCount: 0,
          score: 0,
          version: 1,
        })
        .execute();

      // Create a proposal group that links to this discussion
      const topicUrl = `https://forum.arbitrum.foundation/t/${topic.slug}/${topic.externalId}`;
      await db
        .insertInto('proposalGroup')
        .values({
          daoId: testData.dao.id,
          name: 'Test Proposal Group',
          items: JSON.stringify([
            {
              type: 'topic',
              href: topicUrl,
            },
          ]),
        })
        .execute();

      // Process notifications
      const notificationService = container.getNotificationService('testdao');
      await notificationService.processNewDiscussionNotifications(
        testData.dao,
        testData.discourse.id
      );

      // Verify no email was sent (discussion is linked to proposal)
      expect(mockEmailClient.send).not.toHaveBeenCalled();
    });
  });

  describe('User Preferences', () => {
    it('should respect user email preferences', async () => {
      const db = getTestDb();

      // Update user to disable new proposal notifications
      await db
        .withSchema('testdao')
        .updateTable('user')
        .set({ emailSettingsNewProposals: false })
        .where('id', '=', testData.user.id)
        .execute();

      // Create a new proposal
      await db
        .insertInto('proposal')
        .values({
          daoId: testData.dao.id,
          governorId: testData.governor.id,
          externalId: 'test-proposal-disabled',
          name: 'Test Proposal (Disabled)',
          body: 'This proposal should not trigger notifications',
          url: 'https://example.com/proposal/disabled',
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

      // Process notifications
      const notificationService = container.getNotificationService('testdao');
      await notificationService.processNewProposalNotifications(testData.dao);

      // Verify no email was sent (user disabled notifications)
      expect(mockEmailClient.send).not.toHaveBeenCalled();
    });

    it('should not send notifications to unverified users', async () => {
      const db = getTestDb();

      // Update user to be unverified
      await db
        .withSchema('testdao')
        .updateTable('user')
        .set({ emailVerified: false })
        .where('id', '=', testData.user.id)
        .execute();

      // Create a new proposal
      await db
        .insertInto('proposal')
        .values({
          daoId: testData.dao.id,
          governorId: testData.governor.id,
          externalId: 'test-proposal-unverified',
          name: 'Test Proposal (Unverified User)',
          body: 'This proposal should not trigger notifications',
          url: 'https://example.com/proposal/unverified',
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

      // Process notifications
      const notificationService = container.getNotificationService('testdao');
      await notificationService.processNewProposalNotifications(testData.dao);

      // Verify no email was sent (user not verified)
      expect(mockEmailClient.send).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle email sending failures gracefully', async () => {
      const db = getTestDb();

      // Mock email client to throw error
      (mockEmailClient.send as any).mockRejectedValue(
        new Error('Email sending failed')
      );

      // Create a new proposal
      const [proposal] = await db
        .insertInto('proposal')
        .values({
          daoId: testData.dao.id,
          governorId: testData.governor.id,
          externalId: 'test-proposal-error',
          name: 'Test Proposal (Error)',
          body: 'This proposal will cause email error',
          url: 'https://example.com/proposal/error',
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

      // Process notifications (should not throw)
      const notificationService = container.getNotificationService('testdao');
      await expect(
        notificationService.processNewProposalNotifications(testData.dao)
      ).resolves.not.toThrow();

      // Verify email was attempted
      expect(mockEmailClient.send).toHaveBeenCalledOnce();

      // Verify notification was NOT recorded (due to failure)
      const notifications = await db
        .withSchema('testdao')
        .withSchema('testdao')
        .selectFrom('userNotification')
        .selectAll()
        .where('userId', '=', testData.user.id)
        .where('targetId', '=', proposal.id)
        .where('type', '=', 'new_proposal')
        .execute();

      expect(notifications).toHaveLength(0);
    });
  });
});
