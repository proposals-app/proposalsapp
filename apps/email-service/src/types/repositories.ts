import type {
  Selectable,
  Proposal,
  User,
  UserNotification,
  ProposalGroup,
  Dao,
  DiscourseTopic,
  DiscourseUser,
} from '@proposalsapp/db';

export interface IProposalRepository {
  getNewProposals(
    timeFrameInMinutes: number,
    daoId: string
  ): Promise<Selectable<Proposal>[]>;
  getEndingProposals(
    timeFrameInMinutes: number,
    daoId: string
  ): Promise<Selectable<Proposal>[]>;
}

export interface IUserNotificationRepository {
  getRecentNotifications(
    userId: string,
    targetId: string,
    type: string,
    hoursSince: number
  ): Promise<Selectable<UserNotification>[]>;
  createNotification(
    userId: string,
    targetId: string,
    type: string
  ): Promise<void>;
}

export interface IUserRepository {
  getUsersForNewProposalNotifications(
    daoSlug: string
  ): Promise<Selectable<User>[]>;
  getUsersForNewDiscussionNotifications(
    daoSlug: string
  ): Promise<Selectable<User>[]>;
  getUsersForEndingProposalNotifications(
    daoSlug: string
  ): Promise<Selectable<User>[]>;
}

export interface IDaoRepository {
  getEnabledDaos(): Promise<Selectable<Dao>[]>;
  getDaoBySlug(slug: string): Promise<Selectable<Dao> | undefined>;
}

export interface IDiscourseRepository {
  getNewTopics(
    timeFrameInMinutes: number,
    daoDiscourseId: string
  ): Promise<
    Array<
      Selectable<DiscourseTopic> & { discourseUser: Selectable<DiscourseUser> }
    >
  >;
}

export interface IProposalGroupRepository {
  getProposalGroupsByDiscourseUrl(
    url: string
  ): Promise<Selectable<ProposalGroup>[]>;
}
