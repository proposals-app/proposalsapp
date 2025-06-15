// Mock for @proposalsapp/db package to avoid database dependencies in Storybook

// Mock the complete database module
export const db = {
  public: {},
  arbitrum: {},
  uniswap: {},
};

export const dbPool = {
  public: {},
  arbitrum: {},
  uniswap: {},
};

export const ProposalState = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  CANCELLED: 'CANCELLED',
  DEFEATED: 'DEFEATED',
  SUCCEEDED: 'SUCCEEDED',
  QUEUED: 'QUEUED',
  EXPIRED: 'EXPIRED',
  EXECUTED: 'EXECUTED',
};

export const TimelineEventType = {
  ResultOngoingBasicVote: 'ResultOngoingBasicVote',
  ResultCompletedBasicVote: 'ResultCompletedBasicVote',
  ResultEndedBasicVote: 'ResultEndedBasicVote',
  ResultEndedOtherVotes: 'ResultEndedOtherVotes',
  Basic: 'Basic',
  CommentsVolume: 'CommentsVolume',
  VotesVolume: 'VotesVolume',
};

// Mock Kysely
export class Kysely {
  constructor() {}
  withSchema() {
    return this;
  }
  selectFrom() {
    return this;
  }
  select() {
    return this;
  }
  where() {
    return this;
  }
  execute() {
    return Promise.resolve([]);
  }
}

export const sql = {
  ref: () => ({}),
  raw: () => ({}),
};

export const traverseJSON = () => ({});

// Mock any other common database exports
export const jsonArrayFrom = () => Promise.resolve([]);

// Ensure all common database types are available
export const Selectable = {};
export const Insertable = {};
export const SelectQueryBuilder = {};

// Mock any other exports that might be needed
export default {
  db,
  dbPool,
  ProposalState,
  TimelineEventType,
  Kysely,
  sql,
  traverseJSON,
  jsonArrayFrom,
};
