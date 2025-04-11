import { VoteType } from '@/lib/results_processing';
import { VoteButton } from './vote-button';
import '@/styles/globals.css';
import { Story } from '@ladle/react';
import { JsonValue } from '@proposalsapp/db-indexer';
import React from 'react'; // Import React for JSX

// --- Enums and Interfaces (Kept for type definition) ---

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

// Interface for the expected structure, potentially derived from Snapshot data
interface MockProposalMetadata {
  voteType?: VoteType;
  hiddenVote?: boolean;
  scoresState?: 'pending' | 'final';
  totalDelegatedVp?: string;
  quorumChoices?: number[];
  // Allow any other properties that might come from snapshot or be needed
  [key: string]: JsonValue | undefined | number[] | string[] | boolean;
}

interface MockProposal {
  id: string;
  externalId: string; // Often same as id for Snapshot
  governorId: string; // May not be directly available from Snapshot, requires context/mapping
  daoId: string; // Space ID from Snapshot
  name: string; // title from Snapshot
  body: string; // body from Snapshot
  author: string; // author from Snapshot
  url: string; // May need to be constructed
  startAt: Date; // start from Snapshot (converted)
  createdAt: Date; // created from Snapshot (converted)
  endAt: Date; // end from Snapshot (converted)
  blockCreatedAt: number | null; // Not standard in Snapshot API
  markedSpam: boolean; // Not standard in Snapshot API
  quorum: number; // quorum from Snapshot
  blockStartAt: number | null; // Not standard in Snapshot API
  blockEndAt: number | null; // Not standard in Snapshot API
  proposalState: ProposalState; // state from Snapshot (mapped)
  discussionUrl: string | null; // discussion from Snapshot
  txid: string | null; // Not standard for offchain Snapshot proposals
  choices: string[] | JsonValue; // choices from Snapshot (ensure string[])
  metadata: MockProposalMetadata; // Contains voteType, etc.
}

// --- Snapshot Fetching Logic ---

const SNAPSHOT_SPACE = 'proposalsapp-area51.eth';
const SNAPSHOT_HUB_URL = 'https://testnet.hub.snapshot.org';

// Helper to map Snapshot state to ProposalState
const mapSnapshotState = (state?: string): ProposalState => {
  switch (state?.toLowerCase()) {
    case 'active':
      return ProposalState.ACTIVE;
    case 'closed':
      // Defaulting closed to EXECUTED for story purposes, might need refinement
      return ProposalState.EXECUTED;
    case 'pending':
      return ProposalState.PENDING;
    default:
      return ProposalState.UNKNOWN;
  }
};

// Helper to map Snapshot type to VoteType (assuming offchain context)
const mapSnapshotType = (type?: string): VoteType | undefined => {
  switch (type?.toLowerCase()) {
    case 'basic':
      return 'offchain-basic';
    case 'single-choice':
      return 'offchain-single-choice';
    case 'approval':
      return 'offchain-approval';
    case 'quadratic':
      return 'offchain-quadratic';
    case 'ranked-choice':
      return 'offchain-ranked-choice';
    case 'weighted':
      return 'offchain-weighted';
    // Add other potential Snapshot types if needed
    default:
      // Fallback or handle unknown types if necessary
      return undefined;
  }
};

// Fetch the latest proposal from Snapshot
async function fetchLatestProposal(
  spaceId: string,
  hubUrl: string
): Promise<MockProposal | null> {
  const graphqlQuery = {
    operationName: 'LatestProposal',
    query: `query LatestProposal($spaceId: String!) {
      proposals(
        first: 1,
        skip: 0,
        where: { space: $spaceId },
        orderBy: "created",
        orderDirection: desc
      ) {
        id
        title
        body
        choices
        start
        end
        created
        state
        author
        space { id }
        type
        quorum
        discussion
      }
    }`,
    variables: { spaceId },
  };

  try {
    const response = await fetch(`${hubUrl}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(graphqlQuery),
    });

    if (!response.ok) {
      console.error(
        `Snapshot API request failed: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const jsonResponse = await response.json();

    if (jsonResponse.errors) {
      console.error('Snapshot API returned errors:', jsonResponse.errors);
      return null;
    }

    const proposalData = jsonResponse.data?.proposals?.[0];

    if (!proposalData) {
      console.warn(
        `No proposal found for space '${spaceId}' in Snapshot API response.`
      );
      return null;
    }

    // --- Map Snapshot data to MockProposal structure ---
    const mappedVoteType = mapSnapshotType(proposalData.type);
    const mappedState = mapSnapshotState(proposalData.state);

    // Basic validation/cleaning of choices
    let cleanChoices: string[] = [];
    if (
      Array.isArray(proposalData.choices) &&
      proposalData.choices.every((c: unknown) => typeof c === 'string')
    ) {
      cleanChoices = proposalData.choices;
    } else {
      console.warn(
        'Fetched proposal choices are not string[], using empty array:',
        proposalData.choices
      );
    }

    const mappedProposal: MockProposal = {
      // Mapped fields
      id: proposalData.id,
      externalId: proposalData.id, // Use Snapshot id
      daoId: proposalData.space.id,
      name: proposalData.title || 'Untitled Proposal',
      body: proposalData.body || '',
      author: proposalData.author || 'Unknown Author',
      url: '', // Construct URL later if needed (e.g., based on space/id)
      startAt: new Date(proposalData.start * 1000),
      createdAt: new Date(proposalData.created * 1000),
      endAt: new Date(proposalData.end * 1000),
      proposalState: mappedState,
      choices: cleanChoices,
      quorum: proposalData.quorum || 0,
      discussionUrl: proposalData.discussion || null,

      // Default/Placeholder fields (adjust if VoteButton requires specifics)
      governorId: `gov-for-${proposalData.space.id}`, // Placeholder
      blockCreatedAt: null,
      markedSpam: false,
      blockStartAt: null,
      blockEndAt: null,
      txid: null,

      // Metadata object
      metadata: {
        voteType: mappedVoteType,
        scoresState: mappedState === ProposalState.ACTIVE ? 'pending' : 'final',
        // Add other potential metadata defaults if necessary
        hiddenVote: false, // Default assumption
      } as MockProposalMetadata, // Cast ensures compatibility, allows extra props via index signature
    };

    // Add the original snapshot type to metadata if needed elsewhere
    if (
      proposalData.type &&
      mappedProposal.metadata &&
      typeof mappedProposal.metadata === 'object'
    ) {
      (mappedProposal.metadata as MockProposalMetadata)[
        'originalSnapshotType'
      ] = proposalData.type;
    }

    return mappedProposal;
  } catch (error) {
    console.error('Error fetching or processing Snapshot proposal:', error);
    return null;
  }
}

// --- Ladle Story ---

export const LatestProposalFromSnapshot: Story = async () => {
  const proposal = await fetchLatestProposal(SNAPSHOT_SPACE, SNAPSHOT_HUB_URL);

  if (!proposal) {
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        Error loading proposal data from Snapshot Hub ({SNAPSHOT_HUB_URL}) for
        space ({SNAPSHOT_SPACE}). Check console for details.
      </div>
    );
  }

  // Determine if snapshot props should be passed (typically for offchain types)
  const isOffchain = proposal.metadata?.voteType?.startsWith('offchain-');

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: 'auto' }}>
      <h2>Vote Button (Latest Proposal from Snapshot)</h2>
      <p>
        Displaying VoteButton for the latest proposal fetched from space{' '}
        <code>{SNAPSHOT_SPACE}</code>.
      </p>
      <pre
        style={{
          fontSize: '0.8em',
          background: '#f0f0f0',
          padding: '10px',
          borderRadius: '4px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        Proposal ID: {proposal.id}
        <br />
        Title: {proposal.name}
        <br />
        State: {proposal.proposalState}
        <br />
        Vote Type: {proposal.metadata?.voteType || 'N/A'}
        <br />
        End Date: {proposal.endAt.toLocaleString()}
        <br />
        Choices: {JSON.stringify(proposal.choices)}
      </pre>
      <VoteButton
        proposal={proposal}
        // Conditionally pass Snapshot Hub/Space info if it's offchain
        {...(isOffchain && {
          snapshotSpace: SNAPSHOT_SPACE,
          snapshotHubUrl: SNAPSHOT_HUB_URL,
        })}
      />
    </div>
  );
};

LatestProposalFromSnapshot.storyName = 'Latest Proposal (Live Snapshot Data)';
