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

// --- Snapshot Fetching Logic ---
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

// Helper function to get the Snapshot type string from our VoteType enum
const getSnapshotTypeString = (voteType: VoteType): string | undefined => {
  switch (voteType) {
    case 'offchain-basic':
      return 'basic';
    case 'offchain-single-choice':
      return 'single-choice';
    case 'offchain-approval':
      return 'approval';
    case 'offchain-quadratic':
      return 'quadratic';
    case 'offchain-ranked-choice':
      return 'ranked-choice';
    case 'offchain-weighted':
      return 'weighted';
    default:
      // Should not happen if VoteType enum is used correctly, but handle defensively
      console.warn(
        `[getSnapshotTypeString] Cannot map unknown VoteType: ${voteType}`
      );
      return undefined;
  }
};

async function fetchLatestProposal(
  spaceId: string,
  hubUrl: string,
  proposalType?: VoteType // Use the specific VoteType enum
): Promise<MockProposal | null> {
  const whereClauses: string[] = [`space: $spaceId`]; // Start with the mandatory space filter

  let snapshotTypeString: string | undefined;
  if (proposalType) {
    snapshotTypeString = getSnapshotTypeString(proposalType);
    if (snapshotTypeString) {
      // Add the type filter only if a valid mapping exists
      whereClauses.push(`type: "${snapshotTypeString}"`);
    } else {
      console.warn(
        `[fetchLatestProposal] Could not map VoteType '${proposalType}' to a Snapshot type string. Fetching latest proposal of any type.`
      );
    }
  }

  const whereString = whereClauses.join(', '); // Join clauses with commas

  const graphqlQuery = {
    operationName: 'LatestProposal',
    query: `
      query LatestProposal($spaceId: String!) {
        proposals(
          first: 1,
          skip: 0,
          where: { ${whereString} },  # Use the dynamically built where string
          orderBy: "created",
          orderDirection: desc
        ) {
          id
          title
          body
          choices
          start
          end
          snapshot
          state
          author
          created
          space {
            id
          }
          type
          quorum
          discussion
        }
      }
    `,
    variables: { spaceId },
  };

  const fetchUrl = `${hubUrl}/graphql`;
  console.log(
    `[fetchLatestProposal] Attempting to fetch from: ${fetchUrl} for space: ${spaceId}${
      snapshotTypeString ? ` and type: ${snapshotTypeString}` : ' (any type)'
    }`
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
      responseBodyText = await response.clone().text(); // Clone to read body multiple times if needed
      console.log(
        `[fetchLatestProposal] Received raw response body:`,
        responseBodyText || '(empty body)'
      );
    } catch (cloneError) {
      console.error(
        `[fetchLatestProposal] Error cloning response:`,
        cloneError
      );
      try {
        // Attempt to read from original if clone failed
        responseBodyText = await response.text();
        console.log(
          `[fetchLatestProposal] Received raw response body (from original):`,
          responseBodyText || '(empty body)'
        );
      } catch (readError) {
        console.error(
          `[fetchLatestProposal] Error reading response body:`,
          readError
        );
        responseBodyText = '(failed to read body)'; // Provide placeholder
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
      // Attempt to parse based on content-type, fallback to response.json()
      if (
        responseBodyText &&
        response.headers.get('content-type')?.includes('application/json')
      ) {
        jsonResponse = JSON.parse(responseBodyText);
      } else if (!responseBodyText) {
        console.warn(
          `[fetchLatestProposal] Received empty response body despite OK status.`
        );
        // Attempt json parse anyway, it might work for some servers/proxies
        jsonResponse = await response.json().catch(() => null);
        if (!jsonResponse) {
          console.error(
            `[fetchLatestProposal] Failed to parse empty body as JSON.`
          );
          return null;
        }
      } else {
        console.warn(
          `[fetchLatestProposal] Response content-type is not JSON (${response.headers.get('content-type')}), attempting to parse anyway.`
        );
        jsonResponse = await response.json(); // Let Playwright handle parsing if not explicitly JSON
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
        `[fetchLatestProposal] No proposal found for space '${spaceId}' ${
          snapshotTypeString ? `and type '${snapshotTypeString}'` : '(any type)'
        } in Snapshot API response data.`
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
      governorId: `snapshot-gov-for-${proposalData.space.id}`, // Placeholder governor ID
      blockCreatedAt: null, // Not available from standard Snapshot API
      markedSpam: false, // Assume not spam unless otherwise indicated
      blockStartAt: null, // Not available
      blockEndAt: null, // Not available
      txid: null, // Not applicable for off-chain proposals
      metadata: {
        voteType: mappedVoteType,
        scoresState: proposalData.state === 'active' ? 'pending' : 'final',
        snapshotBlock:
          typeof proposalData.snapshot === 'string'
            ? proposalData.snapshot
            : undefined,
        originalSnapshotType:
          typeof proposalData.type === 'string' ? proposalData.type : undefined,
        hiddenVote: false, // Assuming not hidden vote unless specific plugin used
        // Add any other relevant metadata mapping here if needed
      },
    };

    // Add post-mapping validation/warnings (unchanged)
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
      console.warn(
        `[fetchLatestProposal] Fetched proposal choices (id: ${proposalData.id}) were not all strings, resulting in empty choices array:`,
        proposalData.choices
      );
    } else if (cleanChoices.length === 0) {
      console.warn(
        `[fetchLatestProposal] Proposal ${proposalData.id} has empty or invalid choices array.`
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

// --- Ladle Loader (Definition only, not assigned to stories directly) ---
const load = async (): Promise<{
  proposal: MockProposal | null;
  error?: boolean;
}> => {
  console.log(
    `[Ladle Loader] Starting proposal fetch from ${SNAPSHOT_HUB_URL} for space ${SNAPSHOT_SPACE}...`
  );
  const proposal = await fetchLatestProposal(SNAPSHOT_SPACE, SNAPSHOT_HUB_URL); // Fetches latest of any type by default now
  if (!proposal) {
    console.error('[Ladle Loader] Failed to load proposal for story.');
    return { proposal: null, error: true };
  }
  console.log(`[Ladle Loader] Successfully fetched proposal: ${proposal.id}`);
  return { proposal };
};
load.storyName = 'Proposal Data Loader';

// --- Ladle Stories for different Proposal Types ---

// Reusable component to handle fetching and rendering for different types
const ProposalStory: React.FC<{ proposalType?: VoteType }> = ({
  proposalType,
}) => {
  const [proposal, setProposal] = useState<MockProposal | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  // Generate a user-friendly name for logging and display
  const typeName = proposalType
    ? proposalType
        .replace('offchain-', '')
        .replace('-', ' ')
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    : 'Latest';

  useEffect(() => {
    // Define async function inside useEffect
    const fetchData = async () => {
      console.log(
        `[useEffect - ${typeName}] Starting ${typeName} proposal fetch...`
      );
      setIsLoading(true);
      setError(false); // Reset error state on new fetch attempt
      setProposal(null); // Reset proposal state

      try {
        const fetchedProposal = await fetchLatestProposal(
          SNAPSHOT_SPACE,
          SNAPSHOT_HUB_URL,
          proposalType // Pass the specific type to fetch
        );

        if (fetchedProposal) {
          // Verify the fetched proposal type matches if a specific type was requested
          if (
            proposalType &&
            fetchedProposal.metadata.voteType !== proposalType
          ) {
            console.warn(
              `[useEffect - ${typeName}] Fetched proposal ${fetchedProposal.id} has type ${fetchedProposal.metadata.voteType}, but requested ${proposalType}. Displaying fetched proposal anyway.`
            );
            // Decide if this should be an error: setError(true); ? For now, just warn.
          }
          setProposal(fetchedProposal);
          console.log(
            `[useEffect - ${typeName}] Successfully fetched and set ${typeName} proposal:`,
            fetchedProposal.id
          );
        } else {
          console.error(
            `[useEffect - ${typeName}] fetchLatestProposal returned null for ${typeName} proposal.`
          );
          setError(true);
        }
      } catch (err) {
        console.error(
          `[useEffect - ${typeName}] Error fetching ${typeName} proposal:`,
          err
        );
        setError(true);
      } finally {
        setIsLoading(false);
        console.log(
          `[useEffect - ${typeName}] Fetch attempt finished for ${typeName} proposal.`
        );
      }
    };

    fetchData();
    // Dependency array includes proposalType to refetch when it changes.
    // typeName is derived from proposalType, so no need to include it explicitly.
  }, [proposalType]);

  if (isLoading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h2>Loading {typeName} Proposal...</h2>
        <p>
          Fetching latest {typeName.toLowerCase()} proposal from Snapshot Hub (
          <code>{SNAPSHOT_HUB_URL}</code>) for space (
          <code>{SNAPSHOT_SPACE}</code>)...
        </p>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div style={{ padding: '20px', color: 'red', fontFamily: 'sans-serif' }}>
        <h2>Error Loading {typeName} Proposal</h2>
        <p>
          Failed to load the latest {typeName.toLowerCase()} proposal data from
          Snapshot Hub (<code>{SNAPSHOT_HUB_URL}</code>) for space (
          <code>{SNAPSHOT_SPACE}</code>).
        </p>
        <p>
          This might happen if no proposal of this specific type exists in the
          space, or if there was a network/API error.
        </p>
        <p>Please check the browser&apos;s developer console for details.</p>
      </div>
    );
  }

  // Render the VoteButton with the fetched proposal
  return (
    <VoteButton
      proposal={proposal}
      snapshotSpace={SNAPSHOT_SPACE}
      snapshotHubUrl={SNAPSHOT_HUB_URL}
    />
  );
};

// --- Exported Stories ---

// Stories for fetching the latest proposal of a specific type
export const BasicProposalStory: Story = () => (
  <ProposalStory proposalType='offchain-basic' />
);
BasicProposalStory.storyName = 'Basic Proposal';

export const SingleChoiceProposalStory: Story = () => (
  <ProposalStory proposalType='offchain-single-choice' />
);
SingleChoiceProposalStory.storyName = 'Single Choice Proposal';

export const ApprovalProposalStory: Story = () => (
  <ProposalStory proposalType='offchain-approval' />
);
ApprovalProposalStory.storyName = 'Approval Proposal';

export const QuadraticProposalStory: Story = () => (
  <ProposalStory proposalType='offchain-quadratic' />
);
QuadraticProposalStory.storyName = 'Quadratic Proposal';

export const RankedChoiceProposalStory: Story = () => (
  <ProposalStory proposalType='offchain-ranked-choice' />
);
RankedChoiceProposalStory.storyName = 'Ranked Choice Proposal';

export const WeightedProposalStory: Story = () => (
  <ProposalStory proposalType='offchain-weighted' />
);
WeightedProposalStory.storyName = 'Weighted Proposal';
