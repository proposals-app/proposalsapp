import { db, type Kysely, type DB } from '@proposalsapp/db';
import { ProposalRepository } from '../repositories/ProposalRepository';
import { UserNotificationRepository } from '../repositories/UserNotificationRepository';
import { UserRepository } from '../repositories/UserRepository';
import { DaoRepository } from '../repositories/DaoRepository';
import { DiscourseRepository } from '../repositories/DiscourseRepository';
import { ProposalGroupRepository } from '../repositories/ProposalGroupRepository';
import { EmailService } from './EmailService';
import { ResendEmailClient } from './ResendEmailClient';
import {
  NotificationService,
  type NotificationConfig,
} from './NotificationService';
import type {
  IProposalRepository,
  IUserNotificationRepository,
  IUserRepository,
  IDaoRepository,
  IDiscourseRepository,
  IProposalGroupRepository,
} from '../types/repositories';
import type { IEmailService } from '../types/services';

export interface DependencyContainerConfig {
  resendApiKey: string;
  fromEmail?: string;
  notificationConfig: NotificationConfig;
}

export class DependencyContainer {
  private proposalRepository: IProposalRepository;
  private userNotificationRepository: IUserNotificationRepository;
  private userRepositories: Map<string, IUserRepository> = new Map();
  private daoRepository: IDaoRepository;
  private discourseRepository: IDiscourseRepository;
  private proposalGroupRepository: IProposalGroupRepository;
  private emailService: IEmailService;

  constructor(
    private config: DependencyContainerConfig,
    private databases: {
      public: Kysely<DB>;
      [daoSlug: string]: Kysely<DB>;
    } = db
  ) {
    // Initialize repositories with public database
    this.proposalRepository = new ProposalRepository(this.databases.public);
    this.userNotificationRepository = new UserNotificationRepository(
      this.databases.public
    );
    this.daoRepository = new DaoRepository(this.databases.public);
    this.discourseRepository = new DiscourseRepository(this.databases.public);
    this.proposalGroupRepository = new ProposalGroupRepository(
      this.databases.public
    );

    // Initialize email service
    const emailClient = new ResendEmailClient(this.config.resendApiKey);
    this.emailService = new EmailService(emailClient, this.config.fromEmail);
  }

  getProposalRepository(): IProposalRepository {
    return this.proposalRepository;
  }

  getUserNotificationRepository(): IUserNotificationRepository {
    return this.userNotificationRepository;
  }

  getUserRepository(daoSlug: string): IUserRepository {
    if (!this.userRepositories.has(daoSlug)) {
      const daoDb = this.databases[daoSlug];
      if (!daoDb) {
        throw new Error(`Database for DAO ${daoSlug} not found`);
      }
      this.userRepositories.set(daoSlug, new UserRepository(daoDb));
    }
    return this.userRepositories.get(daoSlug)!;
  }

  getDaoRepository(): IDaoRepository {
    return this.daoRepository;
  }

  getDiscourseRepository(): IDiscourseRepository {
    return this.discourseRepository;
  }

  getProposalGroupRepository(): IProposalGroupRepository {
    return this.proposalGroupRepository;
  }

  getEmailService(): IEmailService {
    return this.emailService;
  }

  getNotificationService(daoSlug: string): NotificationService {
    // Create a new instance with the correct user repository for the DAO
    return new NotificationService(
      this.proposalRepository,
      this.userNotificationRepository,
      this.getUserRepository(daoSlug),
      this.daoRepository,
      this.discourseRepository,
      this.proposalGroupRepository,
      this.emailService,
      this.config.notificationConfig
    );
  }
}
