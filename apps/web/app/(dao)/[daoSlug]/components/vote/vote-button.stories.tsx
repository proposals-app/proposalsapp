import type { VoteType } from '@/lib/results_processing';
import { VoteButton } from './vote-button';
import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useEffect, useState } from 'react';
import {
  type Abi,
  type AbiEvent,
  type Address,
  type Chain,
  type DecodeEventLogReturnType,
  type Log,
  type PublicClient,
  ContractFunctionExecutionError,
  createPublicClient,
  decodeEventLog,
  http,
} from 'viem';
import { arbitrum } from 'viem/chains';
import {
  ARBITRUM_CORE_GOVERNOR_ABI,
  ARBITRUM_CORE_GOVERNOR_ADDRESS,
  ARBITRUM_TOKEN_ABI,
  ARBITRUM_TOKEN_ADDRESS,
  ARBITRUM_TREASURY_GOVERNOR_ABI,
  ARBITRUM_TREASURY_GOVERNOR_ADDRESS,
} from '@/lib/constants';

// Define a local ProposalState enum matching the expected string values
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

// Define a local JsonValue type
type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

// Define a local Proposal interface based on usage in this file
interface Proposal {
  id: string; // UUID string
  externalId: string;
  governorId: string; // UUID string
  daoId: string; // UUID string
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
  metadata: JsonValue; // Use the local JsonValue type
}

// --- Constants ---
const TEST_SNAPSHOT_SPACE = 'proposalsapp-area51.eth';
const TEST_SNAPSHOT_HUB_URL = 'https://testnet.hub.snapshot.org';

// --- Interfaces (Keep Snapshot ones, ensure MockProposal uses local types) ---
interface MockProposalMetadata {
  voteType?: VoteType;
  hiddenVote?: boolean;
  scoresState?: 'pending' | 'final';
  totalDelegatedVp?: string;
  quorumChoices?: number[];
  snapshotBlock?: string;
  originalSnapshotType?: string;
  // On-chain specific metadata (optional, but good for type safety)
  targets?: Address[];
  values?: string[];
  calldatas?: `0x${string}`[];
  signatures?: string[];
  quorumVotes?: string;
  totalSupply?: string;
  // Use local JsonValue for flexibility
  [key: string]: JsonValue | undefined | number[] | string[] | boolean;
}

// Interface for Snapshot-specific proposals (used by Snapshot stories)
// Ensure this aligns with the local Proposal interface where applicable
interface MockProposal {
  id: string; // Use Snapshot ID for story identification if needed
  externalId: string;
  governorId: string; // Placeholder UUID string or actual Uuid
  daoId: string; // Placeholder UUID string or actual Uuid
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
  metadata: MockProposalMetadata; // Keep specific metadata type for snapshots
}

const TEST_NODE_URL = 'http://localhost:8545';
const TEST_NODE_WS_URL = 'ws://localhost:8545';

const testnode = {
  ...arbitrum,
  rpcUrls: {
    default: {
      http: [TEST_NODE_URL],
      webSocket: [TEST_NODE_WS_URL],
    },
    public: {
      http: [TEST_NODE_URL],
      webSocket: [TEST_NODE_WS_URL],
    },
  },
} as const satisfies Chain;

// --- Viem Client Setup ---
const publicClient: PublicClient = createPublicClient({
  chain: testnode, // Use Arbitrum chain definition
  transport: http(TEST_NODE_URL),
});

// --- Enums & Mappers ---
// Map on-chain proposal states (numeric) to our local DbProposalState enum (string)
const mapOnchainState = (state?: number | bigint): ProposalState => {
  // Allow bigint as input, but convert to number for switch
  if (state === undefined) return ProposalState.UNKNOWN;
  const stateNumber = Number(state);
  switch (stateNumber) {
    case 0:
      return ProposalState.PENDING;
    case 1:
      return ProposalState.ACTIVE;
    case 2:
      return ProposalState.CANCELED;
    case 3:
      return ProposalState.DEFEATED;
    case 4:
      return ProposalState.SUCCEEDED;
    case 5:
      return ProposalState.QUEUED;
    case 6:
      return ProposalState.EXPIRED;
    case 7:
      return ProposalState.EXECUTED;
    default:
      console.warn(`Unknown Onchain proposal state received: ${state}`);
      return ProposalState.UNKNOWN;
  }
};

// Map snapshot proposal states (string) to our local DbProposalState enum (string)
const mapSnapshotState = (state?: string): ProposalState => {
  switch (state?.toLowerCase()) {
    case 'active':
      return ProposalState.ACTIVE;
    case 'closed':
      return ProposalState.EXECUTED; // Assuming 'closed' maps to 'executed'
    case 'pending':
      return ProposalState.PENDING;
    default:
      console.warn(`Unknown Snapshot proposal state received: ${state}`);
      return ProposalState.UNKNOWN;
  }
};

function extractTitleFromDescription(description: string): string {
  const lines = description
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  // Find the first non-empty line that doesn't start with '#' or is just '#'
  const titleLine = lines.find(
    (line) => !line.startsWith('#') || line.length > 1
  );
  let title =
    titleLine?.replace(/^#+\s*/, '').trim() || 'Untitled Onchain Proposal';
  // Truncate if necessary
  if (title.length > 120) {
    title = `${title.substring(0, 120)}...`;
  }
  return title;
}

// --- Snapshot Fetching Logic ---
async function fetchLatestSnapshotProposal(
  spaceId: string,
  hubUrl: string,
  proposalType?: VoteType
): Promise<MockProposal | null> {
  // Build proper GraphQL query with variables
  let query: string;
  let variables: any;

  if (proposalType) {
    console.log(
      `[fetchLatestSnapshotProposal] Filtering by type: ${proposalType}`
    );
    query = `
      query LatestProposal($spaceId: String!, $proposalType: String!) {
        proposals(
          first: 1,
          skip: 0,
          where: { space: $spaceId, type: $proposalType },
          orderBy: "created",
          orderDirection: desc
        ) {`;
    variables = { spaceId, proposalType };
  } else {
    console.log(
      `[fetchLatestSnapshotProposal] Fetching latest proposal of any type`
    );
    query = `
      query LatestProposal($spaceId: String!) {
        proposals(
          first: 1,
          skip: 0,
          where: { space: $spaceId },
          orderBy: "created",
          orderDirection: desc
        ) {`;
    variables = { spaceId };
  }

  // Complete the query fields
  const queryFields = `
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
          flagged
          link
          scores_state
          privacy
          ipfs # Use IPFS hash as a substitute for txid
        }
      }
    `;

  const graphqlQuery = {
    operationName: 'LatestProposal',
    query: query + queryFields,
    variables,
  };

  const fetchUrl = `${hubUrl}/graphql`;
  console.log(
    `[fetchLatestSnapshotProposal] Attempting to fetch from: ${fetchUrl} for space: ${spaceId}${
      proposalType ? ` and type: ${proposalType}` : ' (any type)'
    }`
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[fetchLatestSnapshotProposal] Snapshot API request failed with status ${response.status}. Body: ${errorText}`
      );
      return null;
    }

    const jsonResponse = await response.json();
    if (jsonResponse.errors) {
      console.error(
        '[fetchLatestSnapshotProposal] Snapshot API returned GraphQL errors:',
        jsonResponse.errors
      );
      return null;
    }

    const proposalData = jsonResponse.data?.proposals?.[0];
    if (!proposalData) {
      console.warn(
        `[fetchLatestSnapshotProposal] No proposal found for space '${spaceId}' ${
          proposalType ? `and type '${proposalType}'` : '(any type)'
        } in Snapshot API response data.`
      );
      return null;
    }

    console.log(
      `[fetchLatestSnapshotProposal] Found proposal data:`,
      proposalData
    );

    // --- Mapping Logic ---
    const mappedState = mapSnapshotState(proposalData.state);
    let cleanChoices: string[] = [];
    if (
      Array.isArray(proposalData.choices) &&
      proposalData.choices.every((c: unknown) => typeof c === 'string')
    ) {
      cleanChoices = proposalData.choices as string[];
    }

    const startTs =
      typeof proposalData.start === 'number' ? proposalData.start * 1000 : 0;
    const createdTs =
      typeof proposalData.created === 'number'
        ? proposalData.created * 1000
        : 0;
    const endTs =
      typeof proposalData.end === 'number' ? proposalData.end * 1000 : 0;

    // Use placeholders for IDs as they are UUIDs in the DB
    const placeholderUuid = '00000000-0000-0000-0000-000000000000';

    const mappedProposal: MockProposal = {
      id: placeholderUuid, // Placeholder DB ID
      externalId: proposalData.id,
      daoId: placeholderUuid, // Placeholder DB ID
      governorId: placeholderUuid, // Placeholder DB ID
      name: proposalData.title || 'Untitled Proposal',
      body: proposalData.body || '',
      author: proposalData.author || 'Unknown Author',
      url: proposalData.link || '', // Use empty string if null/undefined
      startAt: new Date(startTs),
      createdAt: new Date(createdTs),
      endAt: new Date(endTs),
      proposalState: mappedState, // Use local enum
      choices: cleanChoices,
      quorum: typeof proposalData.quorum === 'number' ? proposalData.quorum : 0,
      discussionUrl:
        typeof proposalData.discussion === 'string' && proposalData.discussion
          ? proposalData.discussion
          : null,
      blockCreatedAt: null,
      markedSpam: proposalData.flagged || false,
      blockStartAt: null,
      blockEndAt: null,
      txid: proposalData.ipfs || null, // Using ipfs hash as txid substitute
      metadata: {
        voteType: proposalData.type,
        scoresState:
          proposalData.scores_state === 'final' ? 'final' : 'pending',
        snapshotBlock:
          typeof proposalData.snapshot === 'string'
            ? proposalData.snapshot
            : undefined,
        originalSnapshotType:
          typeof proposalData.type === 'string' ? proposalData.type : undefined,
        hiddenVote: proposalData.privacy === 'shutter',
        // Add other Snapshot specific metadata if needed
      },
    };

    console.log(
      `[fetchLatestSnapshotProposal] Successfully mapped proposal:`,
      mappedProposal
    );
    return mappedProposal;
  } catch (error) {
    console.error(
      '[fetchLatestSnapshotProposal] Error during fetch or processing:',
      error
    );
    return null;
  }
}

// --- On-Chain Fetching Logic ---
const findEventAbi = (abi: Abi, eventName: string): AbiEvent | undefined =>
  abi.find((item) => item.type === 'event' && item.name === eventName) as
    | AbiEvent
    | undefined;

// Define the explicit type for decoded logs based on ABI for each governor
type DecodedProposalCreatedCoreLog = DecodeEventLogReturnType<
  typeof ARBITRUM_CORE_GOVERNOR_ABI,
  'ProposalCreated'
>['args'];

type DecodedProposalCreatedTreasuryLog = DecodeEventLogReturnType<
  typeof ARBITRUM_TREASURY_GOVERNOR_ABI,
  'ProposalCreated'
>['args'];

// --- MODIFIED: Dynamically uses correct ABI ---
async function fetchLatestOnchainProposal(
  governorAddress: Address
): Promise<Proposal | null> {
  console.log(
    `[fetchLatestOnchainProposal] Fetching latest proposal from governor: ${governorAddress}`
  );

  // Determine ABI based on address
  const governorAbi =
    governorAddress.toLowerCase() ===
    ARBITRUM_CORE_GOVERNOR_ADDRESS.toLowerCase()
      ? ARBITRUM_CORE_GOVERNOR_ABI
      : governorAddress.toLowerCase() ===
          ARBITRUM_TREASURY_GOVERNOR_ADDRESS.toLowerCase()
        ? ARBITRUM_TREASURY_GOVERNOR_ABI
        : undefined;

  if (!governorAbi) {
    console.error(
      `[fetchLatestOnchainProposal] No ABI found for governor: ${governorAddress}`
    );
    return null;
  }
  console.log(
    `[fetchLatestOnchainProposal] Determined ABI for governor ${governorAddress}`
  );

  // Define a union type for decoded logs based on the chosen ABI
  type DecodedProposalCreatedLog =
    | DecodedProposalCreatedCoreLog
    | DecodedProposalCreatedTreasuryLog;

  try {
    // Fetch the latest proposal ID using the event log approach primarily.
    console.log(
      `[fetchLatestOnchainProposal] Fetching latest ProposalCreated event log...`
    );
    const proposalCreatedEventAbi = findEventAbi(
      governorAbi,
      'ProposalCreated'
    );
    if (!proposalCreatedEventAbi) {
      throw new Error('ProposalCreated event not found in determined ABI');
    }

    const logs = await publicClient.getLogs({
      address: governorAddress,
      event: proposalCreatedEventAbi,
      fromBlock: BigInt(330000000),
      toBlock: 'latest',
    });

    if (logs.length === 0) {
      console.warn(
        `[fetchLatestOnchainProposal] No ProposalCreated events found for governor ${governorAddress}. Cannot determine latest proposal.`
      );
      return null; // Can't proceed without an ID
    }

    // Find the log with the highest proposalId
    let latestProposalId: bigint = BigInt(0);
    let latestLog: Log | undefined = undefined;

    for (const log of logs) {
      try {
        const decoded = decodeEventLog({
          abi: governorAbi, // Use the determined ABI
          eventName: 'ProposalCreated',
          topics: log.topics,
          data: log.data,
        });

        // Assert the type of decoded.args for accessing properties
        const currentId = (decoded.args as DecodedProposalCreatedLog)
          ?.proposalId;
        if (currentId !== undefined && currentId > latestProposalId) {
          latestProposalId = currentId;
          latestLog = log;
        }
      } catch (decodeError) {
        console.warn(
          `[fetchLatestOnchainProposal] Could not decode log:`,
          log,
          decodeError
        );
      }
    }

    if (latestProposalId === BigInt(0) || latestLog === undefined) {
      console.error(
        `[fetchLatestOnchainProposal] Found ProposalCreated events but couldn't extract a valid latest proposalId.`
      );
      return null;
    }
    console.log(
      `[fetchLatestOnchainProposal] Found latest proposal ID from event logs: ${latestProposalId}`
    );

    // Fetch proposal details using the determined latestProposalId and ABI
    let stateResult: number | undefined;
    let description: string | undefined;
    let proposer: Address | undefined;
    let targets: readonly Address[] | undefined;
    let values: readonly bigint[] | undefined;
    let calldatas: readonly `0x${string}`[] | undefined;
    let signatures: readonly string[] | undefined;
    let startBlock: bigint | undefined;
    let endBlock: bigint | undefined;

    // Fetch description and other details from the creation event log
    if (latestLog) {
      try {
        const decoded = decodeEventLog({
          abi: governorAbi, // Use determined ABI
          eventName: 'ProposalCreated',
          topics: latestLog.topics,
          data: latestLog.data,
        });
        // Assert the type of decoded.args
        const eventArgs = decoded.args as DecodedProposalCreatedLog;
        if (eventArgs) {
          description = eventArgs.description;
          proposer = eventArgs.proposer;
          targets = eventArgs.targets;
          values = eventArgs.values;
          calldatas = eventArgs.calldatas;
          signatures = eventArgs.signatures;
          startBlock = eventArgs.startBlock;
          endBlock = eventArgs.endBlock; // Get end block from event

          if (startBlock === undefined || endBlock === undefined) {
            throw new Error('Start or end block missing from event args');
          }

          // Fetch block data for timestamps using the blocks from the event
          const [startBlockData] = await Promise.all([
            publicClient.getBlock({ blockNumber: startBlock }),
          ]);

          const proposalStartBlock = Number(startBlock);
          const proposalEndBlock = Number(endBlock);
          const startAt = new Date(Number(startBlockData.timestamp) * 1000);

          // Fetch standard OZ Governor proposal data using the correct ABI
          const results = await Promise.allSettled([
            publicClient.readContract({
              address: governorAddress,
              abi: governorAbi, // Use determined ABI
              functionName: 'state',
              args: [latestProposalId],
            }),
            // Quorum requires the block number when voting started
            publicClient.readContract({
              address: governorAddress,
              abi: governorAbi, // Use determined ABI
              functionName: 'quorum',
              args: [startBlock], // Use event's startBlock
            }),
          ]);

          if (results.some((r) => r.status === 'rejected')) {
            console.error(
              `[fetchLatestOnchainProposal] Error fetching core proposal data for ID ${latestProposalId}:`,
              results
                .filter((r) => r.status === 'rejected')
                .map((r) => (r as PromiseRejectedResult).reason)
            );
            throw new Error('Failed to fetch core proposal data');
          }

          stateResult = (results[0] as PromiseFulfilledResult<number>).value;
          const quorum = (results[1] as PromiseFulfilledResult<bigint>).value;

          // Fetch Total Supply (ARB token is the same for both governors)
          const totalSupply = await publicClient.readContract({
            address: ARBITRUM_TOKEN_ADDRESS,
            abi: ARBITRUM_TOKEN_ABI,
            functionName: 'totalSupply',
          });

          const title = extractTitleFromDescription(description ?? '');
          const state = mapOnchainState(stateResult);
          const quorumValue = Number(quorum) / 10 ** 18; // Assuming 18 decimals

          const placeholderUuid = '11111111-1111-1111-1111-111111111111';

          // Create metadata ensuring JSON compatibility
          const metadataObj: Record<string, JsonValue> = {
            voteType: 'basic', // Defaulting for standard OZ governors
            quorumVotes: quorum.toString(),
            totalSupply: totalSupply.toString(),
            targets: targets ? [...targets] : [],
            values: values ? values.map(String) : [],
            calldatas: calldatas ? [...calldatas] : [],
            signatures: signatures ? [...signatures] : [],
          };

          const mappedProposal: Proposal = {
            id: placeholderUuid,
            externalId: latestProposalId.toString(),
            governorId: placeholderUuid,
            daoId: placeholderUuid,
            name: title,
            body: description ?? '',
            author: proposer || '0x...',
            url: `https://www.tally.xyz/gov/arbitrum/proposal/${latestProposalId}`, // Example URL might need adjustment per governor
            startAt,
            createdAt: startAt, // Approximate with startAt
            endAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // Add 7 days to current time
            blockCreatedAt: proposalStartBlock,
            markedSpam: false,
            quorum: quorumValue,
            blockStartAt: proposalStartBlock,
            blockEndAt: proposalEndBlock, // Use fetched endBlock
            proposalState: state,
            discussionUrl: null,
            txid: latestLog.transactionHash || null,
            choices: ['For', 'Against', 'Abstain'], // Standard for basic voting
            metadata: metadataObj as JsonValue,
          };

          console.log(
            `[fetchLatestOnchainProposal] Successfully mapped proposal:`,
            mappedProposal
          );
          return mappedProposal;
        } else {
          console.error(
            `[fetchLatestOnchainProposal] Event args missing for proposal ${latestProposalId}`
          );
          return null;
        }
      } catch (decodeOrFetchError) {
        console.error(
          `[fetchLatestOnchainProposal] Error decoding latest log or fetching block data:`,
          decodeOrFetchError
        );
        return null;
      }
    } else {
      console.error(
        `[fetchLatestOnchainProposal] No latest log found to extract details for proposal ${latestProposalId}`
      );
      return null;
    }
  } catch (error) {
    console.error(
      `[fetchLatestOnchainProposal] Error during fetch or processing for governor ${governorAddress}:`,
      error
    );
    if (error instanceof ContractFunctionExecutionError) {
      console.warn(
        `[fetchLatestOnchainProposal] Contract execution error, possibly proposal ID not found or invalid state.`
      );
    }
    return null;
  }
}

// --- Snapshot Stories Component ---
const SnapshotProposalStory: React.FC<{
  proposalType?: VoteType;
  governor: 'ARBITRUM_SNAPSHOT'; // Explicitly for Snapshot
}> = ({ proposalType, governor }) => {
  const [proposal, setProposal] = useState<MockProposal | null>(null); // State remains MockProposal for fetch
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const typeName = proposalType
    ? proposalType
        .replace('-', ' ')
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    : 'Latest';

  useEffect(() => {
    const fetchData = async () => {
      console.log(
        `[useEffect - Snapshot ${typeName}] Starting Snapshot fetch...`
      );
      setIsLoading(true);
      setError(false);
      setProposal(null);

      try {
        const fetchedProposal = await fetchLatestSnapshotProposal(
          TEST_SNAPSHOT_SPACE,
          TEST_SNAPSHOT_HUB_URL,
          proposalType
        );

        if (fetchedProposal) {
          if (
            proposalType &&
            fetchedProposal.metadata.voteType !== proposalType
          ) {
            console.warn(
              `[useEffect - Snapshot ${typeName}] Fetched proposal ${fetchedProposal.externalId} has type ${fetchedProposal.metadata.voteType}, but requested ${proposalType}. Displaying fetched proposal anyway.`
            );
          }
          setProposal(fetchedProposal);
          console.log(
            `[useEffect - Snapshot ${typeName}] Successfully fetched and set proposal:`,
            fetchedProposal.externalId
          );
        } else {
          console.error(
            `[useEffect - Snapshot ${typeName}] fetchLatestSnapshotProposal returned null.`
          );
          setError(true);
        }
      } catch (err) {
        console.error(
          `[useEffect - Snapshot ${typeName}] Error fetching proposal:`,
          err
        );
        setError(true);
      } finally {
        setIsLoading(false);
        console.log(
          `[useEffect - Snapshot ${typeName}] Fetch attempt finished.`
        );
      }
    };
    fetchData();
  }, [proposalType, typeName]); // Include typeName dependency

  if (isLoading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h2>Loading Snapshot {typeName} Proposal...</h2>
        <p>
          Fetching latest {typeName.toLowerCase()} proposal from Snapshot Hub (
          <code>{TEST_SNAPSHOT_HUB_URL}</code>) for space (
          <code>{TEST_SNAPSHOT_SPACE}</code>)...
        </p>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div style={{ padding: '20px', color: 'red', fontFamily: 'sans-serif' }}>
        <h2>Error Loading Snapshot {typeName} Proposal</h2>
        <p>
          Failed to load the latest {typeName.toLowerCase()} proposal data from
          Snapshot Hub (<code>{TEST_SNAPSHOT_HUB_URL}</code>) for space (
          <code>{TEST_SNAPSHOT_SPACE}</code>). Check console.
        </p>
      </div>
    );
  }

  // Cast MockProposal to the local Proposal interface for the VoteButton
  // Ensure metadata is correctly formatted as JsonValue
  const buttonProposal = {
    ...proposal,
    choices: proposal.choices, // Ensure this is string[]
    metadata: proposal.metadata as JsonValue, // Assert metadata as JsonValue
    // Ensure other fields align with the local Proposal interface if needed
    // If MockProposal is already compatible, direct usage might be okay
    // but casting provides clarity.
  } as Proposal; // Cast to the local Proposal interface

  return (
    <VoteButton
      governor={governor}
      proposal={buttonProposal} // Pass the casted proposal
      overwriteSnapshotSpace={TEST_SNAPSHOT_SPACE}
      overwriteSnapshotHub={TEST_SNAPSHOT_HUB_URL}
    />
  );
};

// --- On-Chain Stories Component ---
const OnchainProposalStory: React.FC<{
  governorAddress: Address;
  governor: 'ARBITRUM_CORE' | 'ARBITRUM_TREASURY';
  governorName: string;
}> = ({ governorAddress, governor, governorName }) => {
  const [proposal, setProposal] = useState<Proposal | null>(null); // Use local Proposal type
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      console.log(`[useEffect - Onchain ${governorName}] Starting fetch...`);
      setIsLoading(true);
      setError(false);
      setErrorMessage('');
      setProposal(null);

      try {
        // FetchLatestOnchainProposal now determines ABI internally
        const fetchedProposal =
          await fetchLatestOnchainProposal(governorAddress);

        if (fetchedProposal) {
          setProposal(fetchedProposal);
          console.log(
            `[useEffect - Onchain ${governorName}] Successfully fetched and set proposal:`,
            fetchedProposal.externalId
          );
        } else {
          console.error(
            `[useEffect - Onchain ${governorName}] fetchLatestOnchainProposal returned null.`
          );
          setError(true);
          setErrorMessage(
            `No proposal found for ${governorName} on local node.`
          );
        }
      } catch (err: unknown) {
        console.error(
          `[useEffect - Onchain ${governorName}] Error fetching proposal:`,
          err
        );
        setError(true);
        // Type check before accessing .message
        let message = 'Unknown error';
        if (err instanceof Error) {
          message = err.message;
        } else if (typeof err === 'string') {
          message = err;
        }
        setErrorMessage(`Error fetching proposal: ${message}`); // Safely set message
      } finally {
        setIsLoading(false);
        console.log(
          `[useEffect - Onchain ${governorName}] Fetch attempt finished.`
        );
      }
    };
    fetchData();
  }, [governorAddress, governorName]); // Re-fetch if governor changes

  if (isLoading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h2>Loading Latest {governorName} Proposal...</h2>
        <p>
          Fetching latest proposal data from local node (
          <code>{TEST_NODE_URL}</code>) for governor (
          <code>{governorAddress}</code>)...
        </p>
        <p>
          Ensure your local Anvil fork (<code>yarn dev:anvil</code>) is running
          and has a proposal created (e.g., by running the{' '}
          <code>vote-onchain.spec.ts</code> test setup).
        </p>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div style={{ padding: '20px', color: 'red', fontFamily: 'sans-serif' }}>
        <h2>Error Loading {governorName} Proposal</h2>
        <p>
          Failed to load the latest proposal data from local node (
          <code>{TEST_NODE_URL}</code>) for governor (
          <code>{governorAddress}</code>).
        </p>
        <p>{errorMessage || 'Unknown error occurred.'}</p>
        <p>
          Please check the browser&apos;s developer console and ensure your
          local Anvil fork is running with a relevant proposal.
        </p>
      </div>
    );
  }

  // Proposal is already of type Proposal | null, pass directly
  return <VoteButton governor={governor} proposal={proposal} />;
};

// --- Storybook Configuration ---
const meta: Meta<typeof VoteButton> = {
  title: 'DAO/Voting/VoteButton',
  component: VoteButton,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// --- Snapshot Stories ---
export const SnapshotBasic: Story = {
  render: () => (
    <SnapshotProposalStory proposalType='basic' governor='ARBITRUM_SNAPSHOT' />
  ),
  name: 'Snapshot - Basic',
};

export const SnapshotSingleChoice: Story = {
  render: () => (
    <SnapshotProposalStory
      proposalType='single-choice'
      governor='ARBITRUM_SNAPSHOT'
    />
  ),
  name: 'Snapshot - Single Choice',
};

export const SnapshotApproval: Story = {
  render: () => (
    <SnapshotProposalStory
      proposalType='approval'
      governor='ARBITRUM_SNAPSHOT'
    />
  ),
  name: 'Snapshot - Approval',
};

export const SnapshotQuadratic: Story = {
  render: () => (
    <SnapshotProposalStory
      proposalType='quadratic'
      governor='ARBITRUM_SNAPSHOT'
    />
  ),
  name: 'Snapshot - Quadratic',
};

export const SnapshotRankedChoice: Story = {
  render: () => (
    <SnapshotProposalStory
      proposalType='ranked-choice'
      governor='ARBITRUM_SNAPSHOT'
    />
  ),
  name: 'Snapshot - Ranked Choice',
};

export const SnapshotWeighted: Story = {
  render: () => (
    <SnapshotProposalStory
      proposalType='weighted'
      governor='ARBITRUM_SNAPSHOT'
    />
  ),
  name: 'Snapshot - Weighted',
};

// --- On-Chain Stories ---
export const OnChainArbitrumCore: Story = {
  render: () => (
    <OnchainProposalStory
      governorAddress={ARBITRUM_CORE_GOVERNOR_ADDRESS}
      governor='ARBITRUM_CORE'
      governorName='Arbitrum Core'
    />
  ),
  name: 'On-Chain - Arbitrum Core',
};

export const OnChainArbitrumTreasury: Story = {
  render: () => (
    <OnchainProposalStory
      governorAddress={ARBITRUM_TREASURY_GOVERNOR_ADDRESS}
      governor='ARBITRUM_TREASURY'
      governorName='Arbitrum Treasury'
    />
  ),
  name: 'On-Chain - Arbitrum Treasury',
};
