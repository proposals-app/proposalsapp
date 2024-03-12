export declare const NotificationDispatchedState: {
    readonly NOT_DISPATCHED: "NOT_DISPATCHED";
    readonly FIRST_RETRY: "FIRST_RETRY";
    readonly SECOND_RETRY: "SECOND_RETRY";
    readonly THIRD_RETRY: "THIRD_RETRY";
    readonly DISPATCHED: "DISPATCHED";
    readonly DELETED: "DELETED";
    readonly FAILED: "FAILED";
};
export type NotificationDispatchedState = (typeof NotificationDispatchedState)[keyof typeof NotificationDispatchedState];
export declare const NotificationType: {
    readonly QUORUM_NOT_REACHED_EMAIL: "QUORUM_NOT_REACHED_EMAIL";
    readonly BULLETIN_EMAIL: "BULLETIN_EMAIL";
};
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];
export declare const DAOHandlerEnum: {
    readonly AAVE_V2_MAINNET: "AAVE_V2_MAINNET";
    readonly COMPOUND_MAINNET: "COMPOUND_MAINNET";
    readonly UNISWAP_MAINNET: "UNISWAP_MAINNET";
    readonly ENS_MAINNET: "ENS_MAINNET";
    readonly GITCOIN_MAINNET: "GITCOIN_MAINNET";
    readonly GITCOIN_V2_MAINNET: "GITCOIN_V2_MAINNET";
    readonly HOP_MAINNET: "HOP_MAINNET";
    readonly DYDX_MAINNET: "DYDX_MAINNET";
    readonly INTEREST_PROTOCOL_MAINNET: "INTEREST_PROTOCOL_MAINNET";
    readonly ZEROX_PROTOCOL_MAINNET: "ZEROX_PROTOCOL_MAINNET";
    readonly FRAX_ALPHA_MAINNET: "FRAX_ALPHA_MAINNET";
    readonly FRAX_OMEGA_MAINNET: "FRAX_OMEGA_MAINNET";
    readonly NOUNS_PROPOSALS_MAINNET: "NOUNS_PROPOSALS_MAINNET";
    readonly OP_OPTIMISM: "OP_OPTIMISM";
    readonly ARB_CORE_ARBITRUM: "ARB_CORE_ARBITRUM";
    readonly ARB_TREASURY_ARBITRUM: "ARB_TREASURY_ARBITRUM";
    readonly MAKER_EXECUTIVE_MAINNET: "MAKER_EXECUTIVE_MAINNET";
    readonly MAKER_POLL_MAINNET: "MAKER_POLL_MAINNET";
    readonly MAKER_POLL_ARBITRUM: "MAKER_POLL_ARBITRUM";
    readonly AAVE_V3_MAINNET: "AAVE_V3_MAINNET";
    readonly AAVE_V3_POLYGON_POS: "AAVE_V3_POLYGON_POS";
    readonly AAVE_V3_AVALANCHE: "AAVE_V3_AVALANCHE";
    readonly SNAPSHOT: "SNAPSHOT";
};
export type DAOHandlerEnum = (typeof DAOHandlerEnum)[keyof typeof DAOHandlerEnum];
export declare const ProposalStateEnum: {
    readonly PENDING: "PENDING";
    readonly ACTIVE: "ACTIVE";
    readonly CANCELED: "CANCELED";
    readonly DEFEATED: "DEFEATED";
    readonly SUCCEEDED: "SUCCEEDED";
    readonly QUEUED: "QUEUED";
    readonly EXPIRED: "EXPIRED";
    readonly EXECUTED: "EXECUTED";
    readonly HIDDEN: "HIDDEN";
    readonly UNKNOWN: "UNKNOWN";
};
export type ProposalStateEnum = (typeof ProposalStateEnum)[keyof typeof ProposalStateEnum];
//# sourceMappingURL=enums.d.ts.map