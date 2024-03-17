import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

import type { NotificationDispatchedState, NotificationType, DAOHandlerEnum, ProposalStateEnum } from "./enums";

export type dao = {
    id: Generated<string>;
    name: string;
};
export type dao_handler = {
    id: Generated<string>;
    handlerType: DAOHandlerEnum;
    decoder: Generated<unknown>;
    governancePortal: Generated<string>;
    proposalsRefreshSpeed: Generated<number>;
    votesRefreshSpeed: Generated<number>;
    proposalsIndex: Generated<number>;
    votesIndex: Generated<number>;
    daoId: string;
};
export type dao_settings = {
    id: Generated<string>;
    daoId: string;
    picture: string;
    backgroundColor: Generated<string>;
    quorumWarningEmailSupport: Generated<number>;
    twitterAccount: unknown | null;
};
export type email_verification = {
    id: Generated<string>;
    userId: string;
    code: Generated<string>;
    email: string;
    expiresAt: Timestamp;
};
export type notification = {
    id: Generated<string>;
    userId: string | null;
    proposalId: string | null;
    type: NotificationType;
    dispatchstatus: Generated<NotificationDispatchedState>;
    submittedAt: Timestamp;
};
export type proposal = {
    id: Generated<string>;
    indexCreated: Generated<number>;
    votesFetched: Generated<number>;
    votesRefreshSpeed: Generated<number>;
    votesIndex: Generated<number>;
    externalId: string;
    name: string;
    body: string;
    url: string;
    discussionUrl: string;
    choices: Generated<unknown>;
    scores: Generated<unknown>;
    scoresTotal: number;
    quorum: number;
    proposalState: ProposalStateEnum;
    flagged: Generated<number>;
    blockCreated: number | null;
    timeCreated: Timestamp | null;
    timeStart: Timestamp;
    timeEnd: Timestamp;
    daoHandlerId: string;
    daoId: string;
};
export type subscription = {
    id: Generated<string>;
    userId: string;
    daoId: string;
};
export type user = {
    id: Generated<string>;
    email: string;
    emailVerified: Generated<number>;
};
export type user_session = {
    id: Generated<string>;
    userId: string;
    email: string;
    expiresAt: Timestamp;
};
export type user_settings = {
    id: Generated<string>;
    userId: string;
    emailDailyBulletin: Generated<number>;
    emailQuorumWarning: Generated<number>;
    emailTimeendWarning: Generated<number>;
};
export type user_to_voter = {
    id: Generated<string>;
    userId: string;
    voterId: string;
};
export type vote = {
    id: Generated<string>;
    indexCreated: Generated<number>;
    voterAddress: string;
    choice: Generated<unknown>;
    votingPower: number;
    reason: string | null;
    proposalExternalId: string;
    blockCreated: number | null;
    timeCreated: Timestamp | null;
    vpState: string | null;
    proposalId: string;
    daoId: string;
    daoHandlerId: string;
};
export type voter = {
    id: Generated<string>;
    address: string;
    ens: string | null;
};
export type DB = {
    dao: dao;
    daoHandler: dao_handler;
    daoSettings: dao_settings;
    emailVerification: email_verification;
    notification: notification;
    proposal: proposal;
    subscription: subscription;
    user: user;
    userSession: user_session;
    userSettings: user_settings;
    userToVoter: user_to_voter;
    vote: vote;
    voter: voter;
};
