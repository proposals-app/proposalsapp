import type { ColumnType } from "kysely";

export enum DaoHandlerEnumV2 {
  AAVEV2MAINNET = "AAVE_V2_MAINNET",
  AAVEV3AVALANCHE = "AAVE_V3_AVALANCHE",
  AAVEV3MAINNET = "AAVE_V3_MAINNET",
  AAVEV3POLYGONPOS = "AAVE_V3_POLYGON_POS",
  ARBCOREARBITRUM = "ARB_CORE_ARBITRUM",
  ARBTREASURYARBITRUM = "ARB_TREASURY_ARBITRUM",
  COMPOUNDMAINNET = "COMPOUND_MAINNET",
  DYDXMAINNET = "DYDX_MAINNET",
  ENSMAINNET = "ENS_MAINNET",
  FRAXALPHAMAINNET = "FRAX_ALPHA_MAINNET",
  FRAXOMEGAMAINNET = "FRAX_OMEGA_MAINNET",
  GITCOINMAINNET = "GITCOIN_MAINNET",
  GITCOINV2MAINNET = "GITCOIN_V2_MAINNET",
  HOPMAINNET = "HOP_MAINNET",
  MAKEREXECUTIVEMAINNET = "MAKER_EXECUTIVE_MAINNET",
  MAKERPOLLARBITRUM = "MAKER_POLL_ARBITRUM",
  MAKERPOLLMAINNET = "MAKER_POLL_MAINNET",
  NOUNSPROPOSALSMAINNET = "NOUNS_PROPOSALS_MAINNET",
  OPOPTIMISM = "OP_OPTIMISM",
  SNAPSHOT = "SNAPSHOT",
  UNISWAPMAINNET = "UNISWAP_MAINNET",
}

export enum NotificationDispatchedStateEnum {
  DELETED = "DELETED",
  DISPATCHED = "DISPATCHED",
  FAILED = "FAILED",
  FIRSTRETRY = "FIRST_RETRY",
  NOTDISPATCHED = "NOT_DISPATCHED",
  SECONDRETRY = "SECOND_RETRY",
  THIRDRETRY = "THIRD_RETRY",
}

export enum NotificationTypeEnumV2 {
  EMAILBULLETIN = "EMAIL_BULLETIN",
  EMAILQUORUMNOTREACHED = "EMAIL_QUORUM_NOT_REACHED",
  EMAILTIMEEND = "EMAIL_TIMEEND",
  PUSHQUORUMNOTREACHED = "PUSH_QUORUM_NOT_REACHED",
  PUSHTIMEEND = "PUSH_TIMEEND",
}

export enum ProposalStateEnum {
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

export type Json = JsonValue;

export type JsonArray = JsonValue[];

export type JsonObject = {
  [K in string]?: JsonValue;
};

export type JsonPrimitive = boolean | number | string | null;

export type JsonValue = JsonArray | JsonObject | JsonPrimitive;

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export interface CountdownCache {
  id: Generated<string>;
  largeUrl: string;
  smallUrl: string;
  time: Timestamp;
}

export interface Dao {
  hot: Generated<boolean>;
  id: Generated<string>;
  name: string;
  slug: string;
}

export interface DaoHandler {
  daoId: string;
  governancePortal: Generated<string>;
  handlerType: DaoHandlerEnumV2;
  id: Generated<string>;
  proposalsIndex: Generated<number>;
  proposalsRefreshSpeed: Generated<number>;
  refreshEnabled: Generated<boolean>;
  votesIndex: Generated<number>;
  votesRefreshSpeed: Generated<number>;
}

export interface DaoSettings {
  backgroundColor: Generated<string>;
  daoId: string;
  id: Generated<string>;
  picture: string;
  quorumWarningEmailSupport: Generated<boolean>;
  twitterAccount: Json | null;
}

export interface EmailVerification {
  code: Generated<string>;
  email: string;
  expiresAt: Timestamp;
  id: Generated<string>;
  userId: string;
}

export interface Notification {
  dispatchstatus: Generated<NotificationDispatchedStateEnum>;
  id: Generated<string>;
  proposalId: string | null;
  submittedAt: Timestamp;
  type: NotificationTypeEnumV2 | null;
  userId: string | null;
}

export interface Proposal {
  blockCreated: number | null;
  body: string;
  choices: Generated<Json>;
  daoHandlerId: string;
  daoId: string;
  discussionUrl: string;
  externalId: string;
  flagged: Generated<boolean>;
  id: Generated<string>;
  indexCreated: Generated<number>;
  name: string;
  proposalState: ProposalStateEnum;
  quorum: number;
  scores: Generated<Json>;
  scoresQuorum: Generated<number>;
  scoresTotal: number;
  timeCreated: Timestamp | null;
  timeEnd: Timestamp;
  timeStart: Timestamp;
  url: string;
  votesFetched: Generated<boolean>;
  votesIndex: Generated<number>;
  votesRefreshSpeed: Generated<number>;
}

export interface Subscription {
  daoId: string;
  id: Generated<string>;
  userId: string;
}

export interface User {
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
  email: string;
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
  daoHandlerId: string;
  daoId: string;
  id: Generated<string>;
  indexCreated: Generated<number>;
  proposalExternalId: string;
  proposalId: string;
  reason: string | null;
  timeCreated: Timestamp | null;
  voterAddress: string;
  votingPower: number;
  vpState: string | null;
}

export interface Voter {
  address: string;
  ens: string | null;
  id: Generated<string>;
}

export interface DB {
  countdownCache: CountdownCache;
  dao: Dao;
  daoHandler: DaoHandler;
  daoSettings: DaoSettings;
  emailVerification: EmailVerification;
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
