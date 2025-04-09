import { VoteButton } from './vote-button';
import '@/styles/globals.css';
import { Story } from '@ladle/react';
import { JsonValue } from '@proposalsapp/db-indexer';

enum ProposalState {
  ACTIVE = 'ACTIVE',
  CANCELED = 'CANCELED',
  DEFEATED = 'DEFEATED',
  EXECUTED = 'EXECUTED',
  EXPIRED = 'EXPIRED',
  HIDDEN = 'HIDDEN',
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  SUCCEEDED = 'SUCCEEDED',
  UNKNOWN = 'UNKNOWN',
}

// Corrected MockProposalMetadata to include index signature
interface MockProposalMetadata {
  voteType?:
    | 'single-choice'
    | 'weighted'
    | 'approval'
    | 'basic'
    | 'quadratic'
    | 'ranked-choice';
  hiddenVote?: boolean;
  scoresState?: 'pending' | 'final'; // Simplified
  totalDelegatedVp?: string;
  quorumChoices?: number[];
  // Add index signature to match JsonObject
  [key: string]: JsonValue | undefined | number[] | string[] | boolean;
}

interface MockProposal {
  id: string;
  externalId: string;
  governorId: string;
  daoId: string;
  name: string;
  body: string;
  author: string;
  url: string;
  startAt: Date;
  createdAt: Date;
  endAt: Date;
  blockCreatedAt: number | null;
  markedSpam: boolean;
  quorum: number;
  blockStartAt: number | null;
  blockEndAt: number | null;
  proposalState: ProposalState; // Use mock state type
  discussionUrl: string | null;
  txid: string | null;
  choices: string[] | JsonValue; // Allow string array or JsonValue for flexibility
  metadata: MockProposalMetadata | JsonValue | null; // Allow mock type or JsonValue
}

// --- Mock Data Generation Function using Mock Types ---
const baseProposal: Omit<
  MockProposal,
  'id' | 'metadata' | 'choices' | 'endAt' | 'proposalState'
> = {
  externalId: 'prop-123',
  governorId: 'gov-abc',
  daoId: 'dao-xyz',
  name: 'Sample Proposal Title For Ladle',
  body: 'This is the proposal description used within Ladle.',
  author: '0x123...abc',
  url: 'https://example.com/proposal/123',
  startAt: new Date(Date.now() - 86400000), // Started yesterday
  createdAt: new Date(Date.now() - 2 * 86400000),
  blockCreatedAt: 12345678,
  markedSpam: false,
  quorum: 1000000,
  blockStartAt: null,
  blockEndAt: null,
  discussionUrl: null,
  txid: null,
};

const createMockProposal = (
  id: string,
  voteType: MockProposalMetadata['voteType'],
  choices: string[],
  ended = false
): MockProposal => ({
  ...baseProposal,
  id: `prop-${id}`,
  // Kysely expects 'choices' to potentially be JSON, but VoteButton logic uses string[].
  // We cast here, assuming the logic inside VoteButton handles string[] correctly.
  choices: choices as string[],
  metadata: {
    voteType: voteType,
    hiddenVote: false,
    scoresState: ended ? 'final' : 'pending',
  } as MockProposalMetadata, // Cast to our mock type which now fits JsonObject
  endAt: ended
    ? new Date(Date.now() - 1000) // Ended 1 second ago
    : new Date(Date.now() + 86400000 * 2), // Ends in 2 days
  proposalState: ended ? ProposalState.EXECUTED : ProposalState.ACTIVE,
});

// --- Mock Proposals for Stories ---
const basicProposal = createMockProposal('basic', 'basic', [
  'For',
  'Against',
  'Abstain',
]);
const approvalProposal = createMockProposal('approval', 'approval', [
  'Approve Project X',
  'Approve Project Y',
  'Approve Project Z',
]);
const weightedProposal = createMockProposal('weighted', 'weighted', [
  'Option 1 (weighted)',
  'Option 2 (weighted)',
  'Option 3 (weighted)',
]);
const rankedProposal = createMockProposal('ranked-choice', 'ranked-choice', [
  'Option 1 (Rank)',
  'Option 2 (Rank)',
  'Option 3 (Rank)',
]);
const quadraticProposal = createMockProposal('quadratic', 'quadratic', [
  'Fund Initiative',
  'Do Not Fund',
]);
const endedProposal = createMockProposal(
  'ended',
  'basic',
  ['Passed', 'Failed'],
  true
);
const noChoicesProposal = createMockProposal('no-choices', 'basic', []);
const singleChoiceProposal = createMockProposal('single-choice', 'basic', [
  'Choice A',
  'Choice B',
  'Choice C',
]);

// --- Ladle Stories ---

// Pass the mock proposal directly. Assuming VoteButton props are compatible
// with the MockProposal type or a structurally compatible subset.
// This avoids the `any` type and satisfies the ESLint rule.

export const Basic: Story = () => <VoteButton proposal={basicProposal} />;

export const Approval: Story = () => <VoteButton proposal={approvalProposal} />;

export const Weighted: Story = () => <VoteButton proposal={weightedProposal} />;

export const RankedChoice: Story = () => (
  <VoteButton proposal={rankedProposal} />
);

export const Quadratic: Story = () => (
  <VoteButton proposal={quadraticProposal} />
);

export const SingleChoice: Story = () => (
  <VoteButton proposal={singleChoiceProposal} />
);

export const VotingEnded: Story = () => <VoteButton proposal={endedProposal} />;

export const NoChoices: Story = () => (
  <VoteButton proposal={noChoicesProposal} />
);
