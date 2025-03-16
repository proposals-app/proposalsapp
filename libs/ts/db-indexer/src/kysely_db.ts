/**
 * This file was generated by kysely-codegen.
 * Please do not edit it manually.
 */

import type { ColumnType } from "kysely";

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

export type Numeric = ColumnType<string, number | string, number | string>;

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export interface Dao {
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
  withUserAgent: Generated<boolean>;
}

export interface DaoGovernor {
  daoId: string;
  enabled: Generated<boolean>;
  id: Generated<string>;
  metadata: Generated<Json>;
  name: string;
  portalUrl: string | null;
  type: string;
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
  cooked: string | null;
  createdAt: Timestamp;
  daoDiscourseId: string;
  deleted: Generated<boolean>;
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

export interface DiscoursePostLike {
  createdAt: Timestamp;
  daoDiscourseId: string;
  externalDiscoursePostId: number;
  externalUserId: number;
  id: Generated<string>;
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

export interface JobQueue {
  createdAt: Generated<Timestamp>;
  data: Json;
  id: Generated<number>;
  status: Generated<string>;
  type: string;
}

export interface Proposal {
  author: string | null;
  blockCreatedAt: number | null;
  body: string;
  choices: Generated<Json>;
  createdAt: Timestamp;
  daoId: string;
  discussionUrl: string | null;
  endAt: Timestamp;
  externalId: string;
  governorId: string;
  id: Generated<string>;
  markedSpam: Generated<boolean>;
  metadata: Json | null;
  name: string;
  proposalState: ProposalState;
  quorum: number;
  startAt: Timestamp;
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

export interface RindexerInternalRindexerArbitrumCoreGovernorProposalCreated {
  lastSyncedBlock: Numeric | null;
  network: string;
}

export interface RindexerInternalRindexerArbitrumCoreGovernorProposalExecuted {
  lastSyncedBlock: Numeric | null;
  network: string;
}

export interface RindexerInternalRindexerArbitrumCoreGovernorProposalExtended {
  lastSyncedBlock: Numeric | null;
  network: string;
}

export interface RindexerInternalRindexerArbitrumCoreGovernorVoteCast {
  lastSyncedBlock: Numeric | null;
  network: string;
}

export interface RindexerInternalRindexerArbitrumCoreGovernorVoteCastWithParams {
  lastSyncedBlock: Numeric | null;
  network: string;
}

export interface RindexerInternalRindexerArbitrumScNominationsProposalCreated {
  lastSyncedBlock: Numeric | null;
  network: string;
}

export interface RindexerInternalRindexerArbitrumScNominationsProposalExecuted {
  lastSyncedBlock: Numeric | null;
  network: string;
}

export interface RindexerInternalRindexerArbitrumTreasuryGovernorProposalCreated {
  lastSyncedBlock: Numeric | null;
  network: string;
}

export interface RindexerInternalRindexerArbitrumTreasuryGovernorProposalExecuted {
  lastSyncedBlock: Numeric | null;
  network: string;
}

export interface RindexerInternalRindexerArbitrumTreasuryGovernorProposalExtended {
  lastSyncedBlock: Numeric | null;
  network: string;
}

export interface RindexerInternalRindexerArbitrumTreasuryGovernorVoteCast {
  lastSyncedBlock: Numeric | null;
  network: string;
}

export interface RindexerInternalRindexerArbitrumTreasuryGovernorVoteCastWithParams {
  lastSyncedBlock: Numeric | null;
  network: string;
}

export interface RindexerInternalRindexerArbTokenDelegateChanged {
  lastSyncedBlock: Numeric | null;
  network: string;
}

export interface RindexerInternalRindexerArbTokenDelegateVotesChanged {
  lastSyncedBlock: Numeric | null;
  network: string;
}

export interface RindexerInternalRindexerLastKnownIndexesDroppingSql {
  key: number;
  value: string;
}

export interface RindexerInternalRindexerLastKnownRelationshipDroppingSql {
  key: number;
  value: string;
}

export interface Vote {
  blockCreatedAt: number | null;
  choice: Generated<Json>;
  createdAt: Generated<Timestamp>;
  daoId: string;
  governorId: string;
  id: Generated<string>;
  proposalExternalId: string;
  proposalId: string;
  reason: string | null;
  txid: string | null;
  voterAddress: string;
  votingPower: number;
}

export interface Voter {
  address: string;
  avatar: string | null;
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
  daoGovernor: DaoGovernor;
  delegate: Delegate;
  delegateToDiscourseUser: DelegateToDiscourseUser;
  delegateToVoter: DelegateToVoter;
  delegation: Delegation;
  discourseCategory: DiscourseCategory;
  discoursePost: DiscoursePost;
  discoursePostLike: DiscoursePostLike;
  discoursePostRevision: DiscoursePostRevision;
  discourseTopic: DiscourseTopic;
  discourseUser: DiscourseUser;
  jobQueue: JobQueue;
  proposal: Proposal;
  proposalGroup: ProposalGroup;
  "rindexerInternal.rindexerArbitrumCoreGovernorProposalCreated": RindexerInternalRindexerArbitrumCoreGovernorProposalCreated;
  "rindexerInternal.rindexerArbitrumCoreGovernorProposalExecuted": RindexerInternalRindexerArbitrumCoreGovernorProposalExecuted;
  "rindexerInternal.rindexerArbitrumCoreGovernorProposalExtended": RindexerInternalRindexerArbitrumCoreGovernorProposalExtended;
  "rindexerInternal.rindexerArbitrumCoreGovernorVoteCast": RindexerInternalRindexerArbitrumCoreGovernorVoteCast;
  "rindexerInternal.rindexerArbitrumCoreGovernorVoteCastWithParams": RindexerInternalRindexerArbitrumCoreGovernorVoteCastWithParams;
  "rindexerInternal.rindexerArbitrumScNominationsProposalCreated": RindexerInternalRindexerArbitrumScNominationsProposalCreated;
  "rindexerInternal.rindexerArbitrumScNominationsProposalExecuted": RindexerInternalRindexerArbitrumScNominationsProposalExecuted;
  "rindexerInternal.rindexerArbitrumTreasuryGovernorProposalCreated": RindexerInternalRindexerArbitrumTreasuryGovernorProposalCreated;
  "rindexerInternal.rindexerArbitrumTreasuryGovernorProposalExecuted": RindexerInternalRindexerArbitrumTreasuryGovernorProposalExecuted;
  "rindexerInternal.rindexerArbitrumTreasuryGovernorProposalExtended": RindexerInternalRindexerArbitrumTreasuryGovernorProposalExtended;
  "rindexerInternal.rindexerArbitrumTreasuryGovernorVoteCast": RindexerInternalRindexerArbitrumTreasuryGovernorVoteCast;
  "rindexerInternal.rindexerArbitrumTreasuryGovernorVoteCastWithParams": RindexerInternalRindexerArbitrumTreasuryGovernorVoteCastWithParams;
  "rindexerInternal.rindexerArbTokenDelegateChanged": RindexerInternalRindexerArbTokenDelegateChanged;
  "rindexerInternal.rindexerArbTokenDelegateVotesChanged": RindexerInternalRindexerArbTokenDelegateVotesChanged;
  "rindexerInternal.rindexerLastKnownIndexesDroppingSql": RindexerInternalRindexerLastKnownIndexesDroppingSql;
  "rindexerInternal.rindexerLastKnownRelationshipDroppingSql": RindexerInternalRindexerLastKnownRelationshipDroppingSql;
  vote: Vote;
  voter: Voter;
  votingPower: VotingPower;
}
