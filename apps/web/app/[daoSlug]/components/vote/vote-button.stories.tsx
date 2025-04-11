import { VoteType } from '@/lib/results_processing';
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

// Corrected MockProposalMetadata to include specific voteType and index signature
interface MockProposalMetadata {
  voteType?: VoteType;
  hiddenVote?: boolean;
  scoresState?: 'pending' | 'final';
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
  proposalState: ProposalState;
  discussionUrl: string | null;
  txid: string | null;
  choices: string[] | JsonValue;
  metadata: MockProposalMetadata | JsonValue | null;
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
  voteType: VoteType, // Use the specific VoteType
  choices: string[],
  ended = false
): MockProposal => ({
  ...baseProposal,
  id: `prop-${id}`,
  choices: choices as string[], // Assume VoteButton handles string[]
  metadata: {
    voteType: voteType,
    hiddenVote: false,
    scoresState: ended ? 'final' : 'pending',
  } as MockProposalMetadata, // Cast to our mock type
  endAt: ended
    ? new Date(Date.now() - 1000) // Ended 1 second ago
    : new Date(Date.now() + 86400000 * 2), // Ends in 2 days
  proposalState: ended ? ProposalState.EXECUTED : ProposalState.ACTIVE,
});

// --- Mock Proposals for Stories ---
const offchainBasicProposal = createMockProposal('123', 'offchain-basic', [
  'For',
  'Against',
  'Abstain',
]);
const offchainApprovalProposal = createMockProposal(
  '123',
  'offchain-approval',
  ['Approve Project X', 'Approve Project Y', 'Approve Project Z']
);
const offchainWeightedProposal = createMockProposal(
  '123',
  'offchain-weighted',
  ['Option 1 (weighted)', 'Option 2 (weighted)', 'Option 3 (weighted)']
);
const offchainRankedProposal = createMockProposal(
  '123',
  'offchain-ranked-choice',
  ['Option 1 (Rank)', 'Option 2 (Rank)', 'Option 3 (Rank)']
);
const offchainQuadraticProposal = createMockProposal(
  '123',
  'offchain-quadratic',
  ['Fund Initiative', 'Do Not Fund']
);
const offchainSingleChoiceProposal = createMockProposal(
  '123',
  'offchain-single-choice',
  ['Choice A', 'Choice B', 'Choice C']
);
const onchainBasicProposal = createMockProposal('123', 'onchain-basic', [
  'Yes (Onchain)',
  'No (Onchain)',
  'Abstain (Onchain)',
]);

// Edge Case Proposals
const endedProposal = createMockProposal(
  '123',
  'offchain-basic', // Vote type doesn't matter as much when ended
  ['Passed', 'Failed'],
  true
);
const noChoicesProposal = createMockProposal(
  '123',
  'offchain-basic', // Vote type doesn't matter as much when no choices
  []
);

// --- Ladle Stories ---

export const OffchainBasic: Story = () => (
  <VoteButton proposal={offchainBasicProposal} />
);

export const OffchainApproval: Story = () => (
  <VoteButton proposal={offchainApprovalProposal} />
);

export const OffchainWeighted: Story = () => (
  <VoteButton proposal={offchainWeightedProposal} />
);

export const OffchainRankedChoice: Story = () => (
  <VoteButton proposal={offchainRankedProposal} />
);

export const OffchainQuadratic: Story = () => (
  <VoteButton proposal={offchainQuadraticProposal} />
);

export const OffchainSingleChoice: Story = () => (
  <VoteButton proposal={offchainSingleChoiceProposal} />
);

export const OnchainBasic: Story = () => (
  <VoteButton proposal={onchainBasicProposal} />
);

export const VotingEnded: Story = () => <VoteButton proposal={endedProposal} />;

export const NoChoices: Story = () => (
  <VoteButton proposal={noChoicesProposal} />
);
