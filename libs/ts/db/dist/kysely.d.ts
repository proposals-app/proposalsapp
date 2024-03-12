import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U> ? ColumnType<S, I | undefined, U> : ColumnType<T, T | undefined, T>;
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
    twitterAccount: Generated<unknown>;
};
export type notification = {
    id: string;
    userid: string | null;
    proposalid: string | null;
    type: NotificationType;
    dispatchstatus: Generated<NotificationDispatchedState>;
    decoder: Generated<unknown>;
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
    blockCreated: Generated<number>;
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
    address: string | null;
    email: string | null;
    acceptedTerms: Generated<number>;
    acceptedtermsTimestamp: Timestamp | null;
    firstActive: Generated<Timestamp>;
    lastActive: Generated<Timestamp>;
    sessionCount: Generated<number>;
};
export type user_settings = {
    id: Generated<string>;
    userId: string;
    emailDailyBulletin: Generated<number>;
    emptyDailyBulletin: Generated<number>;
    emailQuorumWarning: Generated<number>;
    discordNotifications: Generated<number>;
    discordReminders: Generated<number>;
    discordIncludevotes: Generated<number>;
    discordWebhook: Generated<string>;
    telegramNotifications: Generated<number>;
    telegramReminders: Generated<number>;
    telegramIncludeVotes: Generated<number>;
    telegramChatId: Generated<string>;
    telegramChatTitle: Generated<string>;
    slackNotifications: Generated<number>;
    slackReminders: Generated<number>;
    slackIncludevotes: Generated<number>;
    slackWebhook: Generated<string>;
    slackChannelname: Generated<string>;
};
export type user_to_voter = {
    id: Generated<string>;
    userId: string;
    voterId: string;
};
export type user_verification = {
    id: Generated<string>;
    userId: string;
    challengeCode: Generated<string>;
    verifiedAddress: Generated<number>;
    verifiedEmail: Generated<number>;
};
export type vote = {
    id: Generated<string>;
    indexCreated: Generated<number>;
    voterAddress: string;
    choice: Generated<unknown>;
    votingPower: number;
    reason: string | null;
    proposalExternalId: string;
    blockCreated: Generated<number>;
    timeCreated: Timestamp | null;
    vpState: string | null;
    proposalId: string;
    daoId: string;
    daoHandlerId: string;
};
export type voter = {
    id: Generated<string>;
    address: string;
};
export type DB = {
    dao: dao;
    daoHandler: dao_handler;
    daoSettings: dao_settings;
    notification: notification;
    proposal: proposal;
    subscription: subscription;
    user: user;
    userSettings: user_settings;
    userToVoter: user_to_voter;
    userVerification: user_verification;
    vote: vote;
    voter: voter;
};
//# sourceMappingURL=kysely.d.ts.map