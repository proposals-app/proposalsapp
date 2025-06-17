import type {
  Selectable,
  Dao,
  Proposal,
  DiscourseTopic,
  DiscourseUser,
} from '@proposalsapp/db';
import type {
  IProposalRepository,
  IUserNotificationRepository,
  IUserRepository,
  IDaoRepository,
  IDiscourseRepository,
  IProposalGroupRepository,
} from '../types/repositories';
import type { IEmailService } from '../types/services';
import { formatDistanceStrict } from 'date-fns';
import { DAO_DISCOURSE_CATEGORIES } from '../config/daoDiscourseCategories';
import type { CircuitBreaker } from './CircuitBreaker';

export interface NotificationConfig {
  newProposalTimeframeMinutes: number;
  endingProposalTimeframeMinutes: number;
  newDiscussionTimeframeMinutes: number;
  notificationCooldownHours: number;
}

export class NotificationService {
  constructor(
    private proposalRepository: IProposalRepository,
    private userNotificationRepository: IUserNotificationRepository,
    private userRepository: IUserRepository,
    private daoRepository: IDaoRepository,
    private discourseRepository: IDiscourseRepository,
    private proposalGroupRepository: IProposalGroupRepository,
    private emailService: IEmailService,
    private config: NotificationConfig,
    private emailCircuitBreaker?: CircuitBreaker // Optional circuit breaker for email service
  ) {}

  async processNewProposalNotifications(dao: Selectable<Dao>): Promise<void> {
    try {
      console.log(`Processing new proposal notifications for ${dao.name}`);

      const newProposals = await this.proposalRepository.getNewProposals(
        this.config.newProposalTimeframeMinutes,
        dao.id
      );

      if (newProposals.length === 0) {
        console.log(`No new proposals found for ${dao.name}`);
        return;
      }

      const users =
        await this.userRepository.getUsersForNewProposalNotifications(dao.slug);
      console.log(
        `Found ${users.length} users to notify for new proposals in ${dao.name}`
      );

      for (const proposal of newProposals) {
        for (const user of users) {
          await this.sendNewProposalNotification(
            user.email,
            user.id,
            proposal,
            dao
          );
        }
      }
    } catch (error) {
      console.error(
        `Failed to process new proposal notifications for ${dao.name}:`,
        error
      );
    }
  }

  async processEndingProposalNotifications(
    dao: Selectable<Dao>
  ): Promise<void> {
    console.log(`Processing ending proposal notifications for ${dao.name}`);

    const endingProposals = await this.proposalRepository.getEndingProposals(
      this.config.endingProposalTimeframeMinutes,
      dao.id
    );

    if (endingProposals.length === 0) {
      console.log(`No ending proposals found for ${dao.name}`);
      return;
    }

    const users =
      await this.userRepository.getUsersForEndingProposalNotifications(
        dao.slug
      );
    console.log(
      `Found ${users.length} users to notify for ending proposals in ${dao.name}`
    );

    for (const proposal of endingProposals) {
      for (const user of users) {
        await this.sendEndingProposalNotification(
          user.email,
          user.id,
          proposal,
          dao
        );
      }
    }
  }

  async processNewDiscussionNotifications(
    dao: Selectable<Dao>,
    daoDiscourseId: string,
    discourseBaseUrl: string
  ): Promise<void> {
    console.log(`Processing new discussion notifications for ${dao.name}`);

    // Get allowed category IDs for the DAO
    const allowedCategoryIds = DAO_DISCOURSE_CATEGORIES[dao.slug];
    if (allowedCategoryIds) {
      console.log(
        `Filtering discussions for ${dao.name} to categories: ${allowedCategoryIds.join(', ')}`
      );
    }

    const newTopics = await this.discourseRepository.getNewTopics(
      this.config.newDiscussionTimeframeMinutes,
      daoDiscourseId,
      allowedCategoryIds
    );

    if (newTopics.length === 0) {
      console.log(`No new discussions found for ${dao.name}`);
      return;
    }

    const users =
      await this.userRepository.getUsersForNewDiscussionNotifications(dao.slug);
    console.log(
      `Found ${users.length} users to notify for new discussions in ${dao.name}`
    );

    for (const topic of newTopics) {
      // Check if this discussion is associated with a proposal
      const topicUrl = `${discourseBaseUrl}/t/${topic.slug}/${topic.externalId}`;
      const proposalGroups =
        await this.proposalGroupRepository.getProposalGroupsByDiscourseUrl(
          topicUrl
        );

      if (proposalGroups.length > 0) {
        console.log(
          `Skipping notification for topic ${topic.id} as it's linked to a proposal`
        );
        continue;
      }

      for (const user of users) {
        await this.sendNewDiscussionNotification(
          user.email,
          user.id,
          topic,
          dao,
          discourseBaseUrl
        );
      }
    }
  }

  private async sendNewProposalNotification(
    email: string,
    userId: string,
    proposal: Selectable<Proposal>,
    dao: Selectable<Dao>
  ): Promise<void> {
    try {
      // Check if notification was already sent recently
      const recentNotifications =
        await this.userNotificationRepository.getRecentNotifications(
          userId,
          proposal.id,
          'new_proposal',
          this.config.notificationCooldownHours
        );

      if (recentNotifications.length > 0) {
        console.log(
          `Already sent new proposal notification to ${email} for proposal ${proposal.id}`
        );
        return;
      }

      // Generate idempotency key to prevent duplicate email sends
      const idempotencyKey = this.generateIdempotencyKey(
        userId,
        proposal.id,
        'new_proposal'
      );

      // Execute email send and notification recording in a transaction-like manner
      const executeEmailSend = async () => {
        await this.emailService.sendNewProposalEmail(
          email,
          {
            proposalName: proposal.name,
            proposalUrl: proposal.url,
            daoName: dao.name,
            authorAddress:
              proposal.author || '0x0000000000000000000000000000000000000000',
            authorEns: undefined, // Could be fetched from ENS service if needed
          },
          idempotencyKey
        );

        // Record notification only after successful email send
        await this.userNotificationRepository.createNotification(
          userId,
          proposal.id,
          'new_proposal'
        );
      };

      // Use circuit breaker if available, otherwise execute directly
      if (this.emailCircuitBreaker) {
        await this.emailCircuitBreaker.execute(() => executeEmailSend());
      } else {
        await executeEmailSend();
      }

      console.log(
        `Sent new proposal notification to ${email} for proposal ${proposal.id}`
      );
    } catch (error) {
      console.error(
        `Failed to send new proposal notification to ${email}:`,
        error
      );
    }
  }

  private async sendEndingProposalNotification(
    email: string,
    userId: string,
    proposal: Selectable<Proposal>,
    dao: Selectable<Dao>
  ): Promise<void> {
    try {
      // Check if notification was already sent recently
      const recentNotifications =
        await this.userNotificationRepository.getRecentNotifications(
          userId,
          proposal.id,
          'ending_proposal',
          this.config.notificationCooldownHours
        );

      if (recentNotifications.length > 0) {
        console.log(
          `Already sent ending proposal notification to ${email} for proposal ${proposal.id}`
        );
        return;
      }

      // Calculate time until end
      const endTime = formatDistanceStrict(
        new Date(proposal.endAt),
        new Date(),
        {
          addSuffix: false,
        }
      );

      // Generate idempotency key to prevent duplicate email sends
      const idempotencyKey = this.generateIdempotencyKey(
        userId,
        proposal.id,
        'ending_proposal'
      );

      // Execute email send and notification recording in a transaction-like manner
      const executeEmailSend = async () => {
        await this.emailService.sendEndingProposalEmail(
          email,
          {
            proposalName: proposal.name,
            proposalUrl: proposal.url,
            daoName: dao.name,
            endTime,
          },
          idempotencyKey
        );

        // Record notification only after successful email send
        await this.userNotificationRepository.createNotification(
          userId,
          proposal.id,
          'ending_proposal'
        );
      };

      // Use circuit breaker if available, otherwise execute directly
      if (this.emailCircuitBreaker) {
        await this.emailCircuitBreaker.execute(() => executeEmailSend());
      } else {
        await executeEmailSend();
      }

      console.log(
        `Sent ending proposal notification to ${email} for proposal ${proposal.id}`
      );
    } catch (error) {
      console.error(
        `Failed to send ending proposal notification to ${email}:`,
        error
      );
    }
  }

  private async sendNewDiscussionNotification(
    email: string,
    userId: string,
    topic: Selectable<DiscourseTopic> & {
      discourseUser: Selectable<DiscourseUser>;
    },
    dao: Selectable<Dao>,
    discourseBaseUrl: string
  ): Promise<void> {
    try {
      // Check if notification was already sent recently
      const recentNotifications =
        await this.userNotificationRepository.getRecentNotifications(
          userId,
          topic.id,
          'new_discussion',
          this.config.notificationCooldownHours
        );

      if (recentNotifications.length > 0) {
        console.log(
          `Already sent new discussion notification to ${email} for topic ${topic.id}`
        );
        return;
      }

      // Build discussion URL
      const discussionUrl = `${discourseBaseUrl}/t/${topic.slug}/${topic.externalId}`;
      // Avatar template is already a full URL processed by the indexer
      const authorProfilePicture = topic.discourseUser.avatarTemplate || '';

      // Generate idempotency key to prevent duplicate email sends
      const idempotencyKey = this.generateIdempotencyKey(
        userId,
        topic.id,
        'new_discussion'
      );

      // Execute email send and notification recording in a transaction-like manner
      const executeEmailSend = async () => {
        await this.emailService.sendNewDiscussionEmail(
          email,
          {
            discussionTitle: topic.title,
            discussionUrl,
            daoName: dao.name,
            authorUsername: topic.discourseUser.username,
            authorProfilePicture,
          },
          idempotencyKey
        );

        // Record notification only after successful email send
        await this.userNotificationRepository.createNotification(
          userId,
          topic.id,
          'new_discussion'
        );
      };

      // Use circuit breaker if available, otherwise execute directly
      if (this.emailCircuitBreaker) {
        await this.emailCircuitBreaker.execute(() => executeEmailSend());
      } else {
        await executeEmailSend();
      }

      console.log(
        `Sent new discussion notification to ${email} for topic ${topic.id}`
      );
    } catch (error) {
      console.error(
        `Failed to send new discussion notification to ${email}:`,
        error
      );
    }
  }

  /**
   * Generates an idempotency key for email notifications to prevent duplicate sends.
   * The key is based on user ID, target ID, notification type, and date.
   * Uses daily buckets with notification type to ensure consistent behavior.
   */
  private generateIdempotencyKey(
    userId: string,
    targetId: string,
    type: 'new_proposal' | 'ending_proposal' | 'new_discussion'
  ): string {
    // Use daily buckets to ensure retries within the same day use the same key
    // This prevents issues at hour boundaries while still allowing daily notifications
    const date = new Date();
    const dayBucket = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
    return `${userId}-${targetId}-${type}-${dayBucket}`;
  }
}
