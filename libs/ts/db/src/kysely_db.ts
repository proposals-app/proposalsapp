/**
 * This file was generated by kysely-codegen.
 * Please do not edit it manually.
 */

import type { ColumnType } from "kysely";

export enum IndexerType {
  DELEGATION = "DELEGATION",
  PROPOSALS = "PROPOSALS",
  PROPOSALS_AND_VOTES = "PROPOSALS_AND_VOTES",
  VOTES = "VOTES",
  VOTING_POWER = "VOTING_POWER",
}

export enum IndexerVariant {
  AAVE_V_2_MAINNET_PROPOSALS = "AAVE_V2_MAINNET_PROPOSALS",
  AAVE_V_2_MAINNET_VOTES = "AAVE_V2_MAINNET_VOTES",
  AAVE_V_3_AVALANCHE_VOTES = "AAVE_V3_AVALANCHE_VOTES",
  AAVE_V_3_MAINNET_PROPOSALS = "AAVE_V3_MAINNET_PROPOSALS",
  AAVE_V_3_MAINNET_VOTES = "AAVE_V3_MAINNET_VOTES",
  AAVE_V_3_POLYGON_VOTES = "AAVE_V3_POLYGON_VOTES",
  ARB_ARBITRUM_DELEGATION = "ARB_ARBITRUM_DELEGATION",
  ARB_ARBITRUM_VOTING_POWER = "ARB_ARBITRUM_VOTING_POWER",
  ARB_CORE_ARBITRUM_PROPOSALS = "ARB_CORE_ARBITRUM_PROPOSALS",
  ARB_CORE_ARBITRUM_VOTES = "ARB_CORE_ARBITRUM_VOTES",
  ARB_TREASURY_ARBITRUM_PROPOSALS = "ARB_TREASURY_ARBITRUM_PROPOSALS",
  ARB_TREASURY_ARBITRUM_VOTES = "ARB_TREASURY_ARBITRUM_VOTES",
  ARBITRUM_COUNCIL_ELECTIONS = "ARBITRUM_COUNCIL_ELECTIONS",
  ARBITRUM_COUNCIL_NOMINATIONS = "ARBITRUM_COUNCIL_NOMINATIONS",
  COMPOUND_MAINNET_PROPOSALS = "COMPOUND_MAINNET_PROPOSALS",
  COMPOUND_MAINNET_VOTES = "COMPOUND_MAINNET_VOTES",
  DYDX_MAINNET_PROPOSALS = "DYDX_MAINNET_PROPOSALS",
  DYDX_MAINNET_VOTES = "DYDX_MAINNET_VOTES",
  ENS_MAINNET_PROPOSALS = "ENS_MAINNET_PROPOSALS",
  ENS_MAINNET_VOTES = "ENS_MAINNET_VOTES",
  FRAX_ALPHA_MAINNET_PROPOSALS = "FRAX_ALPHA_MAINNET_PROPOSALS",
  FRAX_ALPHA_MAINNET_VOTES = "FRAX_ALPHA_MAINNET_VOTES",
  FRAX_OMEGA_MAINNET_PROPOSALS = "FRAX_OMEGA_MAINNET_PROPOSALS",
  FRAX_OMEGA_MAINNET_VOTES = "FRAX_OMEGA_MAINNET_VOTES",
  GITCOIN_MAINNET_PROPOSALS = "GITCOIN_MAINNET_PROPOSALS",
  GITCOIN_MAINNET_VOTES = "GITCOIN_MAINNET_VOTES",
  GITCOIN_V_2_MAINNET_PROPOSALS = "GITCOIN_V2_MAINNET_PROPOSALS",
  GITCOIN_V_2_MAINNET_VOTES = "GITCOIN_V2_MAINNET_VOTES",
  HOP_MAINNET_PROPOSALS = "HOP_MAINNET_PROPOSALS",
  HOP_MAINNET_VOTES = "HOP_MAINNET_VOTES",
  MAKER_EXECUTIVE_MAINNET_PROPOSALS = "MAKER_EXECUTIVE_MAINNET_PROPOSALS",
  MAKER_EXECUTIVE_MAINNET_VOTES = "MAKER_EXECUTIVE_MAINNET_VOTES",
  MAKER_POLL_ARBITRUM_VOTES = "MAKER_POLL_ARBITRUM_VOTES",
  MAKER_POLL_MAINNET_PROPOSALS = "MAKER_POLL_MAINNET_PROPOSALS",
  MAKER_POLL_MAINNET_VOTES = "MAKER_POLL_MAINNET_VOTES",
  NOUNS_PROPOSALS_MAINNET_PROPOSALS = "NOUNS_PROPOSALS_MAINNET_PROPOSALS",
  NOUNS_PROPOSALS_MAINNET_VOTES = "NOUNS_PROPOSALS_MAINNET_VOTES",
  OP_OPTIMISM_PROPOSALS = "OP_OPTIMISM_PROPOSALS",
  OP_OPTIMISM_VOTES = "OP_OPTIMISM_VOTES",
  SNAPSHOT_PROPOSALS = "SNAPSHOT_PROPOSALS",
  SNAPSHOT_VOTES = "SNAPSHOT_VOTES",
  UNISWAP_MAINNET_PROPOSALS = "UNISWAP_MAINNET_PROPOSALS",
  UNISWAP_MAINNET_VOTES = "UNISWAP_MAINNET_VOTES",
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
  [x: string]: JsonValue | undefined;
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
  updatedAt: Generated<Timestamp>;
}

export interface Delegate {
  daoId: string;
  id: Generated<string>;
}

export interface DelegateToDiscourseUser {
  createdAt: Generated<Timestamp>;
  delegateId: string;
  discourseUserId: string;
  id: Generated<string>;
  periodEnd: Timestamp;
  periodStart: Timestamp;
  proof: Json | null;
  verified: Generated<boolean>;
}

export interface DelegateToVoter {
  createdAt: Generated<Timestamp>;
  delegateId: string;
  id: Generated<string>;
  periodEnd: Timestamp;
  periodStart: Timestamp;
  proof: Json | null;
  verified: Generated<boolean>;
  voterId: string;
}

export interface Delegation {
  block: number;
  daoId: string;
  delegate: string;
  delegator: string;
  id: Generated<string>;
  timestamp: Generated<Timestamp>;
  txid: string | null;
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
  canViewEditHistory: Generated<boolean>;
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

export interface DiscoursePostRevision {
  bodyChanges: string;
  cookedBodyAfter: string | null;
  cookedBodyBefore: string | null;
  cookedTitleAfter: string | null;
  cookedTitleBefore: string | null;
  createdAt: Timestamp;
  daoDiscourseId: string;
  discoursePostId: string;
  editReason: string | null;
  externalPostId: number;
  id: Generated<string>;
  titleChanges: string | null;
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
  email: string;
  expiresAt: Timestamp;
  id: Generated<string>;
  userId: string;
}

export interface JobQueue {
  createdAt: Generated<Timestamp>;
  data: Json;
  id: Generated<number>;
  status: Generated<string>;
  type: string;
}

export interface Proposal {
  author: string | null;
  blockCreated: number | null;
  body: string;
  choices: Generated<Json>;
  daoId: string;
  daoIndexerId: string;
  discussionUrl: string | null;
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

export interface ProposalGroup {
  createdAt: Generated<Timestamp>;
  daoId: Generated<string>;
  id: Generated<string>;
  items: Generated<Json>;
  name: string;
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
  onboardingStep: Generated<number>;
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
  email: string | null;
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

export interface VotingPower {
  block: number;
  daoId: string;
  id: Generated<string>;
  timestamp: Generated<Timestamp>;
  txid: string | null;
  voter: string;
  votingPower: number;
}

export interface DB {
  dao: Dao;
  daoDiscourse: DaoDiscourse;
  daoIndexer: DaoIndexer;
  delegate: Delegate;
  delegateToDiscourseUser: DelegateToDiscourseUser;
  delegateToVoter: DelegateToVoter;
  delegation: Delegation;
  discourseCategory: DiscourseCategory;
  discoursePost: DiscoursePost;
  discoursePostRevision: DiscoursePostRevision;
  discourseTopic: DiscourseTopic;
  discourseUser: DiscourseUser;
  emailVerification: EmailVerification;
  jobQueue: JobQueue;
  proposal: Proposal;
  proposalGroup: ProposalGroup;
  subscription: Subscription;
  user: User;
  userPushNotificationSubscription: UserPushNotificationSubscription;
  userSession: UserSession;
  userSettings: UserSettings;
  userToVoter: UserToVoter;
  vote: Vote;
  voter: Voter;
  votingPower: VotingPower;
}
