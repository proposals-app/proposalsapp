import type { ColumnType } from "kysely";

export enum IndexerType {
  PROPOSALS = "PROPOSALS",
  VOTES = "VOTES",
}

export enum IndexerVariant {
  AAVEV2MAINNETPROPOSALS = "AAVE_V2_MAINNET_PROPOSALS",
  AAVEV2MAINNETVOTES = "AAVE_V2_MAINNET_VOTES",
  AAVEV3AVALANCHEVOTES = "AAVE_V3_AVALANCHE_VOTES",
  AAVEV3MAINNETPROPOSALS = "AAVE_V3_MAINNET_PROPOSALS",
  AAVEV3MAINNETVOTES = "AAVE_V3_MAINNET_VOTES",
  AAVEV3POLYGONVOTES = "AAVE_V3_POLYGON_VOTES",
  ARBCOREARBITRUMPROPOSALS = "ARB_CORE_ARBITRUM_PROPOSALS",
  ARBCOREARBITRUMVOTES = "ARB_CORE_ARBITRUM_VOTES",
  ARBTREASURYARBITRUMPROPOSALS = "ARB_TREASURY_ARBITRUM_PROPOSALS",
  ARBTREASURYARBITRUMVOTES = "ARB_TREASURY_ARBITRUM_VOTES",
  COMPOUNDMAINNETPROPOSALS = "COMPOUND_MAINNET_PROPOSALS",
  COMPOUNDMAINNETVOTES = "COMPOUND_MAINNET_VOTES",
  DYDXMAINNETPROPOSALS = "DYDX_MAINNET_PROPOSALS",
  DYDXMAINNETVOTES = "DYDX_MAINNET_VOTES",
  ENSMAINNETPROPOSALS = "ENS_MAINNET_PROPOSALS",
  ENSMAINNETVOTES = "ENS_MAINNET_VOTES",
  FRAXALPHAMAINNETPROPOSALS = "FRAX_ALPHA_MAINNET_PROPOSALS",
  FRAXALPHAMAINNETVOTES = "FRAX_ALPHA_MAINNET_VOTES",
  FRAXOMEGAMAINNETPROPOSALS = "FRAX_OMEGA_MAINNET_PROPOSALS",
  FRAXOMEGAMAINNETVOTES = "FRAX_OMEGA_MAINNET_VOTES",
  GITCOINMAINNETPROPOSALS = "GITCOIN_MAINNET_PROPOSALS",
  GITCOINMAINNETVOTES = "GITCOIN_MAINNET_VOTES",
  GITCOINV2MAINNETPROPOSALS = "GITCOIN_V2_MAINNET_PROPOSALS",
  GITCOINV2MAINNETVOTES = "GITCOIN_V2_MAINNET_VOTES",
  HOPMAINNETPROPOSALS = "HOP_MAINNET_PROPOSALS",
  HOPMAINNETVOTES = "HOP_MAINNET_VOTES",
  MAKEREXECUTIVEMAINNETPROPOSALS = "MAKER_EXECUTIVE_MAINNET_PROPOSALS",
  MAKEREXECUTIVEMAINNETVOTES = "MAKER_EXECUTIVE_MAINNET_VOTES",
  MAKERPOLLARBITRUMVOTES = "MAKER_POLL_ARBITRUM_VOTES",
  MAKERPOLLMAINNETPROPOSALS = "MAKER_POLL_MAINNET_PROPOSALS",
  MAKERPOLLMAINNETVOTES = "MAKER_POLL_MAINNET_VOTES",
  NOUNSPROPOSALSMAINNETPROPOSALS = "NOUNS_PROPOSALS_MAINNET_PROPOSALS",
  NOUNSPROPOSALSMAINNETVOTES = "NOUNS_PROPOSALS_MAINNET_VOTES",
  OPOPTIMISMPROPOSALS = "OP_OPTIMISM_PROPOSALS",
  OPOPTIMISMVOTES = "OP_OPTIMISM_VOTES",
  SNAPSHOTPROPOSALS = "SNAPSHOT_PROPOSALS",
  SNAPSHOTVOTES = "SNAPSHOT_VOTES",
  UNISWAPMAINNETPROPOSALS = "UNISWAP_MAINNET_PROPOSALS",
  UNISWAPMAINNETVOTES = "UNISWAP_MAINNET_VOTES",
}

export enum NotificationDispatchStatusEnum {
  DISPATCHED = "DISPATCHED",
  FAILED = "FAILED",
  NOTDISPATCHED = "NOT_DISPATCHED",
}

export enum NotificationTypeEnum {
  EMAILBULLETIN = "EMAIL_BULLETIN",
  EMAILQUORUMNOTREACHED = "EMAIL_QUORUM_NOT_REACHED",
  EMAILTIMEEND = "EMAIL_TIMEEND",
  PUSHQUORUMNOTREACHED = "PUSH_QUORUM_NOT_REACHED",
  PUSHTIMEEND = "PUSH_TIMEEND",
}

export enum ProposalState {
  ACTIVE = "ACTIVE",
  CANCELED = "CANCELED",
  DEFEATED = "DEFEATED",
  EXECUTED = "EXECUTED",
  EXPIRED = "EXPIRED",
  HIDDEN = "HIDDEN",
  PENDING = "PENDING",
  QUEUED = "QUEUED",
  SUCCEEDED = "SUCCEEDED",
  UNKNOWN = "UNKNOWN",
}

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export type Int8 = ColumnType<string, bigint | number | string, bigint | number | string>;

export type Json = JsonValue;

export type JsonArray = JsonValue[];

export type JsonObject = {
  [K in string]?: JsonValue;
};

export type JsonPrimitive = boolean | number | string | null;

export type JsonValue = JsonArray | JsonObject | JsonPrimitive;

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export interface Dao {
  backgroundColor: Generated<string>;
  emailQuorumWarningSupport: Generated<boolean>;
  hot: Generated<boolean>;
  id: Generated<string>;
  name: string;
  picture: string;
  slug: string;
}

export interface DaoDiscourse {
  daoId: string;
  discourseBaseUrl: string;
  enabled: Generated<boolean>;
  id: Generated<string>;
}

export interface DaoIndexer {
  daoId: string;
  enabled: Generated<boolean>;
  id: Generated<string>;
  index: Generated<number>;
  indexerType: IndexerType;
  indexerVariant: IndexerVariant;
  portalUrl: string | null;
  speed: Generated<number>;
}

export interface DiscourseCategory {
  color: string;
  daoDiscourseId: string;
  description: string | null;
  descriptionText: string | null;
  externalId: number;
  id: Generated<string>;
  name: string;
  postCount: number;
  slug: string;
  textColor: string;
  topicCount: number;
  topicsAllTime: number | null;
  topicsDay: number | null;
  topicsMonth: number | null;
  topicsWeek: number | null;
  topicsYear: number | null;
}

export interface DiscoursePost {
  cooked: string;
  createdAt: Timestamp;
  daoDiscourseId: string;
  displayUsername: string | null;
  externalId: number;
  flairBgColor: string | null;
  flairColor: string | null;
  flairName: string | null;
  flairUrl: string | null;
  id: Generated<string>;
  incomingLinkCount: number;
  name: string | null;
  postNumber: number;
  postType: number;
  primaryGroupName: string | null;
  quoteCount: number;
  readersCount: number;
  reads: number;
  replyCount: number;
  replyToPostNumber: number | null;
  score: number;
  topicId: number;
  topicSlug: string;
  updatedAt: Timestamp;
  userId: number;
  username: string;
  version: number;
}

export interface DiscourseTopic {
  archived: boolean;
  bumpedAt: Timestamp;
  categoryId: number;
  closed: boolean;
  createdAt: Timestamp;
  daoDiscourseId: string;
  externalId: number;
  fancyTitle: string;
  id: Generated<string>;
  lastPostedAt: Timestamp;
  likeCount: number;
  pinned: boolean;
  pinnedGlobally: boolean;
  postsCount: number;
  replyCount: number;
  slug: string;
  title: string;
  views: number;
  visible: boolean;
}

export interface DiscourseUser {
  avatarTemplate: string;
  daoDiscourseId: string;
  daysVisited: Int8 | null;
  externalId: number;
  id: Generated<string>;
  likesGiven: Int8 | null;
  likesReceived: Int8 | null;
  name: string | null;
  postCount: Int8 | null;
  postsRead: Int8 | null;
  title: string | null;
  topicCount: Int8 | null;
  topicsEntered: Int8 | null;
  username: string;
}

export interface EmailVerification {
  code: string;
  createdAt: Generated<Timestamp>;
  expiresAt: Timestamp;
  id: Generated<string>;
  userId: string;
}

export interface JobQueue {
  createdAt: Generated<Timestamp | null>;
  id: Generated<number>;
  job: Json;
  jobType: string;
  processed: Generated<boolean | null>;
}

export interface Notification {
  dispatchedAt: Timestamp | null;
  dispatchStatus: Generated<NotificationDispatchStatusEnum>;
  id: Generated<string>;
  proposalId: string;
  type: NotificationTypeEnum;
  userId: string;
}

export interface Proposal {
  blockCreated: number | null;
  body: string;
  choices: Generated<Json>;
  daoId: string;
  daoIndexerId: string;
  discussionUrl: string;
  externalId: string;
  id: Generated<string>;
  indexCreated: Generated<number>;
  markedSpam: Generated<boolean>;
  metadata: Json | null;
  name: string;
  proposalState: ProposalState;
  quorum: number;
  scores: Generated<Json>;
  scoresQuorum: number;
  scoresTotal: number;
  timeCreated: Timestamp;
  timeEnd: Timestamp;
  timeStart: Timestamp;
  txid: string | null;
  url: string;
}

export interface Subscription {
  createdAt: Generated<Timestamp>;
  daoId: string;
  id: Generated<string>;
  userId: string;
}

export interface User {
  createdAt: Generated<Timestamp>;
  email: string;
  emailVerified: Generated<boolean>;
  id: Generated<string>;
}

export interface UserPushNotificationSubscription {
  auth: string;
  endpoint: string;
  id: Generated<string>;
  p256dh: string;
  userId: string;
}

export interface UserSession {
  createdAt: Generated<Timestamp>;
  expiresAt: Timestamp;
  id: string;
  userId: string;
}

export interface UserSettings {
  emailDailyBulletin: Generated<boolean>;
  emailQuorumWarning: Generated<boolean>;
  emailTimeendWarning: Generated<boolean>;
  id: Generated<string>;
  pushNotifications: Generated<boolean>;
  userId: string;
}

export interface UserToVoter {
  id: Generated<string>;
  userId: string;
  voterId: string;
}

export interface Vote {
  blockCreated: number | null;
  choice: Generated<Json>;
  daoId: string;
  id: Generated<string>;
  indexCreated: Generated<number>;
  indexerId: string;
  proposalExternalId: string;
  proposalId: string;
  reason: string | null;
  timeCreated: Timestamp | null;
  txid: string | null;
  voterAddress: string;
  votingPower: number;
}

export interface Voter {
  address: string;
  ens: string | null;
  id: Generated<string>;
}

export interface DB {
  dao: Dao;
  daoDiscourse: DaoDiscourse;
  daoIndexer: DaoIndexer;
  discourseCategory: DiscourseCategory;
  discoursePost: DiscoursePost;
  discourseTopic: DiscourseTopic;
  discourseUser: DiscourseUser;
  emailVerification: EmailVerification;
  jobQueue: JobQueue;
  notification: Notification;
  proposal: Proposal;
  subscription: Subscription;
  user: User;
  userPushNotificationSubscription: UserPushNotificationSubscription;
  userSession: UserSession;
  userSettings: UserSettings;
  userToVoter: UserToVoter;
  vote: Vote;
  voter: Voter;
}
