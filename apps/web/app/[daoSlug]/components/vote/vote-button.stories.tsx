import { VoteType } from '@/lib/results_processing';
import { VoteButton } from './vote-button';
import '@/styles/globals.css';
import { Story } from '@ladle/react';
import { JsonValue } from '@proposalsapp/db-indexer';
import React, { useState, useEffect } from 'react'; // Import React hooks

// --- Enums and Interfaces (Keep as is) ---
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
interface MockProposalMetadata {
  voteType?: VoteType;
  hiddenVote?: boolean;
  scoresState?: 'pending' | 'final';
  totalDelegatedVp?: string;
  quorumChoices?: number[];
  snapshotBlock?: string;
  originalSnapshotType?: string;
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
  choices: string[];
  metadata: MockProposalMetadata;
}

// --- Snapshot Fetching Logic (Keep as is, including logging) ---
const SNAPSHOT_SPACE = 'proposalsapp-area51.eth';
const SNAPSHOT_HUB_URL = 'https://testnet.hub.snapshot.org';

const mapSnapshotState = (state?: string): ProposalState => {
  /* ... implementation unchanged ... */
  switch (state?.toLowerCase()) {
    case 'active':
      return ProposalState.ACTIVE;
    case 'closed':
      return ProposalState.EXECUTED; // Simplified mapping
    case 'pending':
      return ProposalState.PENDING;
    default:
      console.warn(`Unknown Snapshot proposal state received: ${state}`);
      return ProposalState.UNKNOWN;
  }
};
const mapSnapshotType = (type?: string): VoteType | undefined => {
  /* ... implementation unchanged ... */
  switch (type?.toLowerCase()) {
    case 'basic':
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
    default:
      console.warn(`Unknown Snapshot proposal type received: ${type}`);
      return undefined;
  }
};

async function fetchLatestProposal(
  spaceId: string,
  hubUrl: string
): Promise<MockProposal | null> {
  const graphqlQuery = {
    /* ... query unchanged ... */ operationName: 'LatestProposal',
    query: `query LatestProposal($spaceId: String!) { proposals( first: 1, skip: 0, where: { space: $spaceId }, orderBy: "created", orderDirection: desc ) { id title body choices start end snapshot state author created space { id } type quorum discussion } }`,
    variables: { spaceId },
  };
  const fetchUrl = `${hubUrl}/graphql`;
  console.log(
    `[fetchLatestProposal] Attempting to fetch from: ${fetchUrl} for space: ${spaceId}`
  );
  console.log(
    `[fetchLatestProposal] Sending GraphQL query:`,
    JSON.stringify(graphqlQuery, null, 2)
  );

  try {
    const response = await fetch(fetchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(graphqlQuery),
      cache: 'no-store',
    });
    console.log(
      `[fetchLatestProposal] Received response status: ${response.status} ${response.statusText}`
    );
    let responseBodyText = '';
    try {
      responseBodyText = await response.clone().text();
      console.log(
        `[fetchLatestProposal] Received raw response body:`,
        responseBodyText
      );
    } catch (cloneError) {
      console.error(
        `[fetchLatestProposal] Error cloning response:`,
        cloneError
      );
      try {
        responseBodyText = await response.text();
        console.log(
          `[fetchLatestProposal] Received raw response body (from original):`,
          responseBodyText
        );
      } catch (readError) {
        console.error(
          `[fetchLatestProposal] Error reading response body:`,
          readError
        );
      }
    }
    if (!response.ok) {
      console.error(
        `[fetchLatestProposal] Snapshot API request failed with status ${response.status}. Body: ${responseBodyText}`
      );
      return null;
    }
    let jsonResponse;
    try {
      if (
        responseBodyText &&
        response.headers.get('content-type')?.includes('application/json')
      ) {
        jsonResponse = JSON.parse(responseBodyText);
      } else {
        jsonResponse = await response.json();
      }
      console.log(`[fetchLatestProposal] Parsed JSON response:`, jsonResponse);
    } catch (parseError) {
      console.error(
        `[fetchLatestProposal] Failed to parse JSON response. Status: ${response.status}. Body: ${responseBodyText}`,
        parseError
      );
      return null;
    }
    if (jsonResponse.errors) {
      console.error(
        '[fetchLatestProposal] Snapshot API returned GraphQL errors:',
        jsonResponse.errors
      );
      return null;
    }
    const proposalData = jsonResponse.data?.proposals?.[0];
    if (!proposalData) {
      console.warn(
        `[fetchLatestProposal] No proposal found for space '${spaceId}' in Snapshot API response data.`
      );
      return null;
    }
    console.log(`[fetchLatestProposal] Found proposal data:`, proposalData);
    // --- Mapping Logic (unchanged) ---
    const mappedVoteType = mapSnapshotType(proposalData.type);
    const mappedState = mapSnapshotState(proposalData.state);
    let cleanChoices: string[] = [];
    if (
      Array.isArray(proposalData.choices) &&
      proposalData.choices.every((c: unknown) => typeof c === 'string')
    ) {
      cleanChoices = proposalData.choices as string[];
    } else {
      console.warn(
        `[fetchLatestProposal] Fetched proposal choices (id: ${proposalData.id}) are not string[], using empty array:`,
        proposalData.choices
      );
    }
    const startTs =
      typeof proposalData.start === 'number' ? proposalData.start * 1000 : 0;
    const createdTs =
      typeof proposalData.created === 'number'
        ? proposalData.created * 1000
        : 0;
    const endTs =
      typeof proposalData.end === 'number' ? proposalData.end * 1000 : 0;
    if (!startTs || !createdTs || !endTs) {
      console.warn(
        `[fetchLatestProposal] Proposal ${proposalData.id} has invalid timestamp(s): start=${proposalData.start}, created=${proposalData.created}, end=${proposalData.end}. Using epoch 0.`
      );
    }
    const mappedProposal: MockProposal = {
      id: proposalData.id,
      externalId: proposalData.id,
      daoId: proposalData.space.id,
      name: proposalData.title || 'Untitled Proposal',
      body: proposalData.body || '',
      author: proposalData.author || 'Unknown Author',
      url: '',
      startAt: new Date(startTs),
      createdAt: new Date(createdTs),
      endAt: new Date(endTs),
      proposalState: mappedState,
      choices: cleanChoices,
      quorum: typeof proposalData.quorum === 'number' ? proposalData.quorum : 0,
      discussionUrl:
        typeof proposalData.discussion === 'string' && proposalData.discussion
          ? proposalData.discussion
          : null,
      governorId: `snapshot-gov-for-${proposalData.space.id}`,
      blockCreatedAt: null,
      markedSpam: false,
      blockStartAt: null,
      blockEndAt: null,
      txid: null,
      metadata: {
        voteType: mappedVoteType,
        scoresState: proposalData.state === 'active' ? 'pending' : 'final',
        snapshotBlock:
          typeof proposalData.snapshot === 'string'
            ? proposalData.snapshot
            : undefined,
        originalSnapshotType:
          typeof proposalData.type === 'string' ? proposalData.type : undefined,
        hiddenVote: false,
      },
    };
    if (!proposalData.title)
      console.warn(
        `[fetchLatestProposal] Proposal ${proposalData.id} missing title.`
      );
    if (!proposalData.author)
      console.warn(
        `[fetchLatestProposal] Proposal ${proposalData.id} missing author.`
      );
    if (
      cleanChoices.length === 0 &&
      Array.isArray(proposalData.choices) &&
      proposalData.choices.length > 0
    ) {
    } else if (cleanChoices.length === 0) {
      console.warn(
        `[fetchLatestProposal] Proposal ${proposalData.id} has empty choices array.`
      );
    }
    console.log(
      `[fetchLatestProposal] Successfully mapped proposal:`,
      mappedProposal
    );
    return mappedProposal;
  } catch (error) {
    console.error(
      '[fetchLatestProposal] Error during fetch or processing:',
      error
    );
    if (error instanceof Error) {
      console.error(
        `[fetchLatestProposal] Error name: ${error.name}, message: ${error.message}`
      );
    }
    return null;
  }
}

// --- Ladle Loader (Keep the function definition, but we won't assign it to the story for now) ---
const load = async (): Promise<{
  proposal: MockProposal | null;
  error?: boolean;
}> => {
  console.log(
    `[Ladle Loader] Starting proposal fetch from ${SNAPSHOT_HUB_URL} for space ${SNAPSHOT_SPACE}...`
  );
  const proposal = await fetchLatestProposal(SNAPSHOT_SPACE, SNAPSHOT_HUB_URL);
  if (!proposal) {
    console.error('[Ladle Loader] Failed to load proposal for story.');
    return { proposal: null, error: true };
  }
  console.log(`[Ladle Loader] Successfully fetched proposal: ${proposal.id}`);
  return { proposal };
};
load.storyName = 'Proposal Data Loader';

// --- Ladle Story (Modified to use useEffect for fetching) ---

// Define the type for the props (No longer passed by loader)
// interface LatestProposalStoryProps {
//   proposal: MockProposal | null; // Data will come from state now
//   error?: boolean;
// }

export const LatestProposalFromSnapshot: Story = () => {
  // No props from loader
  const [proposal, setProposal] = useState<MockProposal | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    // Define the async function to fetch data
    const fetchData = async () => {
      console.log('[useEffect] Starting proposal fetch...');
      setIsLoading(true);
      setError(false);
      try {
        const fetchedProposal = await fetchLatestProposal(
          SNAPSHOT_SPACE,
          SNAPSHOT_HUB_URL
        );
        if (fetchedProposal) {
          setProposal(fetchedProposal);
          console.log(
            '[useEffect] Successfully fetched and set proposal:',
            fetchedProposal.id
          );
        } else {
          console.error('[useEffect] fetchLatestProposal returned null.');
          setError(true);
        }
      } catch (err) {
        console.error('[useEffect] Error fetching proposal:', err);
        setError(true);
      } finally {
        setIsLoading(false);
        console.log('[useEffect] Fetch attempt finished.');
      }
    };

    // Call the fetch function
    fetchData();

    // Cleanup function (optional, not strictly needed for one-time fetch)
    // return () => { /* potentially abort controller logic if needed */ };
  }, []); // Empty dependency array means this runs once on mount

  // --- Render based on state ---

  if (isLoading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h2>Loading Proposal...</h2>
        <p>
          Fetching latest proposal from Snapshot Hub ({SNAPSHOT_HUB_URL}) for
          space ({SNAPSHOT_SPACE})...
        </p>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div style={{ padding: '20px', color: 'red', fontFamily: 'sans-serif' }}>
        <h2>Error Loading Proposal</h2>
        <p>
          Failed to load proposal data from Snapshot Hub (
          <code>{SNAPSHOT_HUB_URL}</code>) for space (
          <code>{SNAPSHOT_SPACE}</code>).
        </p>
        <p>
          Please check the browser's developer console (Network and Console
          tabs) for detailed error messages. Ensure the Snapshot Hub is
          operational and accessible. Possible causes include network issues,
          CORS errors, or API problems.
        </p>
      </div>
    );
  }

  // --- Display Proposal (Same as before, but using state variable 'proposal') ---
  const isOffchain = proposal.metadata?.voteType?.startsWith('offchain-');

  return (
    <VoteButton
      proposal={proposal}
      snapshotSpace={SNAPSHOT_SPACE}
      snapshotHubUrl={SNAPSHOT_HUB_URL}
    />
  );
};

LatestProposalFromSnapshot.storyName = 'Latest Proposal';

// IMPORTANT: Comment out or remove the loader assignment for this story
// LatestProposalFromSnapshot.load = load;
