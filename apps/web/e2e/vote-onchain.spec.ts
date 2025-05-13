import { testWithSynpress } from '@synthetixio/synpress';
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright';
import type { Page } from '@playwright/test';
import basicSetup from './wallet-setup/basic.setup';
import {
  type Chain,
  createTestClient,
  http,
  publicActions,
  walletActions,
  type Address,
  parseEther,
  getEventSelector,
  decodeEventLog,
  type Log,
  type AbiEvent,
  type Abi,
} from 'viem';
import { arbitrum } from 'viem/chains';
import { ARBITRUM_TOKEN_ABI, ARBITRUM_TOKEN_ADDRESS } from '@/lib/constants';
import {
  ARBITRUM_CORE_GOVERNOR_ADDRESS,
  ARBITRUM_CORE_GOVERNOR_ABI,
  ARBITRUM_TREASURY_GOVERNOR_ADDRESS,
  ARBITRUM_TREASURY_GOVERNOR_ABI,
} from '@/lib/constants';

const test = testWithSynpress(metaMaskFixtures(basicSetup));
const { expect } = test;

// --- Constants ---
const TEST_NODE_URL = 'http://localhost:8545';
const TEST_NODE_WS_URL = 'ws://localhost:8545';
const DELEGATE_ACCOUNT: Address = '0x36f5dfa2D6cc313C5e984d22A8Ee4c12B905bCb8'; // Synpress uses this account via seed phrase
const DELEGATOR_ACCOUNT: Address = '0xeaFF9F354063395fcd141BE8A82f73b311725EEA';
const ATTRIBUTION_TEXT = 'voted via proposals.app';

const TEST_TIMEOUT = 400 * 1000; // Increased timeout for onchain interactions + block mining
const VOTE_CONFIRMATION_DELAY = 5 * 1000; // Time to wait after UI submission before API checks
const VERIFICATION_RETRY_DELAY = 5 * 1000;
const VERIFICATION_MAX_ATTEMPTS = 20; // Increased attempts for onchain event propagation

// --- Viem Test Client Setup ---
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

const testClient = createTestClient({
  chain: testnode,
  mode: 'anvil',
  transport: http(),
})
  .extend(publicActions)
  .extend(walletActions);

// --- Helper Types ---

// Define a type that is a union of the two governor ABIs to allow viem to infer types
type GovernorAbi =
  | typeof ARBITRUM_CORE_GOVERNOR_ABI
  | typeof ARBITRUM_TREASURY_GOVERNOR_ABI;

// Define a type for the VoteCast log arguments (generic enough for both ABIs)
type VoteCastEventArgs = {
  voter?: Address;
  proposalId?: bigint;
  support?: number;
  weight?: bigint;
  reason?: string;
  params?: string; // Added params as it can exist in VoteCastWithParams
};

// --- Helper Functions ---

const findEventAbi = (abi: Abi, eventName: string): AbiEvent | undefined =>
  abi.find((item) => item.type === 'event' && item.name === eventName) as
    | AbiEvent
    | undefined;

async function connectWallet(
  page: Page,
  metamask: MetaMask,
  metamaskPage: Page,
  testLogPrefix: string = ''
) {
  console.log(`${testLogPrefix} Connecting wallet...`);
  await expect(
    page.getByRole('button', { name: 'Connect Wallet' }),
    `${testLogPrefix} Connect Wallet button should be visible`
  ).toBeVisible({ timeout: 20000 });

  await page.getByTestId('rk-connect-button').click();
  await page.getByTestId('rk-wallet-option-io.metamask').click();

  await metamask.connectToDapp();

  try {
    const gotItButton = metamaskPage.getByRole('button', { name: 'Got it' });
    if (await gotItButton.isVisible({ timeout: 3000 })) {
      console.log(`${testLogPrefix} Handling Metamask 'Got it' button...`);
      await gotItButton.click();
    }
  } catch (e) {
    console.log(`${testLogPrefix} 'Got it' button not found, continuing...`);
  }

  try {
    await metamask.approveNewNetwork();
  } catch (e) {
    console.log(
      `${testLogPrefix} Approve new network skipped/failed, continuing...`
    );
  }
  try {
    await metamask.approveSwitchNetwork();
  } catch (e) {
    console.log(
      `${testLogPrefix} Approve switch network skipped/failed, continuing...`
    );
  }
  console.log(`${testLogPrefix} Wallet connected.`);
}

async function handlePotentialGotItButton(
  metamaskPage: Page,
  testLogPrefix: string = '',
  maxAttempts: number = 3
) {
  console.log(`${testLogPrefix} Checking for Metamask 'Got it' button...`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const gotItButton = metamaskPage.getByRole('button', { name: 'Got it' });
      const isVisible = await gotItButton.isVisible({ timeout: 2000 });

      if (isVisible) {
        console.log(
          `${testLogPrefix} 'Got it' button found on attempt ${attempt}, clicking...`
        );
        await gotItButton.click();
        console.log(`${testLogPrefix} 'Got it' button clicked successfully.`);
        return true;
      } else if (attempt < maxAttempts) {
        console.log(
          `${testLogPrefix} 'Got it' button not visible on attempt ${attempt}, waiting before next check...`
        );
        await metamaskPage.waitForTimeout(1000);
      }
    } catch (e) {
      console.error(
        `${testLogPrefix} Error checking for 'Got it' button on attempt ${attempt}: ${e}`
      );
      if (attempt < maxAttempts) {
        await metamaskPage.waitForTimeout(1000);
      }
    }
  }

  console.log(
    `${testLogPrefix} 'Got it' button did not appear after ${maxAttempts} attempts, continuing.`
  );
  return false;
}

async function submitVoteAndConfirmMetamaskTx(
  page: Page,
  metamaskPage: Page,
  metamask: MetaMask,
  testLogPrefix: string = '',
  confirmationDelay: number = VOTE_CONFIRMATION_DELAY
) {
  const submitVoteButton = page.getByRole('button', { name: 'Submit Vote' });
  await expect(
    submitVoteButton,
    `${testLogPrefix} Submit Vote button should be enabled`
  ).toBeEnabled();
  await submitVoteButton.click();

  await metamaskPage.waitForTimeout(1000);
  await handlePotentialGotItButton(metamaskPage, testLogPrefix);

  console.log(`${testLogPrefix} Confirming vote transaction in Metamask...`);
  // This confirms the transaction in the Metamask popup.
  // It does NOT wait for the transaction to be mined or confirmed onchain.
  await metamask.confirmTransaction();

  console.log(
    `${testLogPrefix} Vote submitted via UI and confirmed in Metamask. Waiting ${confirmationDelay / 1000}s before searching for onchain event...`
  );
  // Wait a short period for the transaction to potentially reach the node/mempool
  await page.waitForTimeout(confirmationDelay);

  // We don't return the tx hash here, as the subsequent step will find the tx via event
}

async function createAndActivateProposal(
  governorAddress: Address,
  governorAbi: GovernorAbi, // Use specific GovernorAbi type
  testLogPrefix: string = ''
): Promise<bigint> {
  // 1. Fund Proposer Account (ensure sufficient balance for proposal)
  console.log(
    `${testLogPrefix} Ensuring ${DELEGATE_ACCOUNT} has sufficient funds...`
  );
  const currentProposerBalance = await testClient.getBalance({
    address: DELEGATE_ACCOUNT,
  });
  if (currentProposerBalance < parseEther('1')) {
    await testClient.setBalance({
      address: DELEGATE_ACCOUNT,
      value: parseEther('10'), // Fund with 10 ETH if low
    });
    await testClient.mine({ blocks: 1 });
    console.log(`${testLogPrefix} Funded ${DELEGATE_ACCOUNT}.`);
  }
  console.log(
    `${testLogPrefix} Proposer balance is sufficient: ${currentProposerBalance}`
  );

  // 2. Create Proposal
  console.log(
    `${testLogPrefix} Impersonating ${DELEGATE_ACCOUNT} to create proposal...`
  );
  await testClient.impersonateAccount({ address: DELEGATE_ACCOUNT });

  const targets: Address[] = [governorAddress]; // Target the governor itself (example)
  const values: bigint[] = [BigInt(0)]; // Example value
  const calldatas: `0x${string}`[] = ['0x']; // Example calldata (empty)
  const description = `${testLogPrefix} Proposal - ${new Date().toISOString()}`;

  console.log(
    `${testLogPrefix} Creating proposal on contract: ${governorAddress}`
  );
  console.log(
    `${testLogPrefix} Proposal details: description="${description}"`
  );

  // viem should infer the correct `propose` function signature from governorAbi
  const proposeTxHash = await testClient.writeContract({
    address: governorAddress,
    abi: governorAbi,
    functionName: 'propose',
    args: [targets, values, calldatas, description],
    account: DELEGATE_ACCOUNT,
  });

  console.log(`${testLogPrefix} Proposal transaction hash: ${proposeTxHash}`);
  const proposeReceipt = await testClient.waitForTransactionReceipt({
    hash: proposeTxHash,
    timeout: 30000, // Increased timeout
  });

  expect(
    proposeReceipt.status,
    `${testLogPrefix} Proposal transaction should succeed`
  ).toBe('success');
  console.log(
    `${testLogPrefix} Proposal creation successful. Tx: ${proposeTxHash}`
  );

  // Extract Proposal ID from event
  const proposalCreatedEventAbi = findEventAbi(governorAbi, 'ProposalCreated');
  if (!proposalCreatedEventAbi) {
    throw new Error('ProposalCreated event not found in provided ABI');
  }

  const proposalCreatedEventTopic = getEventSelector(proposalCreatedEventAbi);
  const proposalCreatedEventLog = proposeReceipt.logs.find(
    (log) =>
      log.address.toLowerCase() === governorAddress.toLowerCase() &&
      log.topics[0] === proposalCreatedEventTopic
  );

  let proposalId: bigint | undefined;
  if (proposalCreatedEventLog) {
    try {
      // Decode event log using the specific ProposalCreated ABI item
      const decodedEvent = decodeEventLog({
        abi: [proposalCreatedEventAbi], // Decode using only the specific event ABI item
        eventName: 'ProposalCreated',
        data: proposalCreatedEventLog.data as `0x${string}`,
        topics: proposalCreatedEventLog.topics as [
          signature: `0x${string}`,
          ...args: `0x${string}`[],
        ],
      });
      // Type assertion needed as the structure varies slightly based on ABI
      const args = decodedEvent.args as { proposalId?: bigint };
      if (args && typeof args.proposalId === 'bigint') {
        proposalId = args.proposalId;
        console.log(
          `${testLogPrefix} Successfully decoded Proposal ID: ${proposalId}`
        );
      }
    } catch (e) {
      console.error(
        `${testLogPrefix} Failed to decode ProposalCreated event log:`,
        e
      );
    }
  }
  if (proposalId === undefined) {
    console.error(
      `${testLogPrefix} Could not find ProposalCreated event log in transaction ${proposeTxHash}. Logs:`,
      proposeReceipt.logs
    );
    throw new Error('Failed to extract proposalId from transaction receipt.');
  }

  // 3. Mine blocks past voting delay
  console.log(`${testLogPrefix} Mining blocks to pass voting delay...`);
  // viem should infer the correct `votingDelay` function signature from governorAbi
  const votingDelay = await testClient.readContract({
    address: governorAddress,
    abi: governorAbi,
    functionName: 'votingDelay',
    args: [],
  });
  const blocksToMine = Number(votingDelay) + 1;
  console.log(
    `${testLogPrefix} Voting delay is ${votingDelay} blocks. Mining ${blocksToMine} blocks...`
  );

  const CHUNK_SIZE = 1000;
  let remainingBlocks = blocksToMine;
  let minedSoFar = 0;
  while (remainingBlocks > 0) {
    const blocksInThisChunk = Math.min(CHUNK_SIZE, remainingBlocks);

    console.log(
      `Mining chunk of ${blocksInThisChunk} blocks (${minedSoFar + blocksInThisChunk}/${blocksToMine})...`
    );
    await testClient.mine({ blocks: blocksInThisChunk });
    remainingBlocks -= blocksInThisChunk;
    minedSoFar += blocksInThisChunk;
  }

  console.log(`Finished mining ${blocksToMine} blocks.`);

  // 4. Verify Proposal State is Active
  // viem should infer the correct `state` function signature from governorAbi
  const proposalStateAfterDelay = await testClient.readContract({
    address: governorAddress,
    abi: governorAbi,
    functionName: 'state',
    args: [proposalId],
  });
  expect(
    proposalStateAfterDelay,
    `${testLogPrefix} Proposal state should be Active (1) after voting delay`
  ).toBe(1); // Enum: 1: Active
  console.log(
    `${testLogPrefix} Verified: Proposal ${proposalId} state is Active (1).`
  );

  await testClient.stopImpersonatingAccount({ address: DELEGATE_ACCOUNT });
  console.log(`${testLogPrefix} Stopped impersonating ${DELEGATE_ACCOUNT}`);

  return proposalId;
}

async function waitForVoteCastEventLog(
  governorAddress: Address,
  governorAbi: GovernorAbi, // Use specific GovernorAbi type
  proposalId: bigint,
  testLogPrefix: string = '',
  maxAttempts: number = VERIFICATION_MAX_ATTEMPTS,
  retryDelay: number = VERIFICATION_RETRY_DELAY
): Promise<Log> {
  console.log(
    `${testLogPrefix} Waiting for VoteCast event for proposal ${proposalId} on governor ${governorAddress}...`
  );

  let foundLog: Log | undefined;
  let attempt = 0;
  const searchBlockRange = 2000; // Search the last X blocks

  // Use the provided ABI to find the event definitions
  const voteCastLogAbi = findEventAbi(governorAbi, 'VoteCast');
  // Also check for VoteCastWithParams as some governors use it
  const voteCastWithParamsLogAbi = findEventAbi(
    governorAbi,
    'VoteCastWithParams'
  );

  if (!voteCastLogAbi && !voteCastWithParamsLogAbi) {
    throw new Error('VoteCast or VoteCastWithParams event ABI not found.');
  }

  while (attempt < maxAttempts) {
    attempt++;
    console.log(
      `${testLogPrefix} [Event Poll Attempt ${attempt}/${maxAttempts}] Checking for VoteCast event...`
    );

    try {
      const currentBlock = await testClient.getBlockNumber();
      // Ensure fromBlock is not negative
      const fromBlock = BigInt(
        Math.max(
          0,
          Number(
            currentBlock > BigInt(searchBlockRange)
              ? currentBlock - BigInt(searchBlockRange)
              : 0
          )
        )
      );

      console.log(
        `${testLogPrefix} Searching logs from block ${fromBlock} to latest (${currentBlock}) using getLogs...`
      );

      // Use getLogs with filters for address and event ABIs
      // Filter by proposalId and voter in getLogs args is more efficient if indexed
      // The `event` parameter with a const ABI type allows viem to use the correct topic and indexed args.
      const logs = await testClient.getLogs({
        address: governorAddress,
        // Use the union of the potential event ABIs if both exist, or just the one found
        // Providing an array of potential events allows viem to filter by multiple topics
        events: [voteCastLogAbi, voteCastWithParamsLogAbi].filter(Boolean) as [
          AbiEvent,
          ...AbiEvent[],
        ],
        args: {
          // Assuming voter (indexed arg 0 after signature) and proposalId (indexed arg 1)
          voter: DELEGATE_ACCOUNT,
          proposalId: proposalId,
        } as any, // Use any here because the specific indexed args might differ slightly between VoteCast and VoteCastWithParams, but viem's getLogs can handle filtering if the names match.
        fromBlock: fromBlock,
        toBlock: 'latest',
      });

      console.log(
        `${testLogPrefix} [Event Poll Attempt ${attempt}] Found ${logs.length} potential VoteCast logs matching filters (proposalId: ${proposalId}, voter: ${DELEGATE_ACCOUNT}).`
      );

      if (logs.length > 0) {
        // Found at least one log matching address, event signature, proposalId, and voter
        // Take the first one as we expect exactly one vote from DELEGATE_ACCOUNT per proposal in this test
        foundLog = logs[0]; // This is a Log object
        console.log(
          `${testLogPrefix} Found matching VoteCast event in transaction ${foundLog.transactionHash} for voter ${DELEGATE_ACCOUNT}.`
        );
        break; // Found the log, exit polling loop
      }
    } catch (error) {
      console.error(
        `${testLogPrefix} [Event Poll Attempt ${attempt}] Error fetching logs:`,
        error
      );
      // Continue polling on error, might be a transient node issue
    }

    if (!foundLog && attempt < maxAttempts) {
      console.log(
        `${testLogPrefix} VoteCast event not found yet. Waiting ${retryDelay / 1000}s before next attempt...`
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  if (!foundLog) {
    throw new Error(
      `${testLogPrefix} VoteCast event not found after ${maxAttempts} attempts.`
    );
  }

  console.log(
    `${testLogPrefix} VoteCast event log found. Transaction Hash: ${foundLog.transactionHash}, Block Number: ${foundLog.blockNumber}.`
  );

  // Return the raw Log object
  return foundLog;
}

async function verifyVoteOnchain(
  governorAddress: Address,
  governorAbi: GovernorAbi, // Use specific GovernorAbi type
  proposalId: bigint,
  voteCastLog: Log,
  expectedSupport: number, // 0=Against, 1=For, 2=Abstain
  expectedReasonContains: string,
  testLogPrefix: string = ''
): Promise<void> {
  // Wrap the entire verification logic in a try...catch
  try {
    console.log(
      `${testLogPrefix} Verifying vote details from found VoteCast event log and checking onchain state:`
    );
    console.log(`  Tx Hash: ${voteCastLog.transactionHash}`);
    console.log(`  Block: ${voteCastLog.blockNumber}`);
    console.log(`  Log Index: ${voteCastLog.logIndex}`);
    console.log(`  Log Address (Contract): ${voteCastLog.address}`);
    console.log(
      `  Expected Support (0=Against, 1=For, 2=Abstain): ${expectedSupport}`
    );
    console.log(`  Expected Reason to contain: "${expectedReasonContains}"`);
    console.log(`  Expected Proposal ID: ${proposalId}`);

    let decodedEventArgs: VoteCastEventArgs | undefined;
    let decodedEventName: 'VoteCast' | 'VoteCastWithParams' | undefined;

    // Attempt to decode using VoteCast first
    const specificVoteCastAbiItem = findEventAbi(governorAbi, 'VoteCast');
    if (specificVoteCastAbiItem) {
      try {
        const decodedEvent = decodeEventLog({
          abi: [specificVoteCastAbiItem],
          data: voteCastLog.data,
          topics: voteCastLog.topics,
        });
        decodedEventArgs = decodedEvent.args as VoteCastEventArgs;
        decodedEventName = 'VoteCast';
      } catch (e) {
        // Decoding failed as VoteCast, try VoteCastWithParams next if available
        console.log(
          `${testLogPrefix} Decoding as VoteCast failed, trying VoteCastWithParams...`
        );
      }
    }

    // If decoding as VoteCast failed or was not attempted, try VoteCastWithParams
    if (!decodedEventArgs) {
      const specificVoteCastWithParamsAbiItem = findEventAbi(
        governorAbi,
        'VoteCastWithParams'
      );
      if (specificVoteCastWithParamsAbiItem) {
        try {
          const decodedEventWithParams = decodeEventLog({
            abi: [specificVoteCastWithParamsAbiItem],
            data: voteCastLog.data,
            topics: voteCastLog.topics,
          });
          // Map VoteCastWithParams args to VoteCastEventArgs structure for consistency
          const argsWithParams = decodedEventWithParams.args as any; // Use any for flexible access
          decodedEventArgs = {
            voter: argsWithParams.voter,
            proposalId: argsWithParams.proposalId,
            support: argsWithParams.support,
            weight: argsWithParams.weight,
            reason: argsWithParams.reason,
            params: argsWithParams.params,
          };
          decodedEventName = 'VoteCastWithParams';
        } catch (e) {
          console.error(
            `${testLogPrefix} Decoding as VoteCastWithParams also failed:`,
            e
          );
          // If both fail, throw the original error
          throw new Error(
            'Failed to decode VoteCast or VoteCastWithParams event log.'
          );
        }
      } else {
        // If VoteCast decoding failed and VoteCastWithParams ABI is not available
        throw new Error(
          'VoteCast event decoding failed, and VoteCastWithParams ABI not found.'
        );
      }
    }

    if (!decodedEventArgs) {
      // This case should technically not be reachable if the logic above works, but as a safeguard
      throw new Error('Failed to decode VoteCast event log.');
    }

    console.log(
      `${testLogPrefix} Decoded event (${decodedEventName}) args:`,
      JSON.stringify(
        decodedEventArgs,
        (key, value) => (typeof value === 'bigint' ? value.toString() : value), // Convert BigInts for logging
        2
      )
    );

    // Perform assertions on decoded event arguments
    expect(
      decodedEventArgs.voter?.toLowerCase(),
      `${testLogPrefix} Voter address mismatch in event args`
    ).toBe(DELEGATE_ACCOUNT.toLowerCase());
    expect(
      decodedEventArgs.proposalId,
      `${testLogPrefix} Proposal ID mismatch in event args`
    ).toBe(proposalId);
    expect(
      decodedEventArgs.support,
      `${testLogPrefix} Support (vote way) mismatch in event args`
    ).toBe(expectedSupport);
    expect(
      decodedEventArgs.reason,
      `${testLogPrefix} Reason mismatch in event args (Expected to contain: "${expectedReasonContains}", Got: "${decodedEventArgs.reason}")`
    ).toContain(expectedReasonContains);

    console.log(`${testLogPrefix} Event log details successfully verified.`);

    // --- NEW VERIFICATION: Check onchain state using contract reads ---

    // 1. Check if hasVoted is true for the voter and proposal
    console.log(
      `${testLogPrefix} Checking hasVoted(${proposalId}, ${DELEGATE_ACCOUNT})...`
    );
    const hasVoted = await testClient.readContract({
      address: governorAddress,
      abi: governorAbi,
      functionName: 'hasVoted',
      args: [proposalId, DELEGATE_ACCOUNT],
    });
    console.log(`${testLogPrefix} hasVoted result: ${hasVoted}`);
    expect(
      hasVoted,
      `${testLogPrefix} hasVoted should be true for the voter and proposal after casting vote`
    ).toBe(true);

    // 2. Check the proposal vote tally
    console.log(`${testLogPrefix} Checking proposalVotes(${proposalId})...`);
    const proposalVotesRaw = await testClient.readContract({
      address: governorAddress,
      abi: governorAbi,
      functionName: 'proposalVotes',
      args: [proposalId],
    });

    // Explicitly handle the tuple vs object type from proposalVotes
    let proposalVotes: {
      againstVotes: bigint;
      forVotes: bigint;
      abstainVotes: bigint;
    };
    if (Array.isArray(proposalVotesRaw) && proposalVotesRaw.length === 3) {
      // Assuming the tuple order is [against, for, abstain] as per common OZ governors
      proposalVotes = {
        againstVotes: proposalVotesRaw[0],
        forVotes: proposalVotesRaw[1],
        abstainVotes: proposalVotesRaw[2],
      };
      console.log(
        `${testLogPrefix} proposalVotes decoded as tuple [against, for, abstain].`
      );
    } else if (
      typeof proposalVotesRaw === 'object' &&
      proposalVotesRaw !== null &&
      'forVotes' in proposalVotesRaw
    ) {
      // Assuming viem returned an object directly - cast to unknown first
      proposalVotes = proposalVotesRaw as unknown as {
        againstVotes: bigint;
        forVotes: bigint;
        abstainVotes: bigint;
      };
      console.log(
        `${testLogPrefix} proposalVotes decoded as object { againstVotes, forVotes, abstainVotes }.`
      );
    } else {
      console.error(
        `${testLogPrefix} Unexpected type or structure for proposalVotes:`,
        proposalVotesRaw
      );
      throw new Error(
        `Unexpected proposalVotes return type. Expected tuple or object, got ${typeof proposalVotesRaw}`
      );
    }

    console.log(
      `${testLogPrefix} proposalVotes result:`,
      JSON.stringify(
        proposalVotes,
        (key, value) => (typeof value === 'bigint' ? value.toString() : value),
        2
      )
    );

    // Map expectedSupport (0=Against, 1=For, 2=Abstain) to the correct key
    let voteTallyKey: keyof typeof proposalVotes;
    switch (expectedSupport) {
      case 1: // For
        voteTallyKey = 'forVotes';
        break;
      case 0: // Against
        voteTallyKey = 'againstVotes';
        break;
      case 2: // Abstain
        voteTallyKey = 'abstainVotes';
        break;
      default:
        throw new Error(`Invalid expectedSupport value: ${expectedSupport}`);
    }

    console.log(
      `${testLogPrefix} Expected vote tally key to increase: ${String(voteTallyKey)}` // Explicit String conversion for logging
    );

    // Assert that the tally for the chosen support matches the weight from the event.
    expect(
      proposalVotes[voteTallyKey],
      `${testLogPrefix} Onchain vote tally for ${String(voteTallyKey)} should match the weight from the VoteCast event` // Explicit String conversion for logging
    ).toBe(decodedEventArgs.weight);

    console.log(
      `${testLogPrefix} Vote successfully verified via event details AND onchain state (hasVoted, proposalVotes tally).`
    );
  } catch (e) {
    // Correctly placed catch block
    console.error(
      `${testLogPrefix} Failed during vote verification (decoding event or checking onchain state):`, // testLogPrefix is now in scope
      e
    );
    // Log data and topics from the raw log object (voteCastLog is now in scope)
    console.error('Log data:', voteCastLog.data);
    console.error('Log topics:', voteCastLog.topics);
    throw e; // Re-throw the error to fail the test
  }
} // End of verifyVoteOnchain function

// --- Test Suite ---
test.describe.serial('Onchain Voting E2E Tests', () => {
  // --- Setup: Ensure accounts are funded and delegation is set ---
  test.beforeAll(async () => {
    console.log('[Setup] Starting beforeAll setup...');
    test.setTimeout(120 * 1000); // Increase timeout for setup

    await testClient.setAutomine(true);
    await testClient.setIntervalMining({ interval: 1 });
    await new Promise((res) => setTimeout(res, 1000)); // Stability pause

    // 1. Fund Accounts
    console.log(`[Setup] Funding accounts...`);
    await testClient.setBalance({
      address: DELEGATOR_ACCOUNT,
      value: parseEther('100'),
    });
    await testClient.setBalance({
      address: DELEGATE_ACCOUNT, // Metamask account needs ETH too
      value: parseEther('100'),
    });
    await testClient.mine({ blocks: 1 });
    console.log('[Setup] Accounts funded.');

    // 2. Delegate Voting Power (if not already done or if state resets)
    // We check current delegation first to avoid unnecessary transactions
    const currentDelegate = await testClient.readContract({
      address: ARBITRUM_TOKEN_ADDRESS,
      abi: ARBITRUM_TOKEN_ABI,
      functionName: 'delegates',
      args: [DELEGATOR_ACCOUNT],
    });

    if (currentDelegate.toLowerCase() !== DELEGATE_ACCOUNT.toLowerCase()) {
      console.log(
        `[Setup] Setting up delegation from ${DELEGATOR_ACCOUNT} to ${DELEGATE_ACCOUNT}`
      );
      await testClient.impersonateAccount({ address: DELEGATOR_ACCOUNT });
      // Need to mint tokens if delegator has none for the delegation to have power
      // For now, assume the forked state has tokens or test doesn't rely on vote weight > 0
      console.log(
        `[Setup] Delegating from ${DELEGATOR_ACCOUNT} to ${DELEGATE_ACCOUNT}...`
      );
      const delegateTxHash = await testClient.writeContract({
        address: ARBITRUM_TOKEN_ADDRESS,
        abi: ARBITRUM_TOKEN_ABI,
        functionName: 'delegate',
        args: [DELEGATE_ACCOUNT],
        account: DELEGATOR_ACCOUNT,
      });
      const delegateReceipt = await testClient.waitForTransactionReceipt({
        hash: delegateTxHash,
        timeout: 15000,
      });
      expect(
        delegateReceipt.status,
        '[Setup] Delegation transaction should succeed'
      ).toBe('success');
      console.log(`[Setup] Delegation successful. Tx: ${delegateTxHash}`);
      await testClient.stopImpersonatingAccount({ address: DELEGATOR_ACCOUNT });
    } else {
      console.log(
        `[Setup] Delegation from ${DELEGATOR_ACCOUNT} to ${DELEGATE_ACCOUNT} already set.`
      );
    }
    const finalDelegateCheck = await testClient.readContract({
      address: ARBITRUM_TOKEN_ADDRESS,
      abi: ARBITRUM_TOKEN_ABI,
      functionName: 'delegates',
      args: [DELEGATOR_ACCOUNT],
    });
    expect(
      finalDelegateCheck,
      '[Setup] Delegator should delegate to Proposer/Metamask account'
    ).toBe(DELEGATE_ACCOUNT);
    console.log('[Setup] beforeAll setup complete.');
  });

  // --- Test Case ---
  test('[Arbitrum Core] should create proposal, vote random choice via UI, verify via onchain event and state', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const testLogPrefix = '[Arbitrum Core]';
    const governorAddress = ARBITRUM_CORE_GOVERNOR_ADDRESS;
    const governorAbi = ARBITRUM_CORE_GOVERNOR_ABI;
    const choices = ['For', 'Against', 'Abstain'];
    let proposalId: bigint;
    const uniqueReasonNonce = `onchain-core-test-run-${Date.now()}`;
    const expectedReasonString = `${uniqueReasonNonce}\n${ATTRIBUTION_TEXT}`; // The UI appends ATTRIBUTION_TEXT

    // 1. Create and activate a new proposal for this test run
    proposalId = await createAndActivateProposal(
      governorAddress,
      governorAbi,
      testLogPrefix
    );
    console.log(`${testLogPrefix} Using Proposal ID: ${proposalId}`);

    // 2. Setup Metamask and navigate
    const metamask = new MetaMask(
      context,
      metamaskPage,
      basicSetup.walletPassword,
      extensionId
    );
    await page.goto(
      'http://localhost:61000/?story=vote-button--on--chain--arbitrum-core'
    );

    // 3. Connect Wallet
    await connectWallet(page, metamask, metamaskPage, testLogPrefix);

    // 4. Vote via UI (Select choice and enter reason)
    console.log(`${testLogPrefix} Voting via UI...`);
    const voteButton = page.getByRole('button', { name: 'Cast Your Vote' });
    await expect(
      voteButton,
      `${testLogPrefix} Cast Your Vote button should be visible`
    ).toBeVisible({ timeout: 30000 });
    await voteButton.click();

    const dialogLocator = page.locator('div[role="dialog"]');
    await expect(
      dialogLocator,
      `${testLogPrefix} Vote modal dialog should be visible`
    ).toBeVisible({ timeout: 10000 });
    const proposalTitleLocator = dialogLocator.locator('h2');
    await expect(
      proposalTitleLocator,
      `${testLogPrefix} Modal title should be visible`
    ).toBeVisible({ timeout: 10000 });
    console.log(`${testLogPrefix} Modal opened and title verified.`);

    const randomIndex = Math.floor(Math.random() * choices.length);
    const choiceToSelect = choices[randomIndex];
    // Map UI choice text to numeric support value (0=Against, 1=For, 2=Abstain)
    // Standard OpenZeppelin Governor support values: 0: Against, 1: For, 2: Abstain
    const expectedSupportValue =
      randomIndex === 0 ? 1 : randomIndex === 1 ? 0 : 2;

    console.log(
      `${testLogPrefix} Randomly selected choice: "${choiceToSelect}" (Index: ${randomIndex}, Expected Onchain Support: ${expectedSupportValue})`
    );

    const choiceRadioButton = dialogLocator.getByRole('radio', {
      name: choiceToSelect,
    });
    await expect(
      choiceRadioButton,
      `${testLogPrefix} Choice radio button should be visible`
    ).toBeVisible({ timeout: 10000 });
    await choiceRadioButton.check();

    console.log(
      `${testLogPrefix} Filling reason with nonce: "${uniqueReasonNonce}"`
    );
    const reasonTextArea = dialogLocator.locator('textarea#reason');
    await expect(
      reasonTextArea,
      `${testLogPrefix} Reason textarea should be visible`
    ).toBeVisible();
    await reasonTextArea.fill(uniqueReasonNonce, { timeout: 1000 });

    // 5. Submit Vote and Confirm Transaction in Metamask
    // This triggers the transaction but does not wait for it to be mined.
    await submitVoteAndConfirmMetamaskTx(
      page,
      metamaskPage,
      metamask,
      testLogPrefix,
      VOTE_CONFIRMATION_DELAY
    );

    // 6. Wait for and find the VoteCast event log onchain using getLogs with filtering
    console.log(
      `${testLogPrefix} Starting onchain event log search process...`
    );
    const voteCastLog = await waitForVoteCastEventLog(
      governorAddress,
      governorAbi,
      proposalId,
      testLogPrefix
    );

    // 7. Verify Vote details using the found event log AND check onchain state
    await verifyVoteOnchain(
      governorAddress,
      governorAbi,
      proposalId,
      voteCastLog,
      expectedSupportValue,
      expectedReasonString,
      testLogPrefix
    );

    console.log(`${testLogPrefix} Test completed successfully.`);
  });

  // --- NEW TEST CASE ---
  test('[Arbitrum Treasury] should create proposal, vote random choice via UI, verify via onchain event and state', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const testLogPrefix = '[Arbitrum Treasury]';
    const governorAddress = ARBITRUM_TREASURY_GOVERNOR_ADDRESS;
    const governorAbi = ARBITRUM_TREASURY_GOVERNOR_ABI;
    const choices = ['For', 'Against', 'Abstain'];
    let proposalId: bigint;
    const uniqueReasonNonce = `onchain-treasury-test-run-${Date.now()}`;
    const expectedReasonString = `${uniqueReasonNonce}\n${ATTRIBUTION_TEXT}`;

    // 1. Create and activate a new proposal for this test run ON THE TREASURY GOVERNOR
    proposalId = await createAndActivateProposal(
      governorAddress,
      governorAbi,
      testLogPrefix
    );
    console.log(`${testLogPrefix} Using Proposal ID: ${proposalId}`);

    // 2. Setup Metamask and navigate to the TREASURY story
    const metamask = new MetaMask(
      context,
      metamaskPage,
      basicSetup.walletPassword,
      extensionId
    );
    await page.goto(
      'http://localhost:61000/?story=vote-button--on--chain--arbitrum-treasury'
    );

    // 3. Connect Wallet
    await connectWallet(page, metamask, metamaskPage, testLogPrefix);

    // 4. Vote via UI (Select choice and enter reason)
    console.log(`${testLogPrefix} Voting via UI...`);
    const voteButton = page.getByRole('button', { name: 'Cast Your Vote' });
    await expect(
      voteButton,
      `${testLogPrefix} Cast Your Vote button should be visible`
    ).toBeVisible({ timeout: 30000 });
    await voteButton.click();

    const dialogLocator = page.locator('div[role="dialog"]');
    await expect(
      dialogLocator,
      `${testLogPrefix} Vote modal dialog should be visible`
    ).toBeVisible({ timeout: 10000 });
    const proposalTitleLocator = dialogLocator.locator('h2');
    await expect(
      proposalTitleLocator,
      `${testLogPrefix} Modal title should be visible`
    ).toBeVisible({ timeout: 10000 });
    console.log(`${testLogPrefix} Modal opened and title verified.`);

    const randomIndex = Math.floor(Math.random() * choices.length);
    const choiceToSelect = choices[randomIndex];
    const expectedSupportValue =
      randomIndex === 0 ? 1 : randomIndex === 1 ? 0 : 2;

    console.log(
      `${testLogPrefix} Randomly selected choice: "${choiceToSelect}" (Index: ${randomIndex}, Expected Onchain Support: ${expectedSupportValue})`
    );

    const choiceRadioButton = dialogLocator.getByRole('radio', {
      name: choiceToSelect,
    });
    await expect(
      choiceRadioButton,
      `${testLogPrefix} Choice radio button should be visible`
    ).toBeVisible({ timeout: 10000 });
    await choiceRadioButton.check();

    console.log(
      `${testLogPrefix} Filling reason with nonce: "${uniqueReasonNonce}"`
    );
    const reasonTextArea = dialogLocator.locator('textarea#reason');
    await expect(
      reasonTextArea,
      `${testLogPrefix} Reason textarea should be visible`
    ).toBeVisible();
    await reasonTextArea.fill(uniqueReasonNonce, { timeout: 1000 });

    // 5. Submit Vote and Confirm Transaction in Metamask
    await submitVoteAndConfirmMetamaskTx(
      page,
      metamaskPage,
      metamask,
      testLogPrefix,
      VOTE_CONFIRMATION_DELAY
    );

    // 6. Wait for and find the VoteCast event log onchain using getLogs with filtering
    console.log(
      `${testLogPrefix} Starting onchain event log search process...`
    );
    const voteCastLog = await waitForVoteCastEventLog(
      governorAddress,
      governorAbi,
      proposalId,
      testLogPrefix
    );

    // 7. Verify Vote details using the found event log AND check onchain state
    await verifyVoteOnchain(
      governorAddress,
      governorAbi,
      proposalId,
      voteCastLog,
      expectedSupportValue,
      expectedReasonString,
      testLogPrefix
    );

    console.log(`${testLogPrefix} Test completed successfully.`);
  });
});
