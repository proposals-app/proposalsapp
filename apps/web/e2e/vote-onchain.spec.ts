import { testWithSynpress } from '@synthetixio/synpress';
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright';
import type { Page, Locator } from '@playwright/test';
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
  type TransactionReceipt,
  parseAbiItem,
  type Log, // Import Log type
  type AbiEvent, // Import AbiEvent type
} from 'viem';
import { arbitrum } from 'viem/chains';
import { ARBITRUM_TOKEN_ABI, ARBITRUM_TOKEN_ADDRESS } from '@/lib/constants';
import {
  ARBITRUM_CORE_GOVERNOR_ADDRESS,
  ARBITRUM_CORE_GOVERNOR_ABI,
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

// --- Helper Functions ---

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
      console.log(
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

  const targets: Address[] = [ARBITRUM_CORE_GOVERNOR_ADDRESS]; // Example target
  const values: bigint[] = [BigInt(0)]; // Example value
  const calldatas: `0x${string}`[] = ['0x']; // Example calldata (empty)
  const description = `E2E Onchain Test Proposal - ${new Date().toISOString()}`;

  console.log(
    `${testLogPrefix} Creating proposal on contract: ${ARBITRUM_CORE_GOVERNOR_ADDRESS}`
  );
  console.log(
    `${testLogPrefix} Proposal details: description="${description}"`
  );

  const proposeTxHash = await testClient.writeContract({
    address: ARBITRUM_CORE_GOVERNOR_ADDRESS,
    abi: ARBITRUM_CORE_GOVERNOR_ABI,
    functionName: 'propose',
    args: [targets, values, calldatas, description],
    account: DELEGATE_ACCOUNT, // Impersonated account creating proposal
  });

  console.log(`${testLogPrefix} Proposal transaction hash: ${proposeTxHash}`);
  const proposeReceipt = await testClient.waitForTransactionReceipt({
    hash: proposeTxHash,
    timeout: 30000, // Increased timeout
  });

  expect(proposeReceipt.status, 'Proposal transaction should succeed').toBe(
    'success'
  );
  console.log(
    `${testLogPrefix} Proposal creation successful. Tx: ${proposeTxHash}`
  );

  // Extract Proposal ID from event
  // We still need this to get the proposal ID to verify the state later
  // and to filter for the VoteCast event
  const proposalCreatedEventSignature =
    'ProposalCreated(uint256,address,address[],uint256[],string[],bytes[],uint256,uint256,string)';
  const proposalCreatedEventTopic = getEventSelector(
    proposalCreatedEventSignature
  );
  const proposalCreatedEventLog = proposeReceipt.logs.find(
    (log) =>
      log.address.toLowerCase() ===
        ARBITRUM_CORE_GOVERNOR_ADDRESS.toLowerCase() &&
      log.topics[0] === proposalCreatedEventTopic
  );

  let proposalId: bigint | undefined;
  if (proposalCreatedEventLog) {
    try {
      // Use explicit ABI for decoding this specific event
      const proposalCreatedAbiItem = parseAbiItem(
        'event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 startBlock, uint256 endBlock, string description)'
      );
      const decodedEvent = decodeEventLog({
        abi: [proposalCreatedAbiItem], // Pass only the specific event ABI for clarity
        eventName: 'ProposalCreated',
        data: proposalCreatedEventLog.data as `0x${string}`,
        topics: proposalCreatedEventLog.topics as [
          signature: `0x${string}`,
          ...args: `0x${string}`[],
        ],
      });
      if (decodedEvent.args && 'proposalId' in decodedEvent.args) {
        const idFromArgs = decodedEvent.args.proposalId;
        if (typeof idFromArgs === 'bigint') {
          proposalId = idFromArgs;
          console.log(
            `${testLogPrefix} Successfully decoded Proposal ID: ${proposalId}`
          );
        }
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
  const votingDelay = await testClient.readContract({
    address: ARBITRUM_CORE_GOVERNOR_ADDRESS,
    abi: ARBITRUM_CORE_GOVERNOR_ABI,
    functionName: 'votingDelay',
    args: [],
  });
  const blocksToMine = Number(votingDelay) + 1;
  console.log(
    `${testLogPrefix} Voting delay is ${votingDelay} blocks. Mining ${blocksToMine} blocks...`
  );

  const CHUNK_SIZE = 1000; // Mine 1000 blocks at a time
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
  const proposalStateAfterDelay = await testClient.readContract({
    address: ARBITRUM_CORE_GOVERNOR_ADDRESS,
    abi: ARBITRUM_CORE_GOVERNOR_ABI,
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

// Define the VoteCast event ABI item using parseAbiItem
const voteCastAbiItem = parseAbiItem(
  'event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason)'
);

// Define a type for the VoteCast log for better type safety
type VoteCastLog = Log<
  typeof voteCastAbiItem,
  typeof ARBITRUM_CORE_GOVERNOR_ABI,
  'VoteCast'
>;

async function waitForVoteCastEventLog(
  proposalId: bigint,
  voterAddress: Address,
  testLogPrefix: string = '',
  maxAttempts: number = VERIFICATION_MAX_ATTEMPTS,
  retryDelay: number = VERIFICATION_RETRY_DELAY
): Promise<VoteCastLog> {
  console.log(
    `${testLogPrefix} Waiting for VoteCast event for proposal ${proposalId} by ${voterAddress}...`
  );

  let foundLog: VoteCastLog | undefined;
  let attempt = 0;
  const searchBlockRange = 2000; // Search the last X blocks

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
        `${testLogPrefix} Searching logs from block ${fromBlock} to latest (${currentBlock}) using getContractEvents...`
      );

      // Use getContractEvents with event and args filtering
      const logs = await testClient.getContractEvents({
        address: ARBITRUM_CORE_GOVERNOR_ADDRESS,
        abi: ARBITRUM_CORE_GOVERNOR_ABI,
        eventName: 'VoteCast',
        args: {
          proposalId: proposalId,
        },
        fromBlock: fromBlock,
        toBlock: 'latest',
      });

      console.log(
        `${testLogPrefix} [Event Poll Attempt ${attempt}] Found ${logs.length} potential VoteCast logs matching filter.`
      );

      if (logs.length > 0) {
        // Assuming the first log found matching the criteria is the one we just cast.
        // In a simple test scenario with dedicated proposal/voter, this is usually safe.
        foundLog = logs[0] as VoteCastLog; // Cast to the specific log type
        console.log(
          `${testLogPrefix} Found matching VoteCast event in transaction ${foundLog.transactionHash}.`
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

  // Return the log object directly
  return foundLog;
}

async function verifyVoteOnchain(
  voteCastLog: VoteCastLog, // Accept the specific log object
  expectedSupport: number,
  expectedReasonContains: string,
  testLogPrefix: string = ''
): Promise<void> {
  console.log(
    `${testLogPrefix} Verifying vote details from found VoteCast event log:`
  );
  console.log(`  Tx Hash: ${voteCastLog.transactionHash}`);
  console.log(`  Block: ${voteCastLog.blockNumber}`);
  console.log(
    `  Expected Support (0=Against, 1=For, 2=Abstain): ${expectedSupport}`
  );
  console.log(`  Expected Reason to contain: "${expectedReasonContains}"`);

  let decodedEventArgs: any;
  try {
    // Decode the log directly using the specific event ABI
    const decodedEvent = decodeEventLog({
      abi: [voteCastAbiItem], // Decode using only the specific event ABI
      eventName: 'VoteCast',
      data: voteCastLog.data,
      topics: voteCastLog.topics,
    });

    decodedEventArgs = decodedEvent.args;

    console.log(
      `${testLogPrefix} Decoded VoteCast event args:`,
      JSON.stringify(
        decodedEventArgs,
        (key, value) => (typeof value === 'bigint' ? value.toString() : value), // Convert BigInts for logging
        2
      )
    );

    // Perform assertions on decoded event arguments
    expect(
      decodedEventArgs.voter?.toLowerCase(),
      `${testLogPrefix} Voter address mismatch in event`
    ).toBe(voteCastLog.address?.toLowerCase()); // Use log.address as the contract address it originated from
    expect(
      decodedEventArgs.proposalId,
      `${testLogPrefix} Proposal ID mismatch in event`
    ).toBe(voteCastLog.args.proposalId); // Compare with the proposalId used in the filter args
    expect(
      decodedEventArgs.support,
      `${testLogPrefix} Support (vote way) mismatch in event`
    ).toBe(expectedSupport);
    expect(
      decodedEventArgs.reason,
      `${testLogPrefix} Reason mismatch in event (Expected to contain: "${expectedReasonContains}", Got: "${decodedEventArgs.reason}")`
    ).toContain(expectedReasonContains);
    // Weight is also available if needed: decodedEventArgs.weight

    console.log(
      `${testLogPrefix} Vote successfully verified via VoteCast event details.`
    );
  } catch (e) {
    console.error(
      `${testLogPrefix} Failed to decode/verify VoteCast event log:`,
      e
    );
    // Log data and topics are accessed within the try block where voteCastLog is guaranteed non-undefined
    console.error('Log data:', voteCastLog.data);
    console.error('Log topics:', voteCastLog.topics);
    throw e; // Re-throw the error to fail the test
  }
}

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
  test('[Arbitrum Core] should create proposal, vote random choice via UI, verify via onchain event', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const testLogPrefix = '[Arbitrum Core]';
    const choices = ['For', 'Against', 'Abstain']; // Standard OZ Governor support values 1, 0, 2
    let proposalId: bigint;
    const uniqueReasonNonce = `onchain-test-run-${Date.now()}`;
    const expectedReasonString = `${uniqueReasonNonce}\n${ATTRIBUTION_TEXT}`; // The UI appends ATTRIBUTION_TEXT

    // 1. Create and activate a new proposal for this test run
    proposalId = await createAndActivateProposal(testLogPrefix);
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

    // 6. Wait for and find the VoteCast event log onchain using getContractEvents
    console.log(
      `${testLogPrefix} Starting onchain event log search process...`
    );
    const voteCastLog = await waitForVoteCastEventLog(
      proposalId,
      DELEGATE_ACCOUNT, // The account that signed the transaction (Metamask account)
      testLogPrefix
    );

    // 7. Verify Vote details using the found event log
    await verifyVoteOnchain(
      voteCastLog, // Pass the log object directly
      expectedSupportValue,
      expectedReasonString,
      testLogPrefix
    );

    console.log(`${testLogPrefix} Test completed successfully.`);
  });
});
