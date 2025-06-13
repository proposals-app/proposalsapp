// Mock for @proposalsapp/db package to avoid database dependencies in Storybook

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
  // Add other event types as needed
};

// Mock any other exports from @proposalsapp/db that might be used in stories
export default {};